#!/usr/bin/env bash
#
# cluster-setup.sh — der Teil "Cluster aufsetzen" des Wizards als Terminal-Fassung.
#
# Dieselben Optionen, dieselbe Anleitung, dieselben Warnungen wie im Panel
# "Cluster" der WebUI (main.js: CLUSTER_FIELDS / clusterGuide / clusterMarkdown),
# nur mit whiptail oder dialog statt Browser. Zusaetzlich kann das Script die
# Schritte auf dem Rechner, auf dem es laeuft, direkt ausfuehren — Schritt fuer
# Schritt und mit Rueckfrage vor jedem Befehl.
#
# Ohne Argumente startet die Oberflaeche. Alles laesst sich auch nicht-interaktiv
# abrufen, siehe --help.

set -uo pipefail

VERSION_SELF="1.0"
SELF=$(basename "$0")

# ---------------------------------------------------------------- Sprache ----
# Wie t() in main.js: "deutsch|english", getrennt am ersten senkrechten Strich.
UILANG=de
t(){
  local s=${1-}
  if [ "$UILANG" = de ]; then printf '%s' "${s%%|*}"; else printf '%s' "${s#*|}"; fi
}
# Markdown-Auszeichnung fuer die Textausgabe entfernen.
plain(){ printf '%s' "$1" | sed -e 's/\*\*//g' -e 's/`//g'; }

# ------------------------------------------------------------ Einstellungen --
# Vorgaben identisch zu clusterOpts() in main.js.
O_version=1.34
O_os=apt
O_runtime=containerd
O_cni=cilium
O_endpoint=""
O_ha=0
O_workers=3
O_podCidr=""
O_svcCidr=""
O_singleNode=0
O_firewall=0
O_lbRange=""

# Alle drei auf 10.244.0.0/16: Calicos dokumentierte Vorgabe 192.168.0.0/16
# ueberschneidet sich mit den meisten Heim- und Bueronetzen, und Calico liest
# das Pod-Netz ohnehin selbst aus der Cluster-Konfiguration.
cni_cidr(){ echo "10.244.0.0/16"; }

CONFIG=${XDG_CONFIG_HOME:-$HOME/.config}/k8s-wizard/cluster.conf

# Abgeleitete Werte. API ist die Adresse, die in jedem join-Befehl steht.
API=""
normalize(){
  O_version=${O_version#v}
  [ -n "$O_version" ] || O_version=1.34
  [ -n "$O_podCidr" ] || O_podCidr=$(cni_cidr)
  [ -n "$O_lbRange" ] || O_lbRange="192.168.178.240-192.168.178.250"
  case $O_workers in ''|*[!0-9]*) O_workers=3;; esac
  # Gegen Tippfehler aus --set und gegen abgebrochene Auswahlmenues.
  case $O_os      in apt|dnf) :;; *) O_os=apt;; esac
  case $O_runtime in containerd|crio) :;; *) O_runtime=containerd;; esac
  case $O_cni     in cilium|calico|flannel) :;; *) O_cni=cilium;; esac
  case $O_ha         in 0|1) :;; *) O_ha=0;; esac
  case $O_singleNode in 0|1) :;; *) O_singleNode=0;; esac
  case $O_firewall   in 0|1) :;; *) O_firewall=0;; esac
  if [ -n "$O_endpoint" ]; then API=$O_endpoint
  elif [ "$O_ha" = 1 ];    then API="STABILE-ADRESSE"
  else                          API="IP-DES-HAUPTSERVERS"; fi
}

role_lbl(){
  case $1 in
    all)    echo "auf allen Knoten|on every node";;
    cp)     echo "nur Hauptserver|control plane only";;
    worker) echo "nur Worker|workers only";;
  esac
}

# --------------------------------------------------------------- Pruefungen --
# Entspricht cidrRisk und den Warnungen der Abschnitte in clusterGuide().
# Gibt Zeilen "err<TAB>text" bzw. "warn<TAB>text" aus.
config_checks(){
  local prefix=${O_podCidr##*/}
  case $O_podCidr in
    */*) case $prefix in ''|*[!0-9]*) prefix="";; esac;;
    *)   prefix="";;
  esac
  if [ -n "$prefix" ] && [ "$prefix" -ge 24 ]; then
    printf 'err\t%s\n' "$(t "Das Pod-Netz $O_podCidr ist zu klein: kubeadm teilt jedem Knoten ein eigenes /24 zu, also reicht ein /24 fuer genau einen Node — jeder weitere bekommt gar kein Pod-Netz. Ueblich ist ein /16.|The pod network $O_podCidr is too small: kubeadm assigns each node its own /24, so a /24 covers exactly one node — every further node gets no pod network at all. A /16 is the usual choice.")"
  elif [ -n "$prefix" ] && [ "$prefix" -gt 20 ]; then
    printf 'warn\t%s\n' "$(t "Das Pod-Netz $O_podCidr ist knapp bemessen: Jeder Knoten belegt daraus ein /24.|The pod network $O_podCidr is tight: every node takes a /24 out of it.")"
  fi
  case $O_podCidr in 192.168.*)
    printf 'warn\t%s\n' "$(t "192.168.x ist der uebliche Bereich von Heim- und Bueronetzen — und zugleich Calicos Vorgabe. Ueberschneidet er sich mit dem Netz der Knoten, kollidieren Pod-Adressen mit echten Geraeten, und die Fehlersuche fuehrt weit in die Irre. Vorher mit ip -4 addr vergleichen und im Zweifel 10.244.0.0/16 nehmen.|192.168.x is the usual range for home and office networks — and at the same time Calico's default. If it overlaps the nodes' network, pod addresses collide with real devices and troubleshooting leads far astray. Compare with ip -4 addr first and use 10.244.0.0/16 when in doubt.")";;
  esac
  if [ "$O_ha" = 1 ] && [ -z "$O_endpoint" ]; then
    printf 'err\t%s\n' "$(t "Fuer mehrere Hauptserver ist --control-plane-endpoint zwingend. Ohne ihn schreibt kubeadm keinen controlPlaneEndpoint in die Cluster-Konfiguration, und jeder weitere Hauptserver scheitert. Trag die API-Adresse ein, bevor du anfaengst.|For several control-plane nodes, --control-plane-endpoint is mandatory. Without it kubeadm writes no controlPlaneEndpoint into the cluster configuration and every further control-plane node fails. Enter the API address before you begin.")"
  fi
  if [ "$O_cni" = flannel ] && [ "$O_podCidr" != "10.244.0.0/16" ]; then
    printf 'err\t%s\n' "$(t "Flannel erwartet zwingend 10.244.0.0/16 als Pod-Netz. Mit $O_podCidr bekommen die Pods keine Adressen.|Flannel insists on 10.244.0.0/16 as the pod network. With $O_podCidr the pods get no addresses.")"
  fi
}

# ------------------------------------------------------------ Renderer-Bus --
# guide() ruft nur sec/para/thead/trow/risk/cmd auf. Welche Ausgabe daraus
# entsteht, entscheidet $R: md (Markdown), txt (Text), sh (Script), ex
# (ausfuehren), ls (nur Abschnitte auflisten).
R=txt
SECN=0
sec(){   "${R}_sec"   "$@"; }
para(){  "${R}_para"  "$@"; }
thead(){ "${R}_thead" "$@"; }
trow(){  "${R}_trow"  "$@"; }
risk(){  "${R}_risk"  "$@"; }
cmd(){   "${R}_cmd"   "$@"; }

risk_lbl(){ [ "$1" = err ] && t "Achtung|Caution" || t "Hinweis|Note"; }

# ------------------------------------------------------------- Die Anleitung -
# Reihenfolge und Wortlaut folgen clusterGuide() in main.js.
guide(){
  normalize
  local apt=0; [ "$O_os" = apt ] && apt=1

  # --- alle Knoten ---
  sec "Vorbereitung|Preparation" all
  para "Diese Schritte laufen unveraendert auf **jedem** Rechner — Hauptserver wie Worker. Am schnellsten geht es, wenn du sie parallel auf allen Knoten ausfuehrst.|These steps run identically on **every** machine — control plane and workers alike. Fastest is to run them on all nodes in parallel."
  risk warn "Alle Knoten brauchen unterschiedliche Hostnamen, MAC-Adressen und product_uuid. Geklonte VMs teilen sich diese Werte oft — dann treten Knoten dem Cluster bei und verdraengen sich gegenseitig.|Every node needs a distinct hostname, MAC address and product_uuid. Cloned VMs often share these — then nodes join and displace each other."

  cmd "$(cat <<'CMD'
sudo swapoff -a
sudo sed -i '/ swap / s/^/#/' /etc/fstab
CMD
)" "Der kubelet startet nicht, solange Swap aktiv ist. Die zweite Zeile sorgt dafuer, dass es auch nach einem Neustart aus bleibt.|The kubelet refuses to start while swap is on. The second line keeps it off across reboots."

  cmd "$(cat <<'CMD'
cat <<'EOF' | sudo tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF
sudo modprobe overlay
sudo modprobe br_netfilter
CMD
)" "Ohne br_netfilter sieht der Node den Verkehr zwischen Pods nicht, und keine NetworkPolicy greift.|Without br_netfilter the node cannot see traffic between pods and no network policy takes effect."

  cmd "$(cat <<'CMD'
cat <<'EOF' | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF
sudo sysctl --system
CMD
)" "Weiterleitung und Bridge-Filter dauerhaft einschalten.|Turns forwarding and bridge filtering on for good."

  if [ "$O_os" = dnf ]; then
    cmd "$(cat <<'CMD'
sudo setenforce 0
sudo sed -i 's/^SELINUX=enforcing$/SELINUX=permissive/' /etc/selinux/config
CMD
)" "SELinux auf permissive, sonst kommt der kubelet nicht an die Container-Verzeichnisse. Wer SELinux behalten will, braucht passende Policies statt dieses Schritts.|SELinux to permissive, otherwise the kubelet cannot reach the container directories. Keeping SELinux means writing matching policies instead of this step."
  fi

  if [ "$O_runtime" = containerd ]; then
    if [ "$apt" = 1 ]; then
      cmd "sudo apt-get update && sudo apt-get install -y containerd" \
        "Die Runtime, in der die Container tatsaechlich laufen.|The runtime the containers actually run in."
    else
      cmd "sudo dnf install -y containerd" \
        "Die Runtime, in der die Container tatsaechlich laufen.|The runtime the containers actually run in."
    fi
    cmd "$(cat <<'CMD'
sudo mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml >/dev/null
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml
sudo systemctl restart containerd && sudo systemctl enable containerd
CMD
)" "Der wichtigste Schritt der ganzen Vorbereitung: containerd und kubelet muessen denselben cgroup-Treiber verwenden. Stimmt das nicht ueberein, startet kubeadm init scheinbar grundlos nicht durch.|The most important step of the whole preparation: containerd and the kubelet must use the same cgroup driver. If they disagree, kubeadm init stalls for no apparent reason."
  else
    if [ "$apt" = 1 ]; then
      cmd "$(cat <<'CMD'
sudo apt-get update && sudo apt-get install -y cri-o
sudo systemctl enable --now crio
CMD
)" "CRI-O bringt den systemd-cgroup-Treiber bereits richtig eingestellt mit.|CRI-O ships with the systemd cgroup driver already set correctly."
    else
      cmd "$(cat <<'CMD'
sudo dnf install -y cri-o
sudo systemctl enable --now crio
CMD
)" "CRI-O bringt den systemd-cgroup-Treiber bereits richtig eingestellt mit.|CRI-O ships with the systemd cgroup driver already set correctly."
    fi
  fi

  if [ "$apt" = 1 ]; then
    cmd "$(cat <<CMD
sudo apt-get install -y apt-transport-https ca-certificates curl gpg
sudo mkdir -p -m 755 /etc/apt/keyrings
curl -fsSL https://pkgs.k8s.io/core:/stable:/v$O_version/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v$O_version/deb/ /' | sudo tee /etc/apt/sources.list.d/kubernetes.list
sudo apt-get update
sudo apt-get install -y kubelet kubeadm kubectl
sudo apt-mark hold kubelet kubeadm kubectl
CMD
)" "Die Paketquelle ist an die Minor-Version gebunden — fuer ein spaeteres Upgrade auf $O_version+1 muss sie umgeschrieben werden. apt-mark hold verhindert, dass ein beilaeufiges apt upgrade den Cluster mitreisst.|The repository is tied to the minor version — a later upgrade past $O_version means rewriting it. apt-mark hold stops a casual apt upgrade from dragging the cluster along."
  else
    cmd "$(cat <<CMD
cat <<'EOF' | sudo tee /etc/yum.repos.d/kubernetes.repo
[kubernetes]
name=Kubernetes
baseurl=https://pkgs.k8s.io/core:/stable:/v$O_version/rpm/
enabled=1
gpgcheck=1
gpgkey=https://pkgs.k8s.io/core:/stable:/v$O_version/rpm/repodata/repomd.xml.key
exclude=kubelet kubeadm kubectl cri-tools kubernetes-cni
EOF
sudo dnf install -y kubelet kubeadm kubectl --disableexcludes=kubernetes
sudo systemctl enable --now kubelet
CMD
)" "exclude in der Repo-Datei haelt die Pakete von einem beilaeufigen dnf update fern.|The exclude line in the repo file keeps the packages away from a casual dnf update."
  fi

  cmd "$(cat <<'CMD'
kubeadm version -o short
kubelet --version
ip -4 addr show | grep 'inet '
CMD
)" "Vor dem Weitermachen pruefen. Die ersten beiden Zeilen muessen dieselbe Minor-Version melden — sonst bricht der naechste Schritt mit *the kubelet version is higher than the control plane version* ab. Und die IP-Adressen aus der dritten Zeile duerfen sich **nicht** mit dem Pod-Netz ueberschneiden.|Check before moving on. The first two lines have to report the same minor version — otherwise the next step aborts with *the kubelet version is higher than the control plane version*. And the addresses from the third line must **not** overlap the pod network."

  # --- Firewall ---
  if [ "$O_firewall" = 1 ]; then
    sec "Firewall|Firewall" all
    para "Nur noetig, wenn auf den Knoten eine Firewall laeuft.|Only needed when a firewall runs on the nodes."
    cmd "$(cat <<'CMD'
# Hauptserver
sudo firewall-cmd --permanent --add-port={6443,2379-2380,10250,10257,10259}/tcp
CMD
)" "API-Server, etcd, kubelet, Controller-Manager und Scheduler.|API server, etcd, kubelet, controller manager and scheduler."
    cmd "$(cat <<'CMD'
# Worker
sudo firewall-cmd --permanent --add-port={10250,30000-32767}/tcp
CMD
)" "kubelet und der NodePort-Bereich.|The kubelet and the NodePort range."
    local cniname cniports
    case $O_cni in
      calico)  cniname=Calico;  cniports="179/tcp --permanent --add-port=4789/udp";;
      flannel) cniname=Flannel; cniports="8472/udp";;
      *)       cniname=Cilium;  cniports="8472/udp --permanent --add-port=4240/tcp";;
    esac
    cmd "$(printf '# %s\nsudo firewall-cmd --permanent --add-port=%s\nsudo firewall-cmd --reload' "$cniname" "$cniports")" \
      "Das Overlay-Netz des CNI. Fehlen diese Ports, sind Pods auf demselben Node erreichbar und ueber Node-Grenzen hinweg nicht — ein Fehlerbild, das lange in die Irre fuehrt.|The CNI's overlay network. Without these ports pods reach each other on the same node but not across nodes — a symptom that misleads for a long time."
  fi

  # --- erster Hauptserver ---
  local init_cmd="sudo kubeadm init \\
  --pod-network-cidr=$O_podCidr"
  [ -n "$O_svcCidr" ] && init_cmd="$init_cmd \\
  --service-cidr=$O_svcCidr"
  if [ -n "$O_endpoint" ] || [ "$O_ha" = 1 ]; then
    init_cmd="$init_cmd \\
  --control-plane-endpoint=$API:6443"
  fi
  [ "$O_ha" = 1 ] && init_cmd="$init_cmd \\
  --upload-certs"

  sec "Erster Hauptserver|First control-plane node" cp
  para "Ab hier unterscheiden sich die Rechner. Diese Schritte laufen **nur auf dem ersten Hauptserver**.|From here the machines differ. These steps run **only on the first control-plane node**."
  # Prozesssubstitution statt Pipe: der Renderer darf Zustand behalten.
  local lvl msg
  while IFS=$'\t' read -r lvl msg; do
    [ -n "$lvl" ] && risk "$lvl" "$msg|$msg"
  done < <(config_checks)
  if [ -n "$O_endpoint" ]; then
    risk warn "Die Adresse muss auf allen Knoten aufloesen, bevor du anfaengst — notfalls ueber /etc/hosts. Nimm einen Namen statt einer IP: Der Name wandert spaeter auf einen Lastverteiler oder eine VIP, ohne dass Zertifikate neu ausgestellt werden muessen.|The address has to resolve on every node before you begin — an entry in /etc/hosts will do. Use a name rather than an IP: the name can later move to a load balancer or a VIP without reissuing certificates."
  fi
  if [ "$O_ha" != 1 ]; then
    risk warn "Ein einzelner Hauptserver ist keine Hochverfuegbarkeit: Faellt er aus, ist die API weg und nichts laesst sich mehr aendern. Bereits laufende Pods laufen weiter, aber niemand ersetzt sie.|A single control-plane node is not high availability: if it fails the API is gone and nothing can be changed. Pods already running keep running, but nobody replaces them."
  fi

  cmd "$init_cmd" "Ohne --kubernetes-version, mit Absicht: kubeadm nimmt dann genau die Version des installierten kubeadm — die aus der Paketquelle von oben. Eine Version von Hand einzutragen fuehrt zuverlaessig zu \"the kubelet version is higher than the control plane version\". Legt etcd, API-Server, Controller-Manager und Scheduler an. Am Ende gibt der Befehl die Beitrittsbefehle aus — **diese Ausgabe aufheben**, sie enthaelt Token und Pruefsumme.|Deliberately without --kubernetes-version: kubeadm then uses exactly the version of the installed kubeadm — the one from the repository above. Entering a version by hand reliably produces \"the kubelet version is higher than the control plane version\". Creates etcd, the API server, the controller manager and the scheduler. At the end it prints the join commands — **keep that output**, it contains the token and the checksum."

  cmd "$(cat <<'CMD'
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config
CMD
)" "Erst danach funktioniert kubectl als normaler Benutzer.|Only after this does kubectl work as an ordinary user."

  case $O_cni in
    cilium)
      cmd "$(cat <<'CMD'
CILIUM_CLI=v0.16.16   # aktuelle Version aus den Release Notes
curl -sL --fail --remote-name-all https://github.com/cilium/cilium-cli/releases/download/${CILIUM_CLI}/cilium-linux-amd64.tar.gz
sudo tar xzvfC cilium-linux-amd64.tar.gz /usr/local/bin
cilium install
cilium status --wait
CMD
)" "Ohne CNI bleiben alle Knoten NotReady und die CoreDNS-Pods haengen in Pending. Das ist kein Fehler, sondern der normale Zwischenstand.|Without a CNI every node stays NotReady and the CoreDNS pods sit in Pending. That is not a fault, it is the normal intermediate state.";;
    calico)
      cmd "$(cat <<'CMD'
CALICO=v3.29.1   # aktuelle Version aus den Release Notes
kubectl apply -f https://raw.githubusercontent.com/projectcalico/calico/${CALICO}/manifests/calico.yaml
CMD
)" "Calico uebernimmt das Pod-Netz und bringt NetworkPolicy gleich mit. Im Manifest steht zwar 192.168.0.0/16, aber Calico liest das tatsaechliche Pod-Netz aus der Cluster-Konfiguration — genau deshalb ist hier 10.244.0.0/16 voreingestellt, das sich mit keinem ueblichen Heimnetz ueberschneidet.|Calico takes over the pod network and brings network policy with it. The manifest says 192.168.0.0/16, but Calico reads the actual pod network from the cluster configuration — which is exactly why 10.244.0.0/16 is preset here, a range that collides with no common home network.";;
    flannel)
      cmd "kubectl apply -f https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml" \
        "Flannel erwartet zwingend 10.244.0.0/16 als Pod-Netz. Flannel kennt keine NetworkPolicy — dafuer braucht es spaeter zusaetzlich Calico oder Cilium.|Flannel insists on 10.244.0.0/16 as the pod network. Flannel has no network policy — that needs Calico or Cilium alongside it later.";;
  esac

  if [ "$O_singleNode" = 1 ]; then
    cmd "kubectl taint nodes --all node-role.kubernetes.io/control-plane-" \
      "Nimmt den Taint weg, mit dem kubeadm normale Arbeitslast vom Hauptserver fernhaelt. Fuer einen Testcluster richtig, fuer Produktion nicht.|Removes the taint with which kubeadm keeps ordinary workloads off the control plane. Right for a test cluster, not for production."
  fi

  # --- woher die Platzhalter kommen ---
  sec "Beitrittsdaten besorgen|Getting the join values" cp
  para "Die Platzhalter in den folgenden Befehlen stammen alle aus der Ausgabe von \`kubeadm init\`. Ist die verloren, holst du sie hier — **auf dem ersten Hauptserver**, nicht auf dem Rechner, der beitreten soll.|The placeholders in the commands below all come from the output of \`kubeadm init\`. If that is lost, this is where you get them — **on the first control-plane node**, not on the machine that wants to join."
  thead "Platzhalter|Placeholder" "Was es ist|What it is" "Gueltig|Valid for" "Woher|Where from"
  trow "\`<TOKEN>\`" "Einmalkennwort fuer den Beitritt|One-time password for joining" "24 Stunden|24 hours" "\`kubeadm token create --print-join-command\`"
  trow "\`<HASH>\`" "Fingerabdruck der Cluster-CA|Fingerprint of the cluster CA" "unbegrenzt|indefinitely" "derselbe Befehl — oder der openssl-Dreisatz unten|the same command — or the openssl trio below"
  if [ "$O_ha" = 1 ]; then
    trow "\`<KEY>\`" "Schluessel fuer die hochgeladenen Zertifikate|Key for the uploaded certificates" "2 Stunden|2 hours" "\`kubeadm init phase upload-certs --upload-certs\`"
  fi
  risk err "Der Hash ist keine Formsache: Ohne ihn — etwa mit --discovery-token-unsafe-skip-ca-verification — glaubt der beitretende Knoten jedem, der auf der Adresse antwortet, und uebergibt sein Vertrauen an einen moeglicherweise fremden API-Server.|The hash is not a formality: without it — for instance with --discovery-token-unsafe-skip-ca-verification — the joining node believes whoever answers on that address and hands its trust to a potentially foreign API server."

  cmd "kubeadm token create --print-join-command" \
    "Der bequemste Weg: Dieser Befehl erzeugt ein frisches Token und gibt den vollstaendigen Beitrittsbefehl aus — Token und Hash schon eingesetzt. Ausgabe auf dem Worker einfuegen, fertig. Fuer einen weiteren Hauptserver haengst du an diese Zeile noch --control-plane --certificate-key an.|The most convenient way: this creates a fresh token and prints the complete join command — token and hash already filled in. Paste the output on the worker and you are done. For another control-plane node, append --control-plane --certificate-key to that line."
  cmd "kubeadm token list" \
    "Zeigt die vorhandenen Token mit ihrer Restlaufzeit in der Spalte TTL. Ist die Liste leer, ist das Token aus der Installation abgelaufen — dann hilft nur der Befehl darueber.|Lists the existing tokens with their remaining lifetime in the TTL column. An empty list means the token from the installation has expired — then only the command above helps."
  cmd "$(cat <<'CMD'
openssl x509 -pubkey -in /etc/kubernetes/pki/ca.crt \
  | openssl rsa -pubin -outform der 2>/dev/null \
  | openssl dgst -sha256 -hex | sed 's/^.* //'
CMD
)" "Nur den Hash nachschlagen, falls das Token noch gilt. Er ist der Fingerabdruck der Cluster-CA und aendert sich nie, solange der Cluster derselbe bleibt — du kannst ihn dir also einmal aufschreiben.|Look up just the hash, in case the token is still valid. It is the fingerprint of the cluster CA and never changes as long as the cluster stays the same — so you can write it down once."
  if [ "$O_ha" = 1 ]; then
    cmd "$(cat <<'CMD'
sudo kubeadm init phase upload-certs --upload-certs
kubeadm token create --print-join-command
CMD
)" "Beide Werte auf einmal, weil ein weiterer Hauptserver beide braucht: Der erste Befehl laedt die Zertifikate erneut in das Secret kubeadm-certs und gibt den neuen certificate-key als **letzte Zeile** aus, der zweite den vollstaendigen Beitrittsbefehl mit Token und Hash. Aneinandergehaengt ergibt das die Zeile fuer den neuen Hauptserver.|Both values at once, because an additional control-plane node needs both: the first command uploads the certificates into the kubeadm-certs secret again and prints the new certificate key as its **last line**, the second prints the complete join command with token and hash. Put together they form the line for the new control-plane node."
  fi

  # --- weitere Hauptserver ---
  if [ "$O_ha" = 1 ]; then
    sec "Weitere Hauptserver|Further control-plane nodes" cp
    para "Auf dem zweiten und dritten Hauptserver — nicht auf den Workern.|On the second and third control-plane node — not on the workers."
    para "\`<TOKEN>\` und \`<HASH>\` wie beim Worker, dazu \`<KEY>\` aus dem Abschnitt **Beitrittsdaten besorgen**. Der Schluessel ist der Grund, warum ein Hauptserver mehr braucht als ein Worker: Mit ihm holt sich der neue Knoten die Zertifikate der bestehenden CA, statt eine eigene anzulegen.|\`<TOKEN>\` and \`<HASH>\` as for a worker, plus \`<KEY>\` from the section **Getting the join values**. That key is why a control-plane node needs more than a worker: with it the new node fetches the certificates of the existing CA instead of creating its own."
    risk warn "Drei Hauptserver, nicht zwei: etcd braucht eine Mehrheit. Mit zwei Knoten steht der Cluster, sobald einer ausfaellt — schlechter als mit einem einzelnen.|Three control-plane nodes, not two: etcd needs a majority. With two nodes the cluster stops as soon as one fails — worse than with a single one."
    cmd "$(cat <<CMD
sudo kubeadm join $API:6443 \\
  --token <TOKEN> \\
  --discovery-token-ca-cert-hash sha256:<HASH> \\
  --control-plane --certificate-key <KEY>
CMD
)" "Genau der Befehl, den kubeadm init ausgegeben hat — mit --control-plane und dem Zertifikatsschluessel. Fehlt dir die Ausgabe, setzt du ihn aus kubeadm token create --print-join-command und einem frischen certificate-key selbst zusammen.|Exactly the command kubeadm init printed — with --control-plane and the certificate key. If you no longer have that output, assemble it yourself from kubeadm token create --print-join-command plus a fresh certificate key."
    cmd "$(cat <<'CMD'
KEY=$(sudo kubeadm init phase upload-certs --upload-certs | tail -1)
echo "$(kubeadm token create --print-join-command) --control-plane --certificate-key $KEY"
CMD
)" "Auf dem **ersten** Hauptserver ausfuehren: Das erzeugt einen frischen Zertifikatsschluessel und ein frisches Token und setzt daraus die vollstaendige Zeile zusammen, die du oben brauchst. Weil beide Werte neu sind, spielt es keine Rolle, wie lange die Installation her ist.|Run on the **first** control-plane node: this creates a fresh certificate key and a fresh token and assembles the complete line you need above. Since both values are new, it does not matter how long ago the installation was."

    # --- Notausgang, wenn der Endpoint fehlt ---
    sec "Wenn der Endpoint fehlt|If the endpoint is missing" cp
    para "Steht der Cluster bereits und \`kubeadm init\` lief ohne \`--control-plane-endpoint\`, scheitert jeder weitere Hauptserver mit *unable to add a new control plane instance to a cluster that doesn't have a stable controlPlaneEndpoint address*. Nachruesten hiesse: ConfigMap kubeadm-config aendern, das API-Server-Zertifikat mit neuem SAN ausstellen und alle vier kubeconfig-Dateien umschreiben. Bei einem frischen Cluster ist Zuruecksetzen schneller und sicherer.|If the cluster is already up and \`kubeadm init\` ran without \`--control-plane-endpoint\`, every further control-plane node fails with *unable to add a new control plane instance to a cluster that doesn't have a stable controlPlaneEndpoint address*. Retrofitting means editing the kubeadm-config ConfigMap, reissuing the API server certificate with a new SAN and rewriting all four kubeconfig files. On a fresh cluster, resetting is faster and safer."
    risk warn "Zeigt der Endpoint auf die IP eines einzelnen Hauptservers, laesst kubeadm zwar weitere Master zu — hochverfuegbar ist der Cluster damit trotzdem nicht, weil die Adresse mit genau dieser Maschine steht und faellt.|If the endpoint points at a single control-plane node's IP, kubeadm does allow further masters — but the cluster is still not highly available, because the address lives and dies with that one machine."
    cmd "kubectl -n kube-system get cm kubeadm-config -o yaml | grep -i controlPlaneEndpoint" \
      "Zuerst nachsehen. Kommt keine Zeile zurueck, fehlt der Endpoint — dann gilt der Rest dieses Abschnitts.|Check first. If no line comes back, the endpoint is missing and the rest of this section applies."
    cmd "$(cat <<'CMD'
sudo kubeadm reset -f
sudo rm -rf /etc/cni/net.d $HOME/.kube/config
CMD
)" "Auf **jedem** Knoten, der schon beigetreten ist. Reihenfolge und Nacharbeiten stehen im letzten Abschnitt **Neu aufsetzen**.|On **every** node that has already joined. The order and the follow-up work are in the last section, **Starting over**."
    cmd "echo '192.168.0.10 ${O_endpoint:-k8s-api.firma.de}' | sudo tee -a /etc/hosts" \
      "Auf allen Knoten, solange es keinen DNS-Eintrag gibt: Die IP ist vorerst der erste Hauptserver. Spaeter zeigt derselbe Name auf den Lastverteiler oder eine VIP — und weil sich nur die Aufloesung aendert, bleiben die Zertifikate gueltig.|On every node as long as there is no DNS record: the IP is the first control-plane node for now. Later the same name points at the load balancer or a VIP — and because only the resolution changes, the certificates stay valid."
    cmd "$init_cmd" \
      "Neu aufsetzen, diesmal mit Endpoint. Danach greifen die Beitrittsbefehle wie beschrieben.|Set up again, this time with the endpoint. After that the join commands work as described."
  fi

  # --- Worker ---
  sec "Auf jedem Worker|On every worker" worker
  if [ "$O_workers" -gt 0 ] 2>/dev/null; then
    para "Auf allen $O_workers Workern — nach der Vorbereitung ganz oben, aber ohne die Schritte des Hauptservers.|On all $O_workers workers — after the preparation above, but without any of the control-plane steps."
  else
    para "Auf jedem Worker — nach der Vorbereitung ganz oben, aber ohne die Schritte des Hauptservers.|On every worker — after the preparation above, but without any of the control-plane steps."
  fi
  risk err "kubectl gehoert nicht auf die Worker und die admin.conf schon gar nicht. Wer sie dorthin kopiert, gibt jedem mit Zugang zum Worker die volle Kontrolle ueber den Cluster.|kubectl does not belong on the workers and admin.conf certainly does not. Copying it there hands anyone with access to that worker full control of the cluster."
  cmd "$(cat <<CMD
sudo kubeadm join $API:6443 \\
  --token <TOKEN> \\
  --discovery-token-ca-cert-hash sha256:<HASH>
CMD
)" "Der Befehl aus der Ausgabe von kubeadm init, ohne --control-plane. \`<TOKEN>\` und \`<HASH>\` kommen aus dem Abschnitt **Beitrittsdaten besorgen** — dort steht auch, wie du sie neu erzeugst.|The command from the kubeadm init output, without --control-plane. \`<TOKEN>\` and \`<HASH>\` come from the section **Getting the join values**, which also shows how to create them anew."

  # --- Pruefen ---
  sec "Pruefen|Checking" cp
  para "Auf dem Hauptserver, sobald alle Knoten beigetreten sind.|On the control-plane node, once every node has joined."
  cmd "kubectl get nodes -o wide" \
    "Alle Knoten muessen Ready sein. NotReady direkt nach dem Beitritt ist normal, solange das CNI seine Pods noch verteilt.|Every node has to be Ready. NotReady right after joining is normal while the CNI is still distributing its pods."
  cmd "kubectl get pods -A" \
    "CoreDNS ist der beste Anzeiger: Laeuft es, funktioniert das Pod-Netz.|CoreDNS is the best indicator: if it runs, the pod network works."
  cmd "$(cat <<'CMD'
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{": "}{range .status.conditions[?(@.type=="Ready")]}{.message}{end}{"\n"}{end}'
CMD
)" "Sagt im Klartext, **warum** ein Knoten NotReady ist, statt es raten zu lassen. Steht dort *cni plugin not initialized*, fehlt schlicht das Netzwerk-Plugin — der Normalzustand direkt nach dem Beitritt. Steht etwas anderes da, ist es auch etwas anderes.|Says in plain words **why** a node is NotReady instead of leaving you guessing. If it reads *cni plugin not initialized*, the network plugin is simply missing — the normal state right after joining. If it says something else, it is something else."
  cmd "$(cat <<'CMD'
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.podCIDR}{"\n"}{end}'
CMD
)" "Jeder Knoten muss ein eigenes Teilnetz haben — bei einem /16 als Pod-Netz also 10.244.0.0/24, 10.244.1.0/24 und so weiter. Bleibt die Spalte bei einem Knoten leer, war das Pod-Netz zu klein gewaehlt.|Every node has to have its own subnet — with a /16 as the pod network that means 10.244.0.0/24, 10.244.1.0/24 and so on. If the column stays empty for a node, the pod network was chosen too small."
  cmd "kubectl run probe --image=nginx:1.27-alpine --restart=Never --rm -it -- sh" \
    "Ein Pod von Hand, um den Weg von der Registry bis in den Container einmal zu gehen.|A pod by hand, to walk the path from the registry into the container once."

  # --- Funktionstest ---
  sec "Funktionstest|Smoke test" cp
  para "Der Reihe nach von innen nach aussen. Jeder Schritt setzt den vorigen voraus — bricht einer ab, ist die Ursache dort und nicht weiter unten.|From the inside out, in order. Each step needs the one before it — if one fails, the cause is there and not further down."
  risk warn "Bleibt ein Service auf Pending oder ein Pod auf ContainerCreating, hilft kubectl describe auf genau dieses Objekt weiter — der Abschnitt Events ganz unten nennt die Ursache fast immer im Klartext.|If a service stays Pending or a pod stays in ContainerCreating, kubectl describe on exactly that object is the way forward — the Events section at the bottom almost always names the cause outright."
  cmd "$(cat <<'CMD'
kubectl get nodes -o wide
kubectl get pods -A
CMD
)" "Erwartung: alle Knoten Ready, alle Pods Running oder Completed. Haengt CoreDNS in Pending, laeuft das CNI noch nicht.|Expected: every node Ready, every pod Running or Completed. If CoreDNS sits in Pending, the CNI is not up yet."
  cmd "$(cat <<'CMD'
kubectl run dnstest --image=busybox:1.36 --restart=Never --rm -it -- \
  nslookup kubernetes.default.svc.cluster.local
CMD
)" "Der **vollstaendige** Name mit Absicht: BusyBox wertet die search-Liste aus /etc/resolv.conf nicht zuverlaessig aus und fragt Namen mit Punkt so ab, wie sie dastehen. Die Kurzform kubernetes.default liefert deshalb NXDOMAIN, obwohl DNS einwandfrei arbeitet. Erwartung: Address 10.96.0.1.|The **full** name deliberately: BusyBox does not reliably apply the search list from /etc/resolv.conf and queries names containing a dot exactly as written. The short form kubernetes.default therefore returns NXDOMAIN even though DNS works perfectly. Expected: Address 10.96.0.1."
  cmd "$(cat <<'CMD'
kubectl run dnstest --image=busybox:1.36 --restart=Never --rm -it -- \
  cat /etc/resolv.conf
CMD
)" "Falls die Abfrage scheitert: Hier muss nameserver 10.96.0.10 stehen, dazu die search-Liste mit default.svc.cluster.local. Antwortet 10.96.0.10 ueberhaupt — egal mit was —, sind Pod-Netz und kube-proxy in Ordnung und das Problem liegt in CoreDNS selbst. Kommt dagegen ein Timeout, ist es das Netz.|If the query fails: this has to show nameserver 10.96.0.10 plus the search list with default.svc.cluster.local. If 10.96.0.10 answers at all — with anything — the pod network and kube-proxy are fine and the problem is inside CoreDNS. A timeout instead means it is the network."
  cmd "$(cat <<'CMD'
kubectl create deployment web --image=nginx:1.27-alpine --replicas=3
kubectl expose deployment web --port=80
kubectl get pods -o wide
kubectl get endpoints web
CMD
)" "Erwartung: drei Pods, moeglichst auf verschiedenen Knoten, und drei Adressen unter ENDPOINTS. Steht dort none, trifft der Selector nicht.|Expected: three pods, ideally on different nodes, and three addresses under ENDPOINTS. If it says none, the selector does not match."
  cmd "$(cat <<'CMD'
kubectl run probe --image=busybox:1.36 --restart=Never --rm -it -- \
  wget -qO- http://web
CMD
)" "Der aussagekraeftigste Test ueberhaupt, weil er den normalen Resolver des Containers benutzt und nicht BusyBox' nslookup: ueber den Service-Namen, aus einem anderen Pod, moeglicherweise von einem anderen Knoten. Kommt die nginx-Startseite zurueck, funktionieren DNS, kube-proxy und das Overlay ueber Knotengrenzen hinweg — dann ist die Frage nach dem NXDOMAIN oben erledigt.|The most meaningful test of all, because it uses the container's normal resolver rather than BusyBox's nslookup: via the service name, from another pod, possibly on another node. If the nginx welcome page comes back, DNS, kube-proxy and the overlay across node boundaries all work — and the NXDOMAIN question above is settled."
  cmd "$(cat <<'CMD'
kubectl patch svc web -p '{"spec":{"type":"NodePort"}}'
kubectl get svc web
# dann vom eigenen Rechner, nicht vom Knoten:
curl http://ADRESSE-EINES-KNOTENS:ANGEZEIGTER-NODEPORT
CMD
)" "Der einfachste Test von aussen, ganz ohne MetalLB und ohne Ingress. Die zweite Spalte zeigt etwas wie 80:31234/TCP — die Zahl hinter dem Doppelpunkt ist der Port. Erreichbar ist er auf **jedem** Knoten, auch auf denen, wo gar kein Pod laeuft. Klappt das, sind Knoten, kube-proxy und Pod in Ordnung, und alles Weitere liegt dann allein an MetalLB oder am Ingress.|The simplest test from outside, with no MetalLB and no ingress. The second column shows something like 80:31234/TCP — the number after the colon is the port. It is reachable on **every** node, including those where no pod runs. If that works, nodes, kube-proxy and pod are fine, and anything further is down to MetalLB or the ingress alone."
  cmd "$(cat <<'CMD'
METALLB=v0.14.9   # aktuelle Version aus den Release Notes
kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/${METALLB}/config/manifests/metallb-native.yaml
kubectl -n metallb-system wait --for=condition=available deploy/controller --timeout=120s
CMD
)" "Auf eigener Hardware vergibt niemand externe Adressen — MetalLB uebernimmt das. In der Cloud entfaellt dieser Schritt, dort macht es der Anbieter.|On your own hardware nothing hands out external addresses — MetalLB does that job. In the cloud you skip this step; the provider does it."
  cmd "$(cat <<CMD
cat <<'EOF' | kubectl apply -f -
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: lan
  namespace: metallb-system
spec:
  addresses:
    - $O_lbRange
---
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  name: lan
  namespace: metallb-system
spec:
  ipAddressPools:
    - lan
EOF
CMD
)" "Der Bereich muss im Netz der Knoten liegen und ausserhalb dessen, was der Router per DHCP vergibt — sonst bekommt irgendwann ein Laptop dieselbe Adresse wie dein Service.|The range has to sit in the nodes' network and outside what the router hands out via DHCP — otherwise a laptop eventually gets the same address as your service."
  cmd "$(cat <<'CMD'
kubectl patch svc web -p '{"spec":{"type":"LoadBalancer"}}'
kubectl get svc web
CMD
)" "Erwartung: unter EXTERNAL-IP steht nach wenigen Sekunden eine Adresse aus dem Bereich oben. Bleibt dort dauerhaft Pending, findet MetalLB keinen freien Platz — oder der Pool passt nicht zum Netz der Knoten.|Expected: an address from the range above appears under EXTERNAL-IP within seconds. If it stays Pending, MetalLB finds no free slot — or the pool does not match the nodes' network."
  cmd "curl http://ADRESSE-AUS-EXTERNAL-IP" \
    "Vom eigenen Rechner aus, nicht vom Knoten. Kommt die nginx-Seite, ist der Weg von aussen bis in den Pod offen.|From your own machine, not from a node. If the nginx page appears, the path from outside into the pod is open."
  cmd "$(cat <<'CMD'
kubectl -n metallb-system logs -l component=speaker --tail=30
ip neigh | grep ADRESSE-AUS-EXTERNAL-IP
CMD
)" "Nur noetig, wenn die Adresse zwar vergeben ist, aber nichts antwortet. MetalLB kuendigt sie im lokalen Netz per ARP an. Taucht sie in der Nachbarschaftstabelle deines Rechners nicht auf, liegt sie ausserhalb des Subnetzes der Knoten oder die L2Advertisement fehlt. Antwortet der NodePort von oben weiterhin, ist der Cluster in Ordnung und es liegt allein an MetalLB.|Only needed if the address is assigned but nothing answers. MetalLB announces it on the local network via ARP. If it does not show up in your machine's neighbour table, it sits outside the nodes' subnet or the L2Advertisement is missing. If the NodePort above still answers, the cluster is fine and it is MetalLB alone."
  cmd "$(cat <<'CMD'
kubectl -n ingress-nginx get pods
kubectl get ingressclass
CMD
)" "Zuerst: Gibt es den Controller ueberhaupt? Erwartung ist ein Pod im Zustand Running und eine IngressClass namens nginx. Fehlt die Klasse, wird jede Ingress-Regel spaeter stillschweigend ignoriert — ohne Fehlermeldung, denn niemand fuehlt sich zustaendig.|First: does the controller exist at all? Expected is a pod in Running and an IngressClass called nginx. Without that class every ingress rule is silently ignored later — with no error, because nobody feels responsible."
  cmd "$(cat <<'CMD'
kubectl -n ingress-nginx patch svc ingress-nginx-controller \
  -p '{"spec":{"type":"LoadBalancer"}}'
kubectl -n ingress-nginx get svc ingress-nginx-controller
CMD
)" "Das Baremetal-Manifest des Ingress-Controllers legt einen NodePort-Service an. Mit MetalLB bekommt er stattdessen eine eigene Adresse — die Adresse, auf die spaeter alle Hostnamen zeigen.|The ingress controller's baremetal manifest creates a NodePort service. With MetalLB it gets an address of its own instead — the address all your hostnames will later point at."
  cmd "curl -I http://ADRESSE-DES-INGRESS" \
    "Der aussagekraeftigste Einzeltest, noch **ohne** jede Ingress-Regel. Erwartung: **404 Not Found** mit einer Zeile server: nginx. Das klingt nach Fehler, ist aber der Beweis, dass der Controller lebt und erreichbar ist — er hat nur noch keine passende Regel. Kommt stattdessen connection refused oder ein Timeout, ist es kein Ingress-Problem, sondern eines der Adresse.|The single most telling test, still **without** any ingress rule. Expected: **404 Not Found** with a server: nginx line. That looks like a failure but proves the controller is alive and reachable — it simply has no matching rule yet. If you get connection refused or a timeout instead, this is not an ingress problem but an address problem."
  cmd "$(cat <<'CMD'
kubectl create ingress web --class=nginx \
  --rule="web.example.lan/*=web:80"
kubectl get ingress
CMD
)" "Erwartung: Nach ein paar Sekunden steht in der Spalte ADDRESS die Adresse des Controllers. Bleibt sie leer, hat der Controller die Regel nicht angenommen — dann stimmt die Klasse nicht mit dem ueberein, was kubectl get ingressclass oben gezeigt hat.|Expected: after a few seconds the ADDRESS column shows the controller's address. If it stays empty the controller has not taken the rule — then the class does not match what kubectl get ingressclass showed above."
  cmd "curl -H 'Host: web.example.lan' http://ADRESSE-DES-INGRESS" \
    "Der Host-Header ersetzt den DNS-Eintrag fuer den ersten Test. Kommt die nginx-Seite, funktioniert die ganze Kette: MetalLB, Ingress-Controller, Regel, Service, Pod. Die beiden Fehlerbilder sind eindeutig: **404** heisst, die Regel greift nicht — meist ein Tippfehler im Hostnamen. **503** heisst, die Regel greift, aber der Service hat keine bereiten Endpoints. Danach den Namen im DNS oder in /etc/hosts auf dieselbe Adresse zeigen lassen.|The Host header stands in for the DNS record for a first test. If the nginx page appears, the whole chain works: MetalLB, ingress controller, rule, service, pod. The two failure modes are unambiguous: **404** means the rule does not match — usually a typo in the hostname. **503** means the rule matches but the service has no ready endpoints. After that, point the name at the same address in DNS or /etc/hosts."
  cmd "$(cat <<'CMD'
kubectl -n ingress-nginx logs -l app.kubernetes.io/component=controller \
  --tail=20 -f
CMD
)" "Die letzte Instanz bei jedem Ingress-Problem: Der Controller schreibt jede Anfrage mit, samt Statuscode. Taucht dein curl hier auf, ist die Anfrage angekommen und die Ursache liegt in Regel oder Backend. Taucht sie nicht auf, hat sie den Controller nie erreicht — dann ist es das Netz oder die Adresse.|The last resort for any ingress problem: the controller logs every request with its status code. If your curl shows up here, the request arrived and the cause lies in the rule or the backend. If it does not, it never reached the controller — then it is the network or the address."
  cmd "$(cat <<'CMD'
kubectl delete ingress web
kubectl delete svc web
kubectl delete deployment web
CMD
)" "Aufraeumen. MetalLB und der Ingress-Controller bleiben stehen, die brauchst du weiter.|Clean up. MetalLB and the ingress controller stay, you will keep needing those."

  # --- Danach ---
  sec "Danach|Afterwards" cp
  para "Ein frischer Cluster kann noch nichts von aussen annehmen und keinen Speicher bereitstellen. Diese drei Dinge fehlen praktisch immer.|A fresh cluster can neither accept anything from outside nor provide storage. These three are missing practically every time."
  risk warn "Beim Upgrade immer nur eine Minor-Version auf einmal, und kubeadm zuerst. kubelet darf hoechstens eine Minor-Version hinter dem API-Server liegen, niemals davor.|When upgrading, only one minor version at a time, and kubeadm first. The kubelet may trail the API server by at most one minor version, and must never lead it."
  cmd "kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/baremetal/deploy.yaml" \
    "Ein Ingress-Controller, sonst bleibt jeder Ingress wirkungslos. Auf eigener Hardware ist zusaetzlich MetalLB noetig, damit ein Service vom Typ LoadBalancer eine Adresse bekommt.|An ingress controller, otherwise every Ingress stays inert. On your own hardware you also need MetalLB so a LoadBalancer service gets an address."
  cmd "kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml" \
    "Ohne metrics-server liefert kubectl top nichts und ein HorizontalPodAutoscaler skaliert nie.|Without metrics-server, kubectl top returns nothing and a HorizontalPodAutoscaler never scales."
  cmd "# StorageClass: auf eigener Hardware etwa Longhorn oder der local-path-provisioner" \
    "Ohne StorageClass bleibt jedes PersistentVolumeClaim fuer immer Pending.|Without a storage class every PersistentVolumeClaim stays Pending forever."

  # --- Neu aufsetzen ---
  sec "Neu aufsetzen|Starting over" all
  para "Manches laesst sich nachtraeglich nicht mehr aendern: das Pod-Netz, der controlPlaneEndpoint, das Service-Netz. Bei einem Cluster, auf dem noch nichts Produktives liegt, ist der Neuanfang schneller und sicherer als jede Reparatur.|Some things cannot be changed afterwards: the pod network, the controlPlaneEndpoint, the service network. On a cluster with nothing productive on it, starting over is faster and safer than any repair."
  para "**Die Reihenfolge ist wichtig: von aussen nach innen.** Erst alle Worker, dann die weiteren Hauptserver, zuletzt der erste Hauptserver. Wer den ersten Hauptserver zuerst zuruecksetzt, nimmt allen anderen die API — deren reset laeuft dann zwar durch, kann sich aber nicht mehr sauber aus dem Cluster abmelden.|**The order matters: from the outside in.** First all workers, then the further control-plane nodes, and the first control-plane node last. Resetting the first control-plane node first takes the API away from everyone else — their reset still runs, but can no longer deregister cleanly."
  risk err "Auf dem ersten Hauptserver loescht der reset etcd und damit den gesamten Clusterinhalt: alle Deployments, Secrets, ConfigMaps, PVC-Objekte. Was du behalten willst, vorher mit kubectl get -A -o yaml sichern.|On the first control-plane node the reset deletes etcd and with it the entire cluster content: all deployments, secrets, ConfigMaps, PVC objects. Back up whatever you want to keep with kubectl get -A -o yaml first."
  risk warn "Danach von vorn: erst der erste Hauptserver mit kubeadm init, dann das CNI genau einmal, dann die weiteren Hauptserver, zuletzt die Worker. Das CNI gehoert nur auf den ersten Hauptserver — es gilt clusterweit und wird nicht je Knoten angewendet.|Then start from the top: first the initial control-plane node with kubeadm init, then the CNI exactly once, then the further control-plane nodes, and the workers last. The CNI belongs on the first control-plane node only — it applies cluster-wide and is not applied per node."
  cmd "kubectl get nodes -o wide" \
    "Bestandsaufnahme auf dem Hauptserver: Welche Knoten sind ueberhaupt beigetreten? Genau die muessen zurueckgesetzt werden, in der Reihenfolge oben.|Take stock on the control-plane node: which nodes have actually joined? Exactly those need resetting, in the order above."
  cmd "$(cat <<'CMD'
# auf jedem Knoten, Worker zuerst, erster Hauptserver zuletzt
sudo kubeadm reset -f
sudo rm -rf /etc/cni/net.d /etc/kubernetes $HOME/.kube
CMD
)" "Derselbe Befehl auf jeder Maschine. Auf einem Hauptserver loescht er zusaetzlich das etcd-Verzeichnis — damit sind **alle** Objekte des Clusters weg, nicht nur die Konfiguration.|The same command on every machine. On a control-plane node it also deletes the etcd directory — which means **every** object in the cluster is gone, not just the configuration."
  cmd "$(cat <<'CMD'
sudo ip link delete cni0 2>/dev/null
sudo ip link delete flannel.1 2>/dev/null
sudo ip link delete cilium_host 2>/dev/null
sudo iptables -F && sudo iptables -t nat -F && sudo iptables -t mangle -F
sudo systemctl restart containerd
CMD
)" "kubeadm reset raeumt die Netzwerkreste **nicht** mit weg: Bruecken, VXLAN-Geraete und iptables-Regeln des CNI bleiben liegen und stoeren den naechsten Aufbau. Wer sichergehen will, startet den Knoten stattdessen einfach neu — das erledigt dasselbe zuverlaessiger.|kubeadm reset does **not** clean up the network leftovers: the CNI's bridges, VXLAN devices and iptables rules stay behind and disturb the next setup. If you want to be sure, simply reboot the node instead — that does the same thing more reliably."
  cmd "getent hosts ${O_endpoint:-k8s-api.firma.de}" \
    "Vor dem Neuaufbau auf **allen** Knoten pruefen: Loest die API-Adresse auf? Ein Eintrag in /etc/hosts ueberlebt den reset, ein fehlender faellt aber erst beim Beitritt auf.|Check on **every** node before rebuilding: does the API address resolve? An entry in /etc/hosts survives the reset, but a missing one only shows up when joining."
}

# --------------------------------------------------------------- Markdown ----
# Eine Tabelle endet erst, wenn etwas anderes kommt — dann fehlt sonst die Leerzeile.
MD_TBL=0
md_flush(){ [ "$MD_TBL" = 1 ] && { printf '\n'; MD_TBL=0; }; return 0; }
md_sec(){ md_flush; SECN=$((SECN+1)); printf '## %d. %s — %s\n\n' "$SECN" "$(t "$1")" "$(t "$(role_lbl "$2")")"; }
md_para(){ md_flush; printf '%s\n\n' "$(t "$1")"; }
md_thead(){ local c out="|" sep="|"; for c in "$@"; do out="$out $(t "$c") |"; sep="$sep---|"; done
            printf '%s\n%s\n' "$out" "$sep"; MD_TBL=1; }
md_trow(){ local c out="|"; for c in "$@"; do out="$out $(t "$c") |"; done; printf '%s\n' "$out"; }
md_risk(){ md_flush; printf '> **%s** — %s\n\n' "$(risk_lbl "$1")" "$(t "$2")"; }
md_cmd(){ md_flush; printf '```sh\n%s\n```\n\n%s\n\n' "$1" "$(t "$2")"; }

markdown(){
  normalize
  SECN=0
  local de=0; [ "$UILANG" = de ] && de=1
  if [ "$de" = 1 ]; then
    printf '# Kubernetes-Cluster aufsetzen\n\n| Angabe | Wert |\n|---|---|\n'
  else
    printf '# Setting up a Kubernetes cluster\n\n| Setting | Value |\n|---|---|\n'
  fi
  local osl runl noend
  [ "$O_os" = apt ] && osl="Debian / Ubuntu" || osl="RHEL / Rocky"
  [ "$O_runtime" = crio ] && runl="CRI-O" || runl="containerd"
  noend=$(t "IP des ersten Hauptservers|first control-plane node's IP")
  printf '| %s | `v%s` |\n' "$(t 'Version|Version')" "$O_version"
  printf '| %s | `%s` |\n' "$(t 'Betriebssystem|Operating system')" "$osl"
  printf '| Runtime | `%s` |\n' "$runl"
  printf '| CNI | `%s` |\n' "$O_cni"
  printf '| %s | `%s` |\n' "$(t 'API-Adresse|API address')" "${O_endpoint:-$noend}"
  printf '| %s | `%s` |\n' "$(t 'Hauptserver|Control-plane nodes')" "$([ "$O_ha" = 1 ] && echo 3 || echo 1)"
  printf '| Worker | `%s` |\n' "$O_workers"
  printf '| %s | `%s` |\n\n' "$(t 'Pod-Netz|Pod network')" "$O_podCidr"
  R=md guide
}

# ------------------------------------------------------------------- Text ----
TXTW=78
wrapped(){ printf '%s\n' "$1" | fold -s -w "$((TXTW-4))" | sed 's/^/    /'; }
txt_sec(){
  SECN=$((SECN+1))
  local h; h=$(printf '%02d · %s   [%s]' "$SECN" "$(t "$1")" "$(t "$(role_lbl "$2")")")
  printf '\n%s\n' "$h"
  printf '%s\n\n' "$(printf '%*s' "${#h}" '' | tr ' ' '-')"
}
txt_para(){ wrapped "$(plain "$(t "$1")")"; printf '\n'; }
# Vier Spalten passen in kein Terminal — je Zeile ein Schluessel, darunter der Rest.
txt_thead(){ local c out=""; for c in "$@"; do out="$out · $(plain "$(t "$c")")"; done
             printf '    %s\n\n' "${out# · }"; }
txt_trow(){ local c first=1 rest=""
  for c in "$@"; do
    if [ "$first" = 1 ]; then printf '    %s\n' "$(plain "$(t "$c")")"; first=0
    else rest="$rest · $(plain "$(t "$c")")"; fi
  done
  printf '%s\n' "${rest# · }" | fold -s -w "$((TXTW-6))" | sed 's/^/      /'
  printf '\n'; }
txt_risk(){ printf '  %s %s\n' "$([ "$1" = err ] && echo '!' || echo '?')" "$(risk_lbl "$1")"
            wrapped "$(plain "$(t "$2")")"; printf '\n'; }
txt_cmd(){ printf '%s\n' "$1" | sed 's/^/  $ /'
           wrapped "$(plain "$(t "$2")")"; printf '\n'; }

text_guide(){ normalize; SECN=0
  printf '%s\n' "$(t 'Kubernetes-Cluster aufsetzen|Setting up a Kubernetes cluster')"
  printf '%s\n' "$(config_line)"
  R=txt guide
}
config_line(){
  local osl runl
  [ "$O_os" = apt ] && osl="Debian/Ubuntu" || osl="RHEL/Rocky"
  [ "$O_runtime" = crio ] && runl="CRI-O" || runl="containerd"
  printf 'v%s · %s · %s · %s · %s · %s %s · %s Worker%s%s' \
    "$O_version" "$osl" "$runl" "$O_cni" "$O_podCidr" \
    "$([ "$O_ha" = 1 ] && echo 3 || echo 1)" "$(t 'Hauptserver|control plane')" "$O_workers" \
    "$([ "$O_singleNode" = 1 ] && echo " · $(t 'Pods auch auf dem Hauptserver|pods on control plane')" || echo "")" \
    "$([ -n "$O_endpoint" ] && echo " · $O_endpoint" || echo "")"
}

# ----------------------------------------------------- Abschnitte auflisten --
# Gibt "nummer<TAB>ueberschrift<TAB>rolle<TAB>anzahl befehle" aus.
ls_sec(){ [ "$SECN" -gt 0 ] && printf '%d\t%s\t%s\t%d\n' "$SECN" "$LS_H" "$LS_ROLE" "$LS_N"
          SECN=$((SECN+1)); LS_H=$(t "$1"); LS_ROLE=$2; LS_N=0; }
ls_para(){ :; }; ls_thead(){ :; }; ls_trow(){ :; }; ls_risk(){ :; }
ls_cmd(){ LS_N=$((LS_N+1)); }
sections(){ SECN=0; LS_H=""; LS_ROLE=all; LS_N=0
  R=ls guide
  [ "$SECN" -gt 0 ] && printf '%d\t%s\t%s\t%d\n' "$SECN" "$LS_H" "$LS_ROLE" "$LS_N"
  return 0; }

# -------------------------------------------------------- Script-Export ------
# Erzeugt ein eigenstaendiges Script aus den gewaehlten Abschnitten.
SELECTED=""
sel_has(){ case " $SELECTED " in *" $1 "*) return 0;; esac; return 1; }

# Befehle mit Platzhaltern darf niemand blind ausfuehren.
has_placeholder(){
  printf '%s' "$1" | grep -qE '<[A-Z_-]+>|ADRESSE-|ANGEZEIGTER-|STABILE-ADRESSE|IP-DES-HAUPTSERVERS'
}

sh_sec(){ SECN=$((SECN+1)); SH_CUR=$SECN
  sel_has "$SECN" || return 0
  printf '\n# ---------------------------------------------------------------------------\n'
  printf 'section %s\n\n' "$(shq "$(printf '%02d · %s [%s]' "$SECN" "$(t "$1")" "$(t "$(role_lbl "$2")")")")"; }
sh_para(){ sel_has "$SH_CUR" || return 0; printf '%s\n' "$(plain "$(t "$1")" | fold -s -w 74 | sed 's/^/# /')"; printf '\n'; }
sh_thead(){ :; }; sh_trow(){ :; }
sh_risk(){ sel_has "$SH_CUR" || return 0
  printf 'note %s %s\n\n' "$1" "$(shq "$(plain "$(t "$2")")")"; }
sh_cmd(){ sel_has "$SH_CUR" || return 0
  printf '%s\n' "$(plain "$(t "$2")" | fold -s -w 74 | sed 's/^/# /')"
  if has_placeholder "$1"; then printf 'manual <<'"'"'K8SCMD'"'"'\n%s\nK8SCMD\n\n' "$1"
  else printf 'run <<'"'"'K8SCMD'"'"'\n%s\nK8SCMD\n\n' "$1"; fi; }

shq(){ printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"; }

export_script(){
  normalize
  cat <<'HEAD'
#!/usr/bin/env bash
#
# Erzeugt von cluster-setup.sh (k8s-wizard). Jeder Befehl wird angezeigt und
# erst nach Bestaetigung ausgefuehrt; mit -y laeuft alles ohne Rueckfrage.
# Befehle mit Platzhaltern (<TOKEN>, ADRESSE-...) werden nur angezeigt.

set -uo pipefail
AUTO=0
[ "${1:-}" = "-y" ] && AUTO=1

section(){ printf '\n\033[1m== %s\033[0m\n\n' "$1"; }
note(){ [ "$1" = err ] && printf '\033[31m! %s\033[0m\n\n' "$2" || printf '\033[33m? %s\033[0m\n\n' "$2"; }

manual(){
  local c; c=$(cat)
  printf '\033[33m-- von Hand, Platzhalter ausfuellen:\033[0m\n%s\n\n' "$c"
}

# Das Terminal nur benutzen, wenn es sich auch oeffnen laesst — beim Aufruf
# ueber eine Pipe (curl ... | bash) gibt es keines.
TTY_OK=0
{ : </dev/tty; } 2>/dev/null && TTY_OK=1

ask(){ # frage -> antwort in REPLY_
  REPLY_=""
  printf '%s' "$1"
  if [ "$TTY_OK" = 1 ]; then read -r REPLY_ </dev/tty || true; else read -r REPLY_ || true; fi
}

run(){
  local c; c=$(cat)
  printf '\033[36m$ %s\033[0m\n' "$c"
  if [ "$AUTO" != 1 ]; then
    ask 'ausfuehren? [j/N/q] '
    case $REPLY_ in q|Q) echo abgebrochen; exit 0;; j|J|y|Y) :;; *) echo '  uebersprungen'; return 0;; esac
  fi
  bash -c "$c" || { printf '\033[31mfehlgeschlagen (exit %d)\033[0m\n' "$?"
                    if [ "$AUTO" = 1 ]; then exit 1; fi
                    ask 'weiter? [j/N] '
                    case $REPLY_ in j|J|y|Y) return 0;; *) exit 1;; esac; }
}
HEAD
  printf '\n# %s\n' "$(config_line)"
  SECN=0
  R=sh guide
  printf '\nprintf %s\n' "'\\n\\033[32mfertig\\033[0m\\n'"
}

# ------------------------------------------------------------- Oberflaeche ---
DLG=""
pick_dialog(){
  if [ "${NOTUI:-0}" = 1 ]; then DLG=""; return; fi
  if command -v whiptail >/dev/null 2>&1; then DLG=whiptail
  elif command -v dialog >/dev/null 2>&1; then DLG=dialog
  else DLG=""; fi
}
BH=20; BW=76; MH=10
size(){
  local l c
  l=$(tput lines 2>/dev/null || echo 24); c=$(tput cols 2>/dev/null || echo 80)
  BH=$((l-6)); [ "$BH" -lt 14 ] && BH=14
  BW=$((c-6)); [ "$BW" -lt 60 ] && BW=60; [ "$BW" -gt 100 ] && BW=100
  MH=$((BH-9)); [ "$MH" -lt 5 ] && MH=5
  TXTW=$((BW-6)); [ "$TXTW" -lt 50 ] && TXTW=50
}

# Ohne whiptail wird gelesen — vom Terminal, wenn sich eins oeffnen laesst,
# sonst von stdin. Letzteres macht den Ablauf skriptbar.
TTY_OK=0
{ : </dev/tty; } 2>/dev/null && TTY_OK=1
ANSWER=""
ask_line(){
  ANSWER=""
  if [ "$TTY_OK" = 1 ]; then read -r ANSWER </dev/tty || true; else read -r ANSWER || true; fi
}

ui_msg(){ # titel text
  if [ -n "$DLG" ]; then "$DLG" --title "$1" --msgbox "$2" "$BH" "$BW"
  else printf '\n== %s\n%s\n' "$1" "$2"; fi
}
ui_yesno(){ # titel text  -> 0 = ja
  if [ -n "$DLG" ]; then "$DLG" --title "$1" --yesno "$2" 15 "$BW"
  else printf '\n== %s\n%s\n[j/N] ' "$1" "$2"; ask_line; case $ANSWER in j|J|y|Y) return 0;; *) return 1;; esac; fi
}
ui_input(){ # titel text vorgabe -> stdout
  if [ -n "$DLG" ]; then "$DLG" --title "$1" --inputbox "$2" 15 "$BW" "$3" 3>&1 1>&2 2>&3
  else printf '\n== %s\n%s\n[%s] ' "$1" "$2" "$3" >&2; ask_line
       [ -z "$ANSWER" ] && ANSWER=$3; printf '%s' "$ANSWER"; fi
}
ui_menu(){ # titel text tag item tag item ...
  local title=$1 text=$2; shift 2
  if [ -n "$DLG" ]; then "$DLG" --title "$title" --menu "$text" "$BH" "$BW" "$MH" "$@" 3>&1 1>&2 2>&3
  else
    printf '\n== %s\n%s\n' "$title" "$text" >&2
    local i=1
    while [ "$#" -gt 0 ]; do printf '  %-6s %s\n' "$1" "$2" >&2; shift 2; i=$((i+1)); done
    printf '> ' >&2; ask_line; printf '%s' "$ANSWER"
  fi
}
ui_check(){ # titel text tag item status ...
  local title=$1 text=$2; shift 2
  if [ -n "$DLG" ]; then
    "$DLG" --title "$title" --checklist "$text" "$BH" "$BW" "$MH" "$@" 3>&1 1>&2 2>&3
  else
    printf '\n== %s\n%s\n' "$title" "$text" >&2
    local pre=""
    while [ "$#" -gt 0 ]; do
      printf '  %-4s %s%s\n' "$1" "$2" "$([ "$3" = on ] && echo ' *')" >&2
      [ "$3" = on ] && pre="$pre $1"
      shift 3
    done
    printf '%s [%s] ' "$(t 'Nummern, Leerzeichen getrennt|numbers, space separated')" "${pre# }" >&2
    ask_line; [ -z "$ANSWER" ] && ANSWER=$pre; printf '%s' "$ANSWER"
  fi
}
ui_file(){ # titel text vorgabe
  if [ -n "$DLG" ]; then "$DLG" --title "$1" --inputbox "$2" 12 "$BW" "$3" 3>&1 1>&2 2>&3
  else ui_input "$1" "$2" "$3"; fi
}
ui_view(){ # titel datei
  if [ -n "$DLG" ]; then "$DLG" --title "$1" --scrolltext --textbox "$2" "$BH" "$BW"
  elif [ "$TTY_OK" = 1 ]; then "${PAGER:-less}" -R "$2" </dev/tty
  else cat "$2"; fi
}

# ------------------------------------------------------ Einstellungen-Menue --
onoff(){ [ "$1" = 1 ] && echo "[x]" || echo "[ ]"; }
toggle(){ [ "$1" = 1 ] && echo 0 || echo 1; }

# Auswahl in eine Variable, die bei Abbruch ihren alten Wert behaelt.
pick(){
  local var=$1 title=$2 text=$3; shift 3
  local old=${!var} new
  new=$(ui_menu "$title" "$text" "$@") || new=""
  [ -n "$new" ] && printf -v "$var" '%s' "$new" || printf -v "$var" '%s' "$old"
}

settings_menu(){
  while :; do
    normalize
    local warn="" line
    while IFS=$'\t' read -r lvl msg; do
      [ -z "$lvl" ] && continue
      warn="$warn
$([ "$lvl" = err ] && echo '!' || echo '?') $msg"
    done < <(config_checks)
    line=$(config_line)
    local sel
    sel=$(ui_menu "$(t 'Einstellungen|Settings')" "$line
$warn" \
      version   "$(t 'Kubernetes-Version|Kubernetes version'): $O_version" \
      os        "$(t 'Betriebssystem|Operating system'): $([ "$O_os" = apt ] && echo 'Debian / Ubuntu' || echo 'RHEL / Rocky / AlmaLinux')" \
      runtime   "$(t 'Container-Runtime|Container runtime'): $([ "$O_runtime" = crio ] && echo 'CRI-O' || echo containerd)" \
      cni       "$(t 'Netzwerk (CNI)|Networking (CNI)'): $O_cni" \
      endpoint  "$(t 'API-Adresse|API address'): ${O_endpoint:-—}" \
      ha        "$(onoff "$O_ha") $(t 'Mehrere Hauptserver (Hochverfuegbarkeit)|Several control-plane nodes (high availability)')" \
      workers   "$(t 'Anzahl Worker|Number of workers'): $O_workers" \
      podCidr   "$(t 'Pod-Netz|Pod network'): $O_podCidr" \
      svcCidr   "$(t 'Service-Netz|Service network'): ${O_svcCidr:-$(t 'Vorgabe 10.96.0.0/12|default 10.96.0.0/12')}" \
      single    "$(onoff "$O_singleNode") $(t 'Auch auf dem Hauptserver Pods zulassen|Run pods on the control plane too')" \
      firewall  "$(onoff "$O_firewall") $(t 'Firewall-Regeln mit ausgeben|Include firewall rules')" \
      lbRange   "$(t 'MetalLB-Adressbereich|MetalLB address range'): $O_lbRange" \
      zurueck   "« $(t 'zurueck|back')") || return 0
    case $sel in
      version)  O_version=$(ui_input "$(t 'Kubernetes-Version|Kubernetes version')" \
                  "$(t 'Nur Major.Minor — daraus entsteht die Paketquelle.|Major.minor only — the package repository is derived from it.')" "$O_version");;
      os)       pick O_os "$(t 'Betriebssystem|Operating system')" "" \
                  apt "Debian / Ubuntu" dnf "RHEL / Rocky / AlmaLinux";;
      runtime)  pick O_runtime "$(t 'Container-Runtime|Container runtime')" "" \
                  containerd "containerd" crio "CRI-O";;
      cni)      pick O_cni "$(t 'Netzwerk (CNI)|Networking (CNI)')" "" \
                  cilium  "$(t 'Cilium — eBPF, ohne kube-proxy moeglich|Cilium — eBPF, can replace kube-proxy')" \
                  calico  "$(t 'Calico — verbreitet, NetworkPolicy inklusive|Calico — widespread, network policy included')" \
                  flannel "$(t 'Flannel — einfach, ohne NetworkPolicy|Flannel — simple, no network policy')";;
      endpoint) O_endpoint=$(ui_input "$(t 'API-Adresse|API address')" \
                  "$(t 'Name oder VIP, unter dem der API-Server erreichbar ist. Leer lassen heisst: die IP des ersten Hauptservers — die laesst sich spaeter nicht mehr aendern. Fuer mehrere Hauptserver ist die Angabe zwingend.|Name or VIP the API server answers on. Empty means the first control-plane node IP — which cannot be changed later. With several control-plane nodes it is mandatory.')" "$O_endpoint");;
      ha)       O_ha=$(toggle "$O_ha");;
      workers)  local w; w=$(ui_input "$(t 'Anzahl Worker|Number of workers')" "" "$O_workers")
                case $w in ''|*[!0-9]*) ui_msg "$(t 'Ungueltig|Invalid')" "$(t 'Bitte eine Zahl.|Please enter a number.')";; *) O_workers=$w;; esac;;
      podCidr)  O_podCidr=$(ui_input "$(t 'Pod-Netz|Pod network')" \
                  "$(t 'Darf sich mit keinem Netz ueberschneiden, das die Knoten sonst benutzen.|Must not overlap with any network the nodes already use.')" "$O_podCidr");;
      svcCidr)  O_svcCidr=$(ui_input "$(t 'Service-Netz|Service network')" \
                  "$(t 'Leer laesst kubeadm die Vorgabe 10.96.0.0/12 nehmen.|Empty lets kubeadm use its default of 10.96.0.0/12.')" "$O_svcCidr");;
      single)   O_singleNode=$(toggle "$O_singleNode");;
      firewall) O_firewall=$(toggle "$O_firewall");;
      lbRange)  O_lbRange=$(ui_input "$(t 'MetalLB-Adressbereich|MetalLB address range')" \
                  "$(t 'Freier Bereich im Netz der Knoten, ausserhalb des DHCP-Bereichs des Routers.|A free range in the nodes network, outside the router DHCP range.')" "$O_lbRange");;
      zurueck|"") return 0;;
    esac
  done
}

# ------------------------------------------------------- Abschnittsauswahl ---
# Rolle -> Vorauswahl. Gibt die Auswahl in SELECTED zurueck.
choose_sections(){
  local role
  role=$(ui_menu "$(t 'Welche Rolle hat dieser Rechner?|What is this machine?')" \
    "$(t 'Die Vorauswahl richtet sich danach; einzelne Abschnitte lassen sich danach noch an- und abwaehlen.|The preselection follows from this; individual sections can still be toggled afterwards.')" \
    cp     "$(t 'Hauptserver|Control-plane node')" \
    worker "Worker" \
    all    "$(t 'alles anzeigen|show everything')") || return 1
  [ -z "$role" ] && return 1

  local args=() n h r cnt pre
  while IFS=$'\t' read -r n h r cnt; do
    pre=off
    case $role in
      all) pre=on;;
      cp)     { [ "$r" = all ] || [ "$r" = cp ]; }     && pre=on;;
      worker) { [ "$r" = all ] || [ "$r" = worker ]; } && pre=on;;
    esac
    # "Neu aufsetzen" ist ein Notausgang, nie Teil einer normalen Installation.
    case $h in "Neu aufsetzen"|"Starting over"|"Wenn der Endpoint fehlt"|"If the endpoint is missing") pre=off;; esac
    args+=("$n" "$h ($cnt) [$(t "$(role_lbl "$r")")]" "$pre")
  done < <(sections)

  local out
  out=$(ui_check "$(t 'Abschnitte|Sections')" "$(t 'Leertaste waehlt aus.|Space toggles.')" "${args[@]}") || return 1
  SELECTED=$(printf '%s' "$out" | tr -d '"')
  [ -n "$SELECTED" ]
}

# ------------------------------------------------------------- Ausfuehren ----
ABORT=0
EX_CUR=0
EX_H=""
ex_sec(){ SECN=$((SECN+1)); EX_CUR=$SECN; EX_H="$(t "$1")"; EX_SHOWN=0; EX_RISKS=""; }
ex_para(){ :; }; ex_thead(){ :; }; ex_trow(){ :; }
ex_risk(){ [ "$ABORT" = 1 ] && return 0; sel_has "$EX_CUR" || return 0
  EX_RISKS="$EX_RISKS
$([ "$1" = err ] && echo '!' || echo '?') $(plain "$(t "$2")")"; }
ex_cmd(){
  [ "$ABORT" = 1 ] && return 0
  sel_has "$EX_CUR" || return 0
  if [ "${EX_SHOWN:-0}" = 0 ]; then
    EX_SHOWN=1
    if [ -n "$EX_RISKS" ]; then
      ui_msg "$(printf '%02d · %s' "$EX_CUR" "$EX_H")" "$EX_RISKS"
      EX_RISKS=""
    fi
  fi
  step_run "$1" "$(plain "$(t "$2")")" "$(printf '%02d · %s' "$EX_CUR" "$EX_H")"
}

step_run(){
  local c=$1 d=$2 title=$3
  while :; do
    local hint="" choice
    if has_placeholder "$c"; then
      hint="
$(t '! Dieser Befehl enthaelt Platzhalter — vor dem Ausfuehren ausfuellen.|! This command contains placeholders — fill them in before running.')"
    fi
    choice=$(ui_menu "$title" "$d
$hint
\$ $c" \
      run    "$(t 'ausfuehren|run')" \
      edit   "$(t 'bearbeiten und ausfuehren|edit and run')" \
      skip   "$(t 'ueberspringen|skip')" \
      stop   "$(t 'abbrechen|abort')") || { ABORT=1; return 0; }
    case $choice in
      skip|"") return 0;;
      stop)    ABORT=1; return 0;;
      edit)
        local nc; nc=$(ui_input "$title" "$(t 'Befehl|Command')" "$c") || return 0
        [ -n "$nc" ] && c=$nc
        continue;;
      run)
        local log; log=$(mktemp)
        {
          printf '$ %s\n\n' "$c"
          bash -c "$c" 2>&1
          printf '\n[exit %d]\n' "$?"
        } | tee "$log" >/dev/null
        local rc; rc=$(tail -1 "$log" | tr -dc '0-9')
        ui_view "$title" "$log"
        rm -f "$log"
        if [ -n "$rc" ] && [ "$rc" != 0 ]; then
          ui_yesno "$(t 'Fehlgeschlagen|Failed')" \
            "$(t 'Der Befehl endete mit einem Fehler. Trotzdem weitermachen?|The command ended with an error. Continue anyway?')" || { ABORT=1; return 0; }
        fi
        return 0;;
    esac
  done
}

run_mode(){
  ui_yesno "$(t 'Auf diesem Rechner ausfuehren|Run on this machine')" \
    "$(t 'Die folgenden Befehle veraendern diesen Rechner: Swap aus, Pakete installieren, Dienste starten, gegebenenfalls kubeadm init. Vor jedem Befehl wird gefragt.

Fortfahren?|The following commands change this machine: swap off, install packages, start services, possibly kubeadm init. Every command asks first.

Continue?')" || return 0
  choose_sections || return 0
  if ! command -v sudo >/dev/null 2>&1 && [ "$(id -u)" != 0 ]; then
    ui_msg "sudo" "$(t 'sudo fehlt und du bist nicht root — die Befehle werden scheitern.|sudo is missing and you are not root — the commands will fail.')"
  fi
  ABORT=0; SECN=0; EX_RISKS=""
  R=ex guide
  if [ "$ABORT" = 1 ]; then ui_msg "$(t 'Abgebrochen|Aborted')" "$(t 'Nichts weiter ausgefuehrt.|Nothing further was run.')"
  else ui_msg "$(t 'Fertig|Done')" "$(t 'Alle gewaehlten Schritte sind durch.|All selected steps are through.')"; fi
}

# ------------------------------------------------------------- Hauptmenue ----
save_config(){
  mkdir -p "$(dirname "$CONFIG")" 2>/dev/null
  {
    printf '# k8s-wizard cluster-setup\n'
    local k
    for k in version os runtime cni endpoint ha workers podCidr svcCidr singleNode firewall lbRange; do
      local v="O_$k"; printf '%s=%s\n' "$k" "${!v}"
    done
  } > "$CONFIG"
}
load_config(){
  [ -r "$1" ] && [ ! -d "$1" ] || return 1
  local k v
  while IFS='=' read -r k v; do
    case $k in
      ''|\#*) continue;;
      version|os|runtime|cni|endpoint|ha|workers|podCidr|svcCidr|singleNode|firewall|lbRange)
        printf -v "O_$k" '%s' "$v";;
    esac
  done < "$1"
}

show_guide(){
  local f; f=$(mktemp)
  text_guide > "$f"
  ui_view "$(t 'Anleitung|Guide')" "$f"
  rm -f "$f"
}

save_markdown(){
  local f; f=$(ui_file "Markdown" "$(t 'Wohin speichern?|Where to save?')" "$PWD/cluster-installation.md") || return 0
  [ -z "$f" ] && return 0
  markdown > "$f" && ui_msg "Markdown" "$(t 'Gespeichert:|Saved:') $f"
}

save_script(){
  choose_sections || return 0
  local f; f=$(ui_file "Script" "$(t 'Wohin speichern?|Where to save?')" "$PWD/cluster-install.sh") || return 0
  [ -z "$f" ] && return 0
  export_script > "$f" && chmod +x "$f"
  ui_msg "Script" "$(t 'Gespeichert:|Saved:') $f

$(t 'Aufruf auf dem Zielrechner: bash|Run on the target machine: bash') $(basename "$f")   ($(t 'mit -y ohne Rueckfragen|with -y for no prompts'))"
}

main_menu(){
  while :; do
    normalize
    local sel
    sel=$(ui_menu "k8s-wizard · $(t 'Cluster aufsetzen|Setting up a cluster')" "$(config_line)" \
      set    "$(t 'Einstellungen|Settings')" \
      show   "$(t 'Anleitung anzeigen|Show the guide')" \
      md     "$(t 'Als Markdown speichern|Save as Markdown')" \
      script "$(t 'Als Shell-Script exportieren|Export as a shell script')" \
      run    "$(t 'Schritte auf diesem Rechner ausfuehren|Run the steps on this machine')" \
      save   "$(t 'Einstellungen sichern|Save settings')" \
      lang   "$(t 'Sprache: Deutsch|Language: English')" \
      quit   "$(t 'Beenden|Quit')") || return 0
    case $sel in
      set)    settings_menu;;
      show)   show_guide;;
      md)     save_markdown;;
      script) save_script;;
      run)    run_mode;;
      save)   save_config; ui_msg "$(t 'Gesichert|Saved')" "$CONFIG";;
      lang)   [ "$UILANG" = de ] && UILANG=en || UILANG=de;;
      quit|"") return 0;;
    esac
  done
}

# -------------------------------------------------------------- Selbsttest ---
TESTS=0; FAILS=0
ok(){ TESTS=$((TESTS+1))
  if [ "$2" = 1 ]; then printf 'ok   %s\n' "$1"
  else FAILS=$((FAILS+1)); printf 'FAIL %s\n' "$1"; fi; }
has(){ printf '%s' "$1" | grep -qF -- "$2" && echo 1 || echo 0; }
selftest(){
  local out
  O_cni=cilium O_ha=0 O_endpoint="" O_podCidr="" O_os=apt O_runtime=containerd
  O_firewall=0 O_singleNode=0 O_svcCidr="" O_workers=3; normalize
  out=$(markdown)
  ok "Pod-Netz voreingestellt"        "$(has "$out" '10.244.0.0/16')"
  ok "kubeadm init ohne Endpoint"     "$([ "$(has "$out" '--control-plane-endpoint')" = 0 ] && echo 1 || echo 0)"
  ok "Cilium wird installiert"        "$(has "$out" 'cilium install')"
  ok "apt-Paketquelle v1.34"          "$(has "$out" 'core:/stable:/v1.34/deb')"
  ok "kein Firewall-Abschnitt"        "$([ "$(has "$out" 'firewall-cmd')" = 0 ] && echo 1 || echo 0)"
  ok "Worker-Anzahl im Text"          "$(has "$out" 'Auf allen 3 Workern')"

  O_ha=1; O_endpoint=""; normalize
  out=$(markdown)
  ok "HA ohne Endpoint meldet Fehler" "$(has "$out" 'controlPlaneEndpoint')"
  ok "HA: Platzhalter STABILE-ADRESSE" "$(has "$out" 'STABILE-ADRESSE:6443')"
  ok "HA: --upload-certs"             "$(has "$out" '--upload-certs')"
  ok "HA: certificate-key in Tabelle" "$(has "$out" '<KEY>')"

  O_endpoint="k8s-api.firma.de"; normalize
  out=$(markdown)
  ok "Endpoint landet im init"        "$(has "$out" '--control-plane-endpoint=k8s-api.firma.de:6443')"
  ok "Endpoint landet im join"        "$(has "$out" 'kubeadm join k8s-api.firma.de:6443')"

  O_ha=0 O_os=dnf O_runtime=crio O_cni=calico O_firewall=1 O_singleNode=1
  O_svcCidr="10.96.0.0/12" O_podCidr="10.10.0.0/16"; normalize
  out=$(markdown)
  ok "dnf statt apt"                  "$([ "$(has "$out" 'apt-get install -y kubelet')" = 0 ] && echo 1 || echo 0)"
  ok "SELinux-Schritt nur bei dnf"    "$(has "$out" 'SELINUX=permissive')"
  ok "CRI-O statt containerd"         "$(has "$out" 'install -y cri-o')"
  ok "Calico statt Cilium"            "$(has "$out" 'calico.yaml')"
  ok "Firewall-Abschnitt vorhanden"   "$(has "$out" '179/tcp')"
  ok "Taint wird entfernt"            "$(has "$out" 'control-plane-')"
  ok "Service-Netz uebernommen"       "$(has "$out" '--service-cidr=10.96.0.0/12')"

  O_podCidr="10.10.0.0/24"; normalize
  ok "zu kleines Pod-Netz ist ein Fehler" "$(config_checks | grep -q '^err' && echo 1 || echo 0)"
  O_podCidr="10.10.0.0/16"; normalize
  ok "/16 ist kein Fehler"            "$(config_checks | grep -q '^err' && echo 0 || echo 1)"
  O_podCidr="192.168.5.0/16"; normalize
  ok "192.168 wird gewarnt"           "$(config_checks | grep -q '^warn' && echo 1 || echo 0)"
  O_cni=flannel O_podCidr="10.10.0.0/16"; normalize
  ok "Flannel besteht auf 10.244"     "$(config_checks | grep -q '^err' && echo 1 || echo 0)"
  O_podCidr="10.244.0.0/16"; normalize
  ok "Flannel mit 10.244 ist still"   "$(config_checks | grep -q '^err' && echo 0 || echo 1)"

  O_cni=cilium O_podCidr=""; normalize
  ok "Platzhalter erkannt"            "$(has_placeholder 'kubeadm join x --token <TOKEN>' && echo 1 || echo 0)"
  ok "normaler Befehl ist keiner"     "$(has_placeholder 'kubectl get nodes -o wide' && echo 0 || echo 1)"

  SELECTED=$(sections | cut -f1 | tr '\n' ' ')
  out=$(export_script)
  ok "Export ist syntaktisch gueltig" "$(printf '%s' "$out" | bash -n 2>/dev/null && echo 1 || echo 0)"
  ok "Export nutzt manual bei Platzhaltern" "$(has "$out" 'manual <<')"
  SELECTED="1"
  out=$(export_script)
  ok "Auswahl begrenzt den Export"    "$([ "$(has "$out" 'kubeadm join')" = 0 ] && echo 1 || echo 0)"

  UILANG=en; out=$(markdown); UILANG=de
  ok "Englisch uebersetzt die Ueberschrift" "$(has "$out" 'First control-plane node')"
  ok "Englisch laesst Befehle unveraendert" "$(has "$out" 'sudo swapoff -a')"

  out=$(text_guide)
  ok "Textausgabe ohne Markdown-Sternchen" "$([ "$(has "$out" '**')" = 0 ] && echo 1 || echo 0)"
  ok "Anzahl Abschnitte"              "$([ "$(sections | wc -l)" -ge 8 ] && echo 1 || echo 0)"

  printf '\n%d %s, %d %s\n' "$TESTS" "Zusicherungen" "$FAILS" "fehlgeschlagen"
  [ "$FAILS" = 0 ]
}

# ------------------------------------------------------------------- CLI -----
usage(){
  cat <<EOF
$SELF $VERSION_SELF — Kubernetes-Cluster aufsetzen, als Terminal-Fassung des
Wizard-Panels "Cluster".

  $SELF                        Oberflaeche starten (whiptail oder dialog)
  $SELF --md [DATEI]           Anleitung als Markdown ausgeben
  $SELF --text                 Anleitung als Text ausgeben
  $SELF --script [DATEI]       ausfuehrbares Script erzeugen (alle Abschnitte)
  $SELF --sections             Abschnitte auflisten
  $SELF --selftest             Selbsttests

Optionen (auch kombinierbar):
  --set KEY=WERT   version os runtime cni endpoint ha workers podCidr
                   svcCidr singleNode firewall lbRange
  --config DATEI   Einstellungen laden (Vorgabe: $CONFIG)
  --only "1 3 5"   Abschnitte fuer --script auswaehlen
  --lang de|en     Sprache
  --no-tui         ohne whiptail/dialog, reine Textabfragen
  -h, --help       diese Hilfe

Beispiel:
  $SELF --set cni=calico --set ha=1 --set endpoint=k8s-api.firma.de --md k8s.md
EOF
}

ACTION=""
ARG=""
ONLY=""
load_config "$CONFIG" 2>/dev/null

while [ $# -gt 0 ]; do
  case $1 in
    --md|--markdown) ACTION=md;   [ $# -gt 1 ] && case ${2-} in -*|"") :;; *) ARG=$2; shift;; esac;;
    --text)          ACTION=text;;
    --script)        ACTION=script; [ $# -gt 1 ] && case ${2-} in -*|"") :;; *) ARG=$2; shift;; esac;;
    --sections)      ACTION=sections;;
    --selftest)      ACTION=selftest;;
    --only)          ONLY=$2; shift;;
    --set)           k=${2%%=*}; v=${2#*=}
                     case $k in
                       version|os|runtime|cni|endpoint|ha|workers|podCidr|svcCidr|singleNode|firewall|lbRange)
                         printf -v "O_$k" '%s' "$v";;
                       *) printf 'unbekannte Einstellung: %s\n' "$k" >&2; exit 2;;
                     esac; shift;;
    --config)        load_config "$2" || { printf 'nicht lesbar: %s\n' "$2" >&2; exit 2; }; shift;;
    --lang)          UILANG=$2; shift;;
    --no-tui)        NOTUI=1;;
    -h|--help)       usage; exit 0;;
    *)               printf 'unbekannt: %s\n' "$1" >&2; usage >&2; exit 2;;
  esac
  shift
done

normalize

case $ACTION in
  md)       if [ -n "$ARG" ]; then markdown > "$ARG"; printf 'geschrieben: %s\n' "$ARG"; else markdown; fi;;
  text)     text_guide;;
  sections) sections | while IFS=$'\t' read -r n h r c; do printf '%2s  %-34s %-22s %s\n' "$n" "$h" "$(t "$(role_lbl "$r")")" "$c"; done;;
  script)   SELECTED=${ONLY:-$(sections | cut -f1 | tr '\n' ' ')}
            if [ -n "$ARG" ]; then export_script > "$ARG"; chmod +x "$ARG"; printf 'geschrieben: %s\n' "$ARG"
            else export_script; fi;;
  selftest) selftest;;
  *)        pick_dialog; size
            if [ -z "$DLG" ] && [ "${NOTUI:-0}" != 1 ]; then
              printf 'Weder whiptail noch dialog gefunden — Textmodus.\n'
              printf '  Debian/Ubuntu: sudo apt-get install whiptail\n'
              printf '  RHEL/Rocky:    sudo dnf install newt\n\n'
            fi
            main_menu
            clear 2>/dev/null
            ;;
esac
