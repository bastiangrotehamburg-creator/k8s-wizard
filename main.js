"use strict";

const RESERVED = /^(y|Y|yes|Yes|YES|n|N|no|No|NO|true|True|TRUE|false|False|FALSE|on|On|ON|off|Off|OFF|null|Null|NULL|~)$/;

const EMPTY_MAP = "\u0000{}";
const EMPTY_STR = "\u0000es";

function scalarStr(v){
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  if (v === EMPTY_STR) return '""';
  const s = String(v);
  if (s === "") return '""';
  if (RESERVED.test(s)) return JSON.stringify(s);
  if (/^\s|\s$/.test(s)) return JSON.stringify(s);
  if (/^[-?:,\[\]{}#&*!|>'"%@`]/.test(s)) return JSON.stringify(s);
  if (/:(\s|$)/.test(s) || /\s#/.test(s)) return JSON.stringify(s);
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return JSON.stringify(s);
  if (/^0[xob]/i.test(s)) return JSON.stringify(s);
  return s;
}

function isEmpty(v){
  if (v === undefined || v === null || v === "") return true;
  if (Array.isArray(v)) return v.filter(x => !isEmpty(x)).length === 0;
  if (typeof v === "object") return Object.keys(v).filter(k => !isEmpty(v[k])).length === 0;
  return false;
}

function emit(v, ind){
  const pad = "  ".repeat(ind);
  const out = [];
  if (Array.isArray(v)){
    v.forEach(item => {
      if (isEmpty(item)) return;
      if (item !== null && typeof item === "object"){
        const sub = emit(item, ind + 1);
        if (!sub.length) return;
        out.push(pad + "- " + sub[0].slice((ind + 1) * 2));
        for (let i = 1; i < sub.length; i++) out.push(sub[i]);
      } else {
        out.push(pad + "- " + scalarStr(item));
      }
    });
  } else if (v !== null && typeof v === "object"){
    Object.keys(v).forEach(k => {
      const val = v[k];
      if (isEmpty(val)) return;
      if (val === EMPTY_MAP){ out.push(pad + k + ": {}"); return; }
      if (typeof val === "string" && val.indexOf("\n") !== -1){
        out.push(pad + k + ": |");
        val.replace(/\n+$/, "").split("\n").forEach(l => out.push("  ".repeat(ind + 1) + l));
      } else if (val !== null && typeof val === "object"){
        const sub = emit(val, ind + 1);
        if (!sub.length) return;
        out.push(pad + k + ":");
        sub.forEach(l => out.push(l));
      } else {
        out.push(pad + k + ": " + scalarStr(val));
      }
    });
  }
  return out;
}

function toYaml(obj){ return emit(obj, 0).join("\n"); }

let LANG = "de";
function t(pair){
  if (typeof pair === "string"){
    const p = pair.split("|");
    return LANG === "de" ? p[0] : (p[1] !== undefined ? p[1] : p[0]);
  }
  return pair[LANG];
}
const UI = {
  pick:      "Ressource wählen|Choose a resource",
  recommended:"Empfohlener Einstieg|Recommended starting point",
  pickDesc:  "Oder einzelne Ressourcen bauen und nacheinander zum Manifest hinzufügen.|Or build single resources and add them to the manifest one at a time.",
  build:     "erstellen|build",
  back:      "Zurück|Back",
  next:      "Weiter|Next",
  add:       "Zum Manifest hinzufügen|Add to manifest",
  discard:   "Verwerfen|Discard",
  addRow:    "+ Zeile|+ Row",
  addItem:   "+ Hinzufügen|+ Add",
  none:      "Noch nichts eingetragen.|Nothing here yet.",
  docs:      "Dokumente|Documents",
  noDocs:    "leer|empty",
  cancel:    "Abbrechen|Cancel",
  save:      "Änderungen übernehmen|Save changes",
  editHint:  "Zum Bearbeiten klicken|Click to edit",
  why:       "Wozu?|Why?",
  best:      "Best Practice|Best practice",
  sealHint:  "Kopieren, ausführen, Wert eingeben, Strg+D — die Ausgabe unter encryptedData einsetzen|Copy, run, type the value, Ctrl+D — put the output under encryptedData",
  modeFull:  "alle Felder zeigen|show all fields",
  modeShort: "nur das Nötigste|essentials only",
  deleted:   "entfernt|removed",
  undo:      "Rückgängig|Undo",
  remove:    "Eintrag entfernen|Remove entry",
  envAdd:    "+ Umgebung|+ Environment",
  errors:    "Fehler|errors",
  warnings:  "Warnungen|warnings",
  jumpHint:  "Zum betroffenen Feld springen|Jump to the field in question",
  loadBad:   "Datei passt nicht zu diesem Tool.|That file does not belong to this tool.",
  loaded:    "geladen|loaded",
  copied:    "kopiert|copied",
  allGood:   "Keine Beanstandungen.|No issues found.",
  emptyYaml: "# Wähle links eine Ressource — das YAML erscheint hier, während du tippst.|# Pick a resource on the left — the YAML appears here as you type.",
  another:   "Weitere Ressource|Another resource",
  workloads: "Workloads",
  network:   "Netzwerk|Networking",
  config:    "Konfiguration & Storage|Config & storage"
};

const WHY = {
  name:"Der Name identifiziert die Ressource innerhalb ihres Namespace und taucht überall wieder auf: in kubectl-Befehlen, in Log-Ausgaben, im clusterinternen DNS. Ändern lässt er sich nachträglich nicht — ein Rename heißt löschen und neu anlegen.|The name identifies the resource inside its namespace and reappears everywhere: in kubectl commands, in log output, in cluster DNS. It cannot be changed later — renaming means deleting and recreating.",
  namespace:"Namespaces trennen Ressourcen logisch. Gleiche Namen in verschiedenen Namespaces stören sich nicht, und Rechte, Quotas und NetworkPolicies hängen daran. Leer bedeutet default — auf Produktionsclustern selten das, was gemeint war.|Namespaces separate resources logically. The same name in different namespaces causes no conflict, and permissions, quotas and network policies hang off them. Empty means default — rarely what you want on a production cluster.",
  image:"Der Tag entscheidet, was tatsächlich läuft. Ohne Tag zieht Kubernetes :latest, und dann können zwei Pods derselben Anwendung auf unterschiedlichen Ständen laufen — die häufigste Ursache für Fehler, die sich nicht reproduzieren lassen.|The tag decides what actually runs. Without one Kubernetes pulls :latest, and two pods of the same app can end up on different builds — the most common cause of bugs nobody can reproduce.",
  replicas:"Wie viele Kopien gleichzeitig laufen. Ab zwei übersteht die Anwendung den Ausfall eines Nodes und rollierende Updates ohne Unterbrechung. Bei einer einzelnen Replica ist die Anwendung bei jedem Update kurz weg.|How many copies run at once. From two upwards the app survives a node failure and rolling updates without downtime. With a single replica the app is briefly gone on every update.",
  ports:"containerPort ist reine Dokumentation — es öffnet und sperrt nichts. Der Container lauscht auf dem Port, ob er hier steht oder nicht. Eintragen sollte man ihn trotzdem: Service, Probes und NetworkPolicies verweisen darauf.|containerPort is documentation only — it opens and blocks nothing. The container listens on that port whether or not it is declared. Declare it anyway: services, probes and network policies refer to it.",
  port:"Der Port, auf dem der Prozess im Container lauscht. Alles Weitere — Service, Probe, NetworkPolicy — leitet sich daraus ab.|The port the process inside the container listens on. Everything else — service, probe, network policy — follows from it.",
  env:"Direkt gesetzte Variablen stehen im Manifest und damit in jedem Git-Diff. Alles Vertrauliche gehört stattdessen in ein Secret.|Variables set inline live in the manifest and therefore in every Git diff. Anything confidential belongs in a Secret instead.",
  envCM:"envFrom lädt alle Schlüssel einer ConfigMap auf einmal als Umgebungsvariablen. Ändert sich die ConfigMap später, merken laufende Pods davon nichts — dafür braucht es einen Neustart des Deployments.|envFrom loads every key of a ConfigMap as environment variables at once. If the ConfigMap changes later, running pods do not notice — that needs a restart of the deployment.",
  cpuReq:"requests sind das, was der Scheduler reserviert: Ein Node muss so viel frei haben, sonst wird der Pod nirgends platziert und bleibt Pending. Zu hoch angesetzt verschenkt man Kapazität, zu niedrig konkurriert man unter Last mit den Nachbarn.|requests are what the scheduler reserves: a node must have that much free or the pod is never placed and stays Pending. Set too high you waste capacity, too low you compete with your neighbours under load.",
  memReq:"Speicher wird beim Scheduling genauso reserviert wie CPU. Der Unterschied kommt beim Limit: Speicher lässt sich nicht drosseln.|Memory is reserved at scheduling time just like CPU. The difference shows up at the limit: memory cannot be throttled.",
  cpuLim:"limits sind die harte Obergrenze. Bei CPU wird gedrosselt — die Anwendung wird langsam, läuft aber weiter. Ohne Limit kann ein einzelner Container einen Node auslasten.|limits are the hard ceiling. CPU gets throttled — the app slows down but keeps running. Without a limit a single container can saturate a node.",
  memLim:"Beim Speicher gibt es kein Drosseln: Wer sein Limit überschreitet, wird ohne Vorwarnung beendet. Im Status steht dann OOMKilled, und der Pod startet neu.|There is no throttling for memory: exceed the limit and the container is killed without warning. The status reads OOMKilled and the pod restarts.",
  probe:"readinessProbe entscheidet, ob der Pod Traffic bekommt. livenessProbe entscheidet, ob er neu gestartet wird. Ohne readiness schickt der Service sofort Anfragen an einen Container, der noch startet. Eine zu strenge liveness startet gesunde Pods im Kreis neu.|The readiness probe decides whether the pod receives traffic. The liveness probe decides whether it gets restarted. Without readiness the service sends requests to a container that is still starting. An over-strict liveness probe restarts healthy pods in a loop.",
  pullPolicy:"IfNotPresent nimmt das Image vom Node, wenn es dort schon liegt — schnell, aber ein neu gebautes Image unter demselben Tag kommt so nie an. Always holt bei jedem Start die Registry, kostet Startzeit und macht den Pod von deren Verfügbarkeit abhängig. Bei einem Tag, der sich nie ändert, ist IfNotPresent richtig; wer denselben Tag überschreibt, braucht Always — und sollte stattdessen lieber den Tag wechseln.|IfNotPresent takes the image from the node if it is already there — fast, but a freshly built image under the same tag never arrives. Always contacts the registry on every start, costs startup time and makes the pod depend on its availability. For a tag that never changes, IfNotPresent is right; whoever overwrites the same tag needs Always — and would be better off changing the tag instead.",
  restartPolicy:"OnFailure startet den Container im selben Pod neu — der Pod bleibt, die Logs der Fehlversuche gehen dabei verloren. Never legt für jeden Versuch einen neuen Pod an: Das häuft Pods an, dafür bleibt jeder Fehlversuch samt Ausgabe erhalten. Für alles, was man hinterher untersuchen können will, ist Never die bessere Wahl.|OnFailure restarts the container inside the same pod — the pod stays, and the logs of the failed attempts are lost. Never creates a new pod per attempt: that piles up pods, but every failed attempt survives with its output. For anything you may want to investigate afterwards, Never is the better choice.",
  headless:"Ohne ClusterIP verteilt der Service keine Anfragen, sondern gibt im DNS direkt die Pod-IPs zurück. Das braucht ein StatefulSet, damit jeder Pod unter seinem eigenen Namen erreichbar ist. Auch Client-Bibliotheken, die selbst zwischen Endpunkten wählen wollen — etwa Datenbanktreiber mit eigenem Pooling —, brauchen genau das.|Without a cluster IP the service distributes nothing; it returns the pod IPs directly in DNS. A StatefulSet needs this so every pod is reachable under its own name. Client libraries that want to pick between endpoints themselves — database drivers with their own pooling, for instance — need exactly this too.",
  externalName:"Erzeugt nur einen DNS-Alias auf einen Namen außerhalb des Clusters, ohne Proxy und ohne Endpoints. Praktisch, um eine verwaltete Datenbank hinter einem clusterinternen Namen zu verstecken — die Anwendung spricht immer denselben Namen an, gleich ob der Dienst später ins Cluster zieht. TLS-Zertifikate prüfen allerdings den echten Namen, nicht den Alias.|Creates nothing but a DNS alias to a name outside the cluster, with no proxying and no endpoints. Handy for hiding a managed database behind a cluster-internal name — the app always addresses the same name, whether or not the service moves into the cluster later. TLS certificates, however, validate the real name, not the alias.",
  class:"Leer bedeutet: die als Standard markierte Klasse des Clusters. Gibt es dort keine, bleibt der Claim für immer Pending, ohne dass etwas kaputt aussieht. Ausdrücklich genannt ist die Klasse dokumentiert und der Cluster austauschbar — Klassennamen unterscheiden sich allerdings zwischen Anbietern.|Empty means the class the cluster marks as default. If there is none, the claim stays Pending forever without anything looking broken. Named explicitly, the class is documented and the cluster interchangeable — though class names differ between providers.",
  "PersistentVolumeClaim.mode":"Filesystem ist der Normalfall: Kubernetes formatiert und hängt ein, im Container liegt ein Verzeichnis. Block reicht das rohe Gerät durch, ohne Dateisystem — nur für Anwendungen, die selbst darauf schreiben, etwa Datenbanken mit eigener Speicherverwaltung.|Filesystem is the normal case: Kubernetes formats and mounts it, and the container sees a directory. Block passes the raw device through with no filesystem — only for applications that write to it themselves, such as databases with their own storage engine.",
  "PodDisruptionBudget.mode":"minAvailable nennt die absolute Untergrenze, maxUnavailable die Obergrenze der gleichzeitigen Ausfälle. Der Unterschied zeigt sich beim Skalieren: minAvailable 2 lässt bei drei Replicas eine gehen, bei zehn Replicas aber acht — maxUnavailable wächst dagegen mit. Für Anwendungen, deren Replica-Zahl sich ändert, ist maxUnavailable die robustere Angabe.|minAvailable states the absolute floor, maxUnavailable the ceiling on simultaneous outages. The difference shows when scaling: minAvailable 2 lets one go at three replicas but eight at ten — maxUnavailable scales along. For applications whose replica count changes, maxUnavailable is the more robust choice.",
  app:"Die Auswahl läuft ausschließlich über dieses Label, nicht über den Namen der Ressource. Heißt das Deployment anders, als seine Pods beschriftet sind, greift die Regel ins Leere — ohne Fehlermeldung, weil ein leerer Treffer in Kubernetes kein Fehler ist.|The selection runs purely on this label, never on the resource's name. If the deployment is named differently from how its pods are labelled, the rule matches nothing — with no error, because an empty match is not an error in Kubernetes.",
  targetName:"Muss auf ein vorhandenes Deployment oder StatefulSet zeigen. Findet der HPA das Ziel nicht, bleibt er still: kein Fehler im Manifest, nur eine Bedingung im Status, die niemand liest.|Has to point at an existing Deployment or StatefulSet. If the HPA cannot find its target it stays quiet: no error in the manifest, just a condition in the status that nobody reads.",
  suspend:"Legt den CronJob an, ohne dass er läuft. Der Weg, einen Zeitplan im Manifest zu haben und ihn erst nach einer Prüfung scharfzuschalten — und die Notbremse, wenn ein Job Amok läuft, ohne ihn zu löschen.|Creates the CronJob without letting it run. The way to have a schedule in the manifest and only arm it after review — and the emergency brake when a job runs amok, without deleting it.",
  "Secret.type":"Opaque ist der Normalfall für eigene Schlüssel und Werte. Die anderen Typen erzwingen bestimmte Feldnamen, damit Kubernetes sie versteht: kubernetes.io/tls braucht tls.crt und tls.key und wird so vom Ingress gefunden, kubernetes.io/dockerconfigjson braucht .dockerconfigjson und taugt damit als imagePullSecret.|Opaque is the normal case for your own keys and values. The other types enforce particular field names so Kubernetes understands them: kubernetes.io/tls needs tls.crt and tls.key and is then found by the ingress, kubernetes.io/dockerconfigjson needs .dockerconfigjson and thereby works as an imagePullSecret.",
  tolerations:"Ein Taint auf dem Node sagt ab, die toleration im Pod hebt die Absage auf — beides muss in Schlüssel, Wert und Effekt zusammenpassen. Wichtig ist, was sie nicht tut: Sie zieht den Pod nicht auf den Node, sie erlaubt ihn dort nur. Wer gezielt auf reservierten Nodes landen will, braucht zusätzlich nodeSelector oder nodeAffinity auf ein Label. Bleibt der effect leer, gilt die toleration für alle Effekte desselben Schlüssels. tolerationSeconds greift ausschließlich bei NoExecute und legt fest, wie lange der Pod nach dem Setzen des Taints noch bleiben darf.|A taint on the node refuses, the toleration in the pod lifts that refusal — key, value and effect have to line up. What matters is what it does not do: it does not pull the pod onto the node, it merely permits it there. To land on reserved nodes deliberately you also need a nodeSelector or nodeAffinity on a label. If the effect is left empty, the toleration covers every effect of that key. tolerationSeconds applies only to NoExecute and sets how long the pod may stay after the taint appears.",
  initContainers:"Init-Container laufen der Reihe nach, jeder muss sich erfolgreich beenden, bevor der nächste startet — der Hauptcontainer beginnt erst danach. Der übliche Einsatz: eine Datenbankmigration, das Warten auf einen anderen Dienst, das Vorbereiten eines Volumes. Ein Sidecar ist derselbe Eintrag mit restartPolicy Always. Der Unterschied ist entscheidend: Kubernetes wartet dann nicht auf sein Ende, sondern nur darauf, dass es gestartet ist — und beendet es später sauber mit dem Pod. Ein dauerhaft laufender Container als gewöhnlicher Init-Container würde den Pod dagegen für immer im Zustand Init blockieren.|Init containers run one after another, each has to finish successfully before the next starts — the main container only begins afterwards. The usual cases: a database migration, waiting for another service, preparing a volume. A sidecar is the same entry with restartPolicy Always. That difference matters: Kubernetes then does not wait for it to finish, only for it to have started — and shuts it down cleanly with the pod later. A long-running container as an ordinary init container would instead block the pod in Init forever.",
  probeStartup:"Die startupProbe deckt genau die Phase ab, in der die Anwendung noch hochfährt: Solange sie läuft, greifen readiness und liveness nicht. Ihr Budget ist periodSeconds mal failureThreshold — großzügig gesetzt, ohne dass die liveness danach träge wird. Das ist der saubere Ersatz für ein hohes initialDelaySeconds, das man sonst raten muss und das im laufenden Betrieb nichts mehr bringt. Ohne sie ist die Reihenfolge tückisch: Startet die Anwendung langsamer als gedacht, tötet die liveness sie mitten im Hochfahren, wieder und wieder.|The startup probe covers exactly the phase while the app is still coming up: as long as it runs, readiness and liveness stay out of the way. Its budget is periodSeconds times failureThreshold — set generously without making the liveness probe sluggish afterwards. That is the clean replacement for a high initialDelaySeconds, which you otherwise have to guess and which does nothing once the app is running. Without it the ordering bites: if the app starts slower than expected, the liveness probe kills it mid-startup, over and over.",
  probeCmd:"Der Befehl läuft im Container selbst, ohne Shell — jedes Argument in eine eigene Zeile. Gewertet wird allein der Rückgabewert, die Ausgabe interessiert niemanden. Für Anwendungen ohne HTTP-Endpunkt ist das der Weg, etwa ein pg_isready oder eine Datei, die der Prozess anlegt, sobald er bereit ist.|The command runs inside the container itself, without a shell — one argument per line. Only the exit code counts, the output goes nowhere. For applications without an HTTP endpoint this is the way, for instance a pg_isready or a file the process creates once it is ready.",
  probePath:"Der Endpunkt sollte nur prüfen, ob der eigene Prozess antwortet — keine Datenbank, keine fremden Dienste. Sonst reißt ein Ausfall der Datenbank sämtliche Pods mit in den Neustart.|The endpoint should only check that your own process responds — no database, no third-party services. Otherwise a database outage drags every pod into a restart loop.",
  sa:"Der ServiceAccount bestimmt, was der Pod gegenüber der Kubernetes-API darf. default hat in der Regel keine Rechte, und für die allermeisten Anwendungen ist genau das richtig.|The service account decides what the pod may do against the Kubernetes API. default usually has no permissions, and for the vast majority of apps that is exactly right.",
  nodeSelector:"Bindet den Pod an Nodes mit bestimmten Labels — GPU-Nodes, eine bestimmte Zone, dedizierte Hardware. Passt kein Node auf die Auswahl, bleibt der Pod dauerhaft Pending, ohne dass etwas kaputt aussieht.|Pins the pod to nodes carrying certain labels — GPU nodes, a particular zone, dedicated hardware. If no node matches, the pod stays Pending forever without anything looking broken.",
  strategy:"RollingUpdate tauscht schrittweise aus, die Anwendung bleibt erreichbar. Recreate fährt erst alles herunter und dann neu hoch — nötig, wenn zwei Versionen nicht gleichzeitig laufen dürfen, etwa auf einem ReadWriteOnce-Volume.|RollingUpdate replaces pods gradually and the app stays reachable. Recreate tears everything down first — required when two versions must not run at once, for instance on a ReadWriteOnce volume.",
  hardened:"Setzt den Container auf das, was der Pod Security Standard restricted verlangt: keine Rechteausweitung, keine Capabilities, schreibgeschütztes Wurzeldateisystem. Cluster mit erzwungenem PSA lehnen Pods ohne diese Angaben schlicht ab.|Brings the container in line with the restricted Pod Security Standard: no privilege escalation, no capabilities, read-only root filesystem. Clusters that enforce PSA simply reject pods without it.",
  stdLabels:"Die app.kubernetes.io-Labels sind Konvention, keine Pflicht — aber Dashboards, Monitoring und Kostenauswertungen gruppieren danach. Die Version im Selector wäre fatal, weil matchLabels unveränderlich ist; deshalb bleibt dort nur app stehen.|The app.kubernetes.io labels are convention, not law — but dashboards, monitoring and cost reports group by them. Putting version in the selector would be fatal since matchLabels is immutable, so only app stays there.",
  pvc:"Der Claim verbindet den Pod mit dem Speicher. Der Pod ist vergänglich, das Volume überlebt ihn — genau darum geht es.|The claim connects the pod to storage. The pod is disposable, the volume outlives it — that is the entire point.",
  mountPath:"Der Pfad im Container, unter dem das Volume erscheint. Was dort vorher im Image lag, ist danach verdeckt.|The path inside the container where the volume appears. Anything the image had at that path is hidden afterwards.",
  size:"Bei vielen StorageClasses lässt sich die Größe später vergrößern, aber nie verkleinern. Im Zweifel eher knapp anfangen.|With many storage classes the size can be grown later, but never shrunk. When in doubt start small.",
  access:"ReadWriteOnce heißt: genau ein Node darf schreiben. Mehrere Replicas auf verschiedenen Nodes brauchen ReadWriteMany — und das kann längst nicht jede StorageClass.|ReadWriteOnce means exactly one node may write. Multiple replicas across nodes need ReadWriteMany — and far from every storage class supports it.",
  storageClass:"Bestimmt, welche Art Speicher bereitgestellt wird: schnelle lokale SSD, Netzwerkspeicher, mit oder ohne Snapshots. Leer nimmt die Standardklasse des Clusters — die es nicht überall gibt.|Decides what kind of storage gets provisioned: fast local SSD, network storage, with or without snapshots. Empty uses the cluster default class — which does not exist everywhere.",
  privateReg:"Kubernetes meldet sich nicht von selbst an einer Registry an. Für private Projekte braucht der Namespace ein Secret vom Typ dockerconfigjson, sonst endet der Pod in ImagePullBackOff.|Kubernetes does not authenticate against a registry on its own. Private projects need a dockerconfigjson secret in the namespace, otherwise the pod ends in ImagePullBackOff.",
  regUser:"Ein Robot Account ist einem persönlichen Login vorzuziehen: auf ein Projekt und auf Lesen beschränkt, und er verschwindet nicht, wenn jemand das Team wechselt.|A robot account beats a personal login: limited to one project and to pull access, and it does not vanish when someone changes team.",
  createNs:"Der Namespace muss existieren, bevor irgendetwas darin angelegt werden kann. Steht er im selben Manifest, erledigt kubectl apply das in der richtigen Reihenfolge.|The namespace has to exist before anything can be created in it. If it is in the same manifest, kubectl apply handles the ordering.",
  filesPath:"Die ConfigMap wird als Verzeichnis eingehängt, jeder Schlüssel wird zu einer Datei. Der Inhalt aktualisiert sich im laufenden Pod, aber die Anwendung muss ihn selbst neu einlesen.|The ConfigMap is mounted as a directory, each key becoming a file. The content updates in the running pod, but the app has to re-read it itself.",

  "PersistentVolume.reclaim":"Retain lässt das Volume samt Inhalt stehen, wenn der Claim gelöscht wird — aufräumen muss man dann von Hand, und ein neuer Claim bindet es nicht automatisch wieder. Delete räumt mit auf, was bei einem von Hand geschriebenen PV selten gemeint ist: Der Speicher dahinter existierte ja schon vorher.|Retain leaves the volume and its contents in place when the claim is deleted — you clean up by hand afterwards, and a new claim does not automatically bind it again. Delete cleans up with it, which is rarely the intent for a hand-written PV: the storage behind it existed beforehand.",
  "PersistentVolume.src":"local zeigt auf eine Platte an einem bestimmten Node und braucht deshalb zwingend eine nodeAffinity — sonst plant der Scheduler den Pod irgendwohin, wo es das Volume nicht gibt. nfs ist die übliche Antwort, wenn mehrere Nodes gleichzeitig schreiben sollen. csi bindet ein Volume ein, das beim Anbieter bereits existiert. hostPath ist der Notnagel für lokale Tests.|local points at a disk in one particular node and therefore requires a nodeAffinity — otherwise the scheduler places the pod somewhere the volume does not exist. nfs is the usual answer when several nodes need to write at once. csi attaches a volume that already exists at your provider. hostPath is the stopgap for local testing.",
  "PersistentVolumeClaim.bindMode":"Dynamisch ist der Normalfall: Der Claim nennt eine StorageClass, und der Provisioner legt das Volume passend an. Statisch bindet an ein PersistentVolume, das schon da ist. Beides zu mischen geht schief — nennt ein Claim keine Klasse, springt die Standardklasse ein und legt ein zweites Volume an, während das vorhandene unberührt liegen bleibt.|Dynamic is the normal case: the claim names a storage class and the provisioner creates a matching volume. Static binds to a PersistentVolume that is already there. Mixing the two goes wrong — if a claim names no class, the default class steps in and provisions a second volume while the existing one sits untouched.",
  "Pod.restartPolicy":"Always startet den Container im selben Pod neu, sobald er endet — auch nach einem erfolgreichen Ende. Für einen Pod, der eine Aufgabe einmal erledigen soll, ist OnFailure oder Never richtig. Der Pod selbst wird davon nie neu erstellt: Fällt der Node aus, ist er weg und niemand legt ihn wieder an.|Always restarts the container inside the same pod as soon as it exits — even after a successful exit. For a pod meant to do one job, OnFailure or Never is right. The pod itself is never recreated by this: if the node fails it is gone, and nobody brings it back.",
  "Service.type":"ClusterIP ist nur im Cluster erreichbar und der Normalfall. NodePort öffnet einen festen Port auf jedem Node. LoadBalancer fordert beim Cloud-Anbieter eine externe IP an — die kostet dort Geld und existiert auf lokalen Clustern oft gar nicht.|ClusterIP is cluster-internal and the normal case. NodePort opens a fixed port on every node. LoadBalancer requests an external IP from your cloud provider — that costs money and often does not exist on local clusters.",
  "Service.selector":"Der Service findet seine Pods ausschließlich über Labels, nie über Namen. Passt kein Label, existiert der Service zwar, hat aber keine Endpoints — Anfragen laufen ins Leere, ohne dass irgendwo ein Fehler auftaucht.|A service finds its pods purely by labels, never by name. If nothing matches, the service exists but has no endpoints — requests go nowhere and no error appears anywhere.",
  "Service.ports":"port ist die Adresse des Service, targetPort der Port im Container. Beide dürfen sich unterscheiden; üblich ist 80 nach außen und 8080 im Container. nodePort gilt nur beim Typ NodePort.|port is the service's own address, targetPort the port inside the container. They may differ; 80 outside and 8080 inside is common. nodePort only applies to type NodePort.",
  "Ingress.class":"Sagt, welcher Ingress-Controller sich zuständig fühlt. Passt die Klasse nicht, passiert schlicht gar nichts: Die Ressource existiert, wird aber von niemandem gelesen — kein Fehler, keine Route.|Says which ingress controller feels responsible. If the class does not match, nothing happens at all: the resource exists but nobody reads it — no error, no route.",
  "Ingress.paths":"pathType Prefix passt auf alles, was mit dem Pfad beginnt, Exact nur auf die exakte Übereinstimmung. Der Backend-Port muss der Port des Service sein, nicht der des Containers.|pathType Prefix matches anything starting with the path, Exact only the exact string. The backend port must be the service port, not the container port.",
  tls:"Kubernetes stellt keine Zertifikate aus. Das genannte Secret muss existieren — von Hand angelegt oder von cert-manager erzeugt, der dafür eine Annotation am Ingress braucht.|Kubernetes does not issue certificates. The secret named here must exist — created by hand or by cert-manager, which needs an annotation on the ingress to do so.",
  "Secret.data":"Secrets sind base64-kodiert, nicht verschlüsselt. Wer Leserechte auf den Namespace hat, liest sie im Klartext. Echter Schutz kommt von Verschlüsselung im etcd oder von Werkzeugen wie Sealed Secrets, SOPS oder Vault.|Secrets are base64-encoded, not encrypted. Anyone with read access to the namespace reads them in plain text. Real protection comes from encryption at rest in etcd or from tools like Sealed Secrets, SOPS or Vault.",
  "ConfigMap.data":"ConfigMaps sind für alles Unkritische gedacht und haben ein Limit von etwa 1 MB. Größere Dateien gehören in ein Volume oder ins Image.|ConfigMaps are meant for non-sensitive data and cap out around 1 MB. Larger files belong in a volume or in the image.",
  immutable:"Unveränderliche ConfigMaps lassen sich nicht mehr ändern, nur löschen und neu anlegen. Das schützt vor versehentlichen Änderungen und entlastet die API, weil der kubelet nicht mehr nachfragen muss.|Immutable ConfigMaps cannot be changed, only deleted and recreated. That guards against accidental edits and takes load off the API because the kubelet stops polling.",
  schedule:"Cron-Syntax, ausgewertet in UTC, solange keine timeZone gesetzt ist. Gegenüber deutscher Zeit sind das im Winter eine, im Sommer zwei Stunden Versatz — eine beliebte Überraschung bei nächtlichen Jobs.|Cron syntax, evaluated in UTC unless timeZone is set. Against Central European time that is one hour in winter and two in summer — a popular surprise for nightly jobs.",
  concurrency:"Was passiert, wenn der vorige Lauf noch läuft: Allow startet trotzdem, Forbid überspringt den Termin, Replace bricht den alten Lauf ab. Für Backups ist Forbid meist richtig.|What happens when the previous run is still going: Allow starts anyway, Forbid skips the slot, Replace kills the old run. For backups Forbid is usually right.",
  backoffLimit:"Wie oft der Job nach einem Fehlschlag neu versucht wird, bevor er endgültig als gescheitert gilt. Die Abstände wachsen dabei exponentiell.|How often the job retries after a failure before it counts as failed for good. The intervals grow exponentially.",
  ttl:"Ohne TTL bleiben abgeschlossene Jobs samt ihrer Pods für immer liegen. Nach ein paar Wochen CronJob ist die Übersicht dann unbrauchbar.|Without a TTL, finished jobs and their pods stay around forever. After a few weeks of a CronJob the listing becomes useless.",
  "NetworkPolicy.target":"Sobald eine Policy einen Pod auswählt, ist für diesen Pod alles verboten, was nicht ausdrücklich erlaubt wird. Policies addieren sich — mehrere Regeln erlauben zusammen mehr, sie schränken sich nie gegenseitig ein.|As soon as a policy selects a pod, everything not explicitly allowed is denied for that pod. Policies are additive — several rules allow more together, they never restrict each other.",
  fromNs:"Der Ingress-Controller läuft in einem eigenen Namespace. Ohne diese Ausnahme sperrt eine Default-Deny-Policy auch ihn aus, und die Anwendung ist von außen nicht mehr erreichbar.|The ingress controller lives in its own namespace. Without this exception a default-deny policy locks it out too and the app becomes unreachable from outside.",
  egress:"Vorsicht: Ausgehenden Verkehr zu sperren nimmt dem Pod auch DNS. Die Fehler sehen dann nach kaputter Namensauflösung aus und führen bei der Suche in die völlig falsche Richtung.|Careful: denying egress also takes DNS away from the pod. The resulting errors look like broken name resolution and send you looking in entirely the wrong place.",
  "PodDisruptionBudget.value":"Gilt ausschließlich bei freiwilligen Störungen — Node-Drain, Cluster-Upgrade. Stürzen Pods von selbst ab oder fällt ein Node hart aus, greift das Budget nicht.|Applies only to voluntary disruptions — node drains, cluster upgrades. If pods crash on their own or a node dies hard, the budget does not help.",
  hpa:"Der HPA rechnet die Auslastung prozentual zu requests.cpu — ohne gesetzte Requests hat er keine Bezugsgröße und tut nie etwas. Und er streitet sich mit einem festen replicas im Manifest: Bei jedem Apply gewinnt die Datei, danach korrigiert der HPA zurück.|The HPA computes utilisation as a percentage of requests.cpu — without requests set it has no reference and never acts. It also fights a fixed replicas in the manifest: every apply wins for the file, then the HPA corrects it back.",
  createSA:"Ohne eigenen ServiceAccount läuft der Pod unter default, und der teilt sich seine Rechte mit allem anderen im Namespace. Ein eigener Account trennt das sauber — auch wenn er zunächst gar nichts darf.|Without its own service account the pod runs as default, which shares its rights with everything else in the namespace. A dedicated account separates that cleanly — even if it may do nothing at first.",
  builtin:"view, edit und admin bringt jeder Cluster mit. Sie sind sorgfältig geschnitten: view lässt Secrets bewusst aus, edit erlaubt keine Rechtevergabe. Eine eigene Rolle lohnt sich erst, wenn keine davon passt.|Every cluster ships view, edit and admin. They are carefully cut: view deliberately omits secrets, edit does not permit granting rights. A custom role is worth it only when none of them fits.",
  pdb:"Verhindert, dass ein Node-Drain alle Replicas gleichzeitig wegnimmt. Zu streng gesetzt blockiert es allerdings Cluster-Upgrades auf unbestimmte Zeit.|Stops a node drain from removing every replica at once. Set too strictly it will block cluster upgrades indefinitely."
};

const PROTO = [["TCP","TCP"],["UDP","UDP"],["SCTP","SCTP"]];

function metaFields(withNs){
  const f = [
    {k:"name", t:"text", l:"Name|Name", req:true, ph:"my-app"},
  ];
  if (withNs) f.push({k:"namespace", t:"text", l:"Namespace|Namespace", ph:"default",
    hint:"Leer lassen = default|Leave empty for default"});
  f.push({k:"labels", t:"kv", l:"Labels|Labels", hint:"app: my-app wird automatisch gesetzt, wenn leer.|app: my-app is set automatically when empty."});
  return f;
}

const RES = {};

RES.Namespace = {
  group:"config", desc:"Logischer Mandant im Cluster|Logical tenant inside the cluster",
  steps:[
    {id:"meta", title:"Namespace", desc:"Name und Beschriftung des Namespace.|Name and labels of the namespace.",
     fields:[{k:"name",t:"text",l:"Name|Name",req:true,ph:"team-alpha"},
             {k:"labels",t:"kv",l:"Labels|Labels"},
             {k:"annotations",t:"kv",l:"Annotations|Annotations"}]}
  ],
  build(d){
    return {apiVersion:"v1", kind:"Namespace",
      metadata:{name:d.name, labels:kvObj(d.labels), annotations:kvObj(d.annotations)}};
  }
};

RES.Deployment = {
  group:"workloads", desc:"Zustandslose Anwendung mit Replicas|Stateless app with replicas",
  steps:[
    {id:"meta", title:"Metadaten|Metadata", desc:"Wie heißt die Anwendung und wo läuft sie?|What is the app called and where does it run?",
     fields: metaFields(true).concat([{k:"annotations",t:"kv",l:"Annotations|Annotations"}])},
    {id:"pod", title:"Container", desc:"Image, Replicas und Startbefehl.|Image, replicas and start command.",
     fields:[
      {k:"image", t:"text", l:"Image|Image", req:true, ph:"nginx:1.27-alpine"},
      {k:"replicas", t:"number", l:"Replicas|Replicas", def:2, min:0, half:true},
      {k:"pullPolicy", t:"select", l:"imagePullPolicy", half:true,
        opts:[["","IfNotPresent (Standard)|IfNotPresent (default)"],["Always","Always"],["Never","Never"]]},
      {k:"containerName", t:"text", l:"Containername|Container name", ph:"= Name der Ressource|= resource name"},
      {k:"command", t:"lines", l:"command|command", hint:"Eine Zeile pro Argument. Leer = Entrypoint des Images.|One line per argument. Empty = image entrypoint."},
      {k:"args", t:"lines", l:"args|args"},
      {k:"ports", t:"list", l:"Container-Ports|Container ports", item:[
        {k:"name", t:"text", l:"name", ph:"http"},
        {k:"containerPort", t:"number", l:"containerPort", ph:"8080"},
        {k:"protocol", t:"select", l:"protocol", opts:[["","TCP"]].concat(PROTO.slice(1))}
      ]}
     ]},
    {id:"env", title:"Umgebung|Environment", desc:"Variablen direkt setzen oder aus ConfigMap/Secret laden.|Set variables directly or load them from a ConfigMap/Secret.",
     fields:[
      {k:"env", t:"kv", l:"Umgebungsvariablen|Environment variables"},
      {k:"envCM", t:"text", l:"envFrom · ConfigMap", ph:"app-config", half:true},
      {k:"envSec", t:"text", l:"envFrom · Secret", ph:"app-secrets", half:true},
      {k:"volumes", t:"list", l:"Volumes einhängen|Mount volumes", item:[
        {k:"type", t:"select", l:"Art|Kind", opts:[["","configMap"],["secret","secret"],["pvc","PVC"],["emptyDir","emptyDir"]]},
        {k:"cm", t:"text", l:"Quelle|Source", ph:"app-config"},
        {k:"path", t:"text", l:"mountPath", ph:"/etc/app"},
        {k:"subPath", t:"text", l:"subPath", ph:"nur eine Datei|a single file"},
        {k:"size", t:"text", l:"sizeLimit", ph:"nur emptyDir|emptyDir only"},
        {k:"readOnly", t:"bool", l:"readOnly"}
      ], hint:"emptyDir braucht keine Quelle. subPath hängt einen einzelnen Schlüssel als Datei ein, statt das ganze Volume über das Verzeichnis zu legen.|emptyDir needs no source. subPath mounts a single key as a file instead of covering the whole directory."},
      {k:"pvc", t:"text", l:"PVC mounten · claimName|Mount PVC · claimName", ph:"data", half:true},
      {k:"pvcPath", t:"text", l:"mountPath", ph:"/var/lib/data", half:true}
     ]},
    {id:"res", title:"Ressourcen & Probes|Resources & probes", desc:"Grenzen verhindern, dass ein Container den Node auslastet.|Limits keep one container from starving the node.",
     fields:[
      {k:"cpuReq", t:"text", l:"requests.cpu", ph:"100m", half:true},
      {k:"memReq", t:"text", l:"requests.memory", ph:"128Mi", half:true},
      {k:"cpuLim", t:"text", l:"limits.cpu", ph:"500m", half:true},
      {k:"memLim", t:"text", l:"limits.memory", ph:"512Mi", half:true},
      {k:"probe", t:"select", l:"Health check|Health check", structural:true,
        opts:[["","keiner|none"],["http","httpGet"],["tcp","tcpSocket"],["exec","exec"]]},
      {k:"probePath", t:"text", l:"Pfad|Path", ph:"/healthz", def:"/healthz", when:d=>d.probe==="http"},
      {k:"probePort", t:"number", l:"Port|Port", ph:"8080", when:d=>d.probe==="http"||d.probe==="tcp"},
      {k:"probeCmd", t:"lines", l:"Befehl|Command", req:true, ph:"cat\n/tmp/ready", when:d=>d.probe==="exec",
        hint:"Eine Zeile pro Argument. Rückgabewert 0 heißt gesund, alles andere gilt als Fehlschlag.|One line per argument. Exit code 0 means healthy, anything else counts as a failure."},
      {k:"probeReadiness", t:"bool", def:true, l:"readinessProbe", when:d=>!!d.probe,
        hint:"Entscheidet, ob der Pod Traffic vom Service bekommt.|Decides whether the pod receives traffic from the service."},
      {k:"probeLiveness", t:"bool", def:true, structural:true, l:"livenessProbe", when:d=>!!d.probe,
        hint:"Entscheidet, ob der Container neu gestartet wird.|Decides whether the container gets restarted."},
      {k:"probeStartup", t:"bool", structural:true, l:"startupProbe", when:d=>!!d.probe,
        hint:"Gibt der Anwendung Zeit zum Hochfahren. Solange sie läuft, greifen die anderen beiden nicht.|Gives the app time to come up. While it runs, the other two stay out of the way."},
      {k:"livenessPath", t:"text", adv:true, l:"livenessProbe · abweichender Pfad|livenessProbe · different path",
        ph:"= readinessProbe", when:d=>d.probe==="http" && d.probeLiveness!==false},
      {k:"probeDelay", t:"number", adv:true, l:"initialDelaySeconds", ph:"15", min:0, half:true, when:d=>!!d.probe},
      {k:"probePeriod", t:"number", adv:true, l:"periodSeconds", ph:"10", min:1, half:true, when:d=>!!d.probe},
      {k:"probeTimeout", t:"number", adv:true, l:"timeoutSeconds", ph:"1", min:1, half:true, when:d=>!!d.probe},
      {k:"probeFailures", t:"number", adv:true, l:"failureThreshold", ph:"3", min:1, half:true, when:d=>!!d.probe},
      {k:"startupPeriod", t:"number", adv:true, l:"startupProbe · periodSeconds", ph:"10", min:1, half:true, when:d=>d.probeStartup},
      {k:"startupFailures", t:"number", adv:true, l:"startupProbe · failureThreshold", ph:"30", min:1, half:true, when:d=>d.probeStartup,
        hint:"periodSeconds mal failureThreshold ist das Startbudget — 10 × 30 sind fünf Minuten.|periodSeconds times failureThreshold is the startup budget — 10 × 30 is five minutes."}
     ]},
    {id:"init", title:"Init & Sidecars|Init & sidecars",
     desc:"Init-Container laufen der Reihe nach vor dem Hauptcontainer und müssen sich beenden. Ein Sidecar ist technisch derselbe Eintrag, nur mit restartPolicy Always — es startet vorher und läuft dann daneben weiter.|Init containers run one after another before the main container and have to finish. A sidecar is technically the same entry, only with restartPolicy Always — it starts first and then keeps running alongside.",
     fields:[
      {k:"initContainers", t:"list", l:"Container davor|Containers before", item:[
        {k:"name", t:"text", l:"Name", ph:"migrate"},
        {k:"image", t:"text", l:"Image", ph:"busybox:1.36"},
        {k:"mode", t:"select", l:"Art|Kind",
          opts:[["","Init — läuft vorher zu Ende|Init — runs to completion first"],
                ["sidecar","Sidecar — läuft daneben weiter|Sidecar — keeps running alongside"]]},
        {k:"mounts", t:"bool", l:"Volumes mitnehmen|Take the volumes"},
        {k:"command", t:"textarea", l:"command", full:true, ph:"sh\n-c\nsleep 5"}
      ], hint:"Eine Zeile pro Argument im command. Ohne Volumes bleibt der Container für sich — wer Daten weiterreichen will, hängt dieselben Volumes ein wie der Hauptcontainer.|One line per argument in the command. Without volumes the container stays to itself — to hand data over, mount the same volumes as the main container."}
     ]},
    {id:"adv", adv:true, title:"Erweitert|Advanced", desc:"Optional. Leere Felder landen nicht im YAML.|Optional. Empty fields never reach the YAML.",
     fields:[
      {k:"sa", t:"text", l:"serviceAccountName", ph:"default"},
      {k:"pullSecret", t:"text", l:"imagePullSecrets", ph:"registry-cred"},
      {k:"nodeSelector", t:"kv", l:"nodeSelector"},
      {k:"tolerations", t:"list", l:"Tolerations|Tolerations", item:[
        {k:"key", t:"text", l:"key", ph:"dedicated"},
        {k:"op", t:"select", l:"operator",
          opts:[["","Equal — Wert muss passen|Equal — the value has to match"],
                ["Exists","Exists — Schlüssel genügt|Exists — the key is enough"]]},
        {k:"value", t:"text", l:"value", ph:"gpu"},
        {k:"effect", t:"select", l:"effect",
          opts:[["","jeder Effekt|any effect"],["NoSchedule","NoSchedule"],
                ["PreferNoSchedule","PreferNoSchedule"],["NoExecute","NoExecute"]]},
        {k:"seconds", t:"number", l:"tolerationSeconds", ph:"300"}
      ], hint:"Erlaubt dem Pod einen Node trotz Taint. Leerer key mit Exists toleriert alles — auch die Taints, mit denen Kubernetes kaputte Nodes markiert.|Lets the pod onto a node despite a taint. An empty key with Exists tolerates everything — including the taints Kubernetes uses to mark broken nodes."},
      {k:"strategy", t:"select", l:"Update-Strategie|Update strategy",
        opts:[["","RollingUpdate (Standard)|RollingUpdate (default)"],["Recreate","Recreate"]]},
      {k:"stdLabels", t:"bool", structural:true, l:"Empfohlene app.kubernetes.io-Labels setzen|Add the recommended app.kubernetes.io labels",
        hint:"Name, Instance, Version (aus dem Image-Tag) und Managed-by. Der Selector bleibt bewusst nur app — matchLabels lässt sich nachträglich nicht ändern.|Name, instance, version (from the image tag) and managed-by. The selector stays app only on purpose — matchLabels cannot be changed later."},
      {k:"component", t:"text", l:"app.kubernetes.io/component", ph:"backend", half:true, when:d=>d.stdLabels},
      {k:"partOf", t:"text", l:"app.kubernetes.io/part-of", ph:"shop", half:true, when:d=>d.stdLabels},
      {k:"runAsNonRoot", t:"bool", l:"runAsNonRoot erzwingen|Enforce runAsNonRoot"},
      {k:"hardened", t:"bool", l:"Restricted-Härtung anwenden|Apply restricted hardening",
        hint:"Setzt readOnlyRootFilesystem, dropt alle Capabilities, seccomp RuntimeDefault — und legt ein beschreibbares /tmp an, weil sonst viele Images beim Start scheitern.|Sets readOnlyRootFilesystem, drops all capabilities, seccomp RuntimeDefault — and adds a writable /tmp, because many images fail to start without one."}
     ]}
  ],
  build(d){
    const sel = d.name ? {app:d.name} : undefined;
    const labels = allLabels(d, sel);
    return {
      apiVersion:"apps/v1", kind:"Deployment",
      metadata:{name:d.name, namespace:d.namespace||undefined, labels:labels, annotations:kvObj(d.annotations)},
      spec:{
        replicas: d.replicas === undefined || d.replicas === "" ? 2 : num(d.replicas),
        strategy: d.strategy ? {type:d.strategy} : undefined,
        selector:{matchLabels: sel},
        template:{metadata:{labels:labels}, spec: podSpecOf(d)}
      }
    };
  }
};

RES.StatefulSet = {
  group:"workloads", desc:"Zustandsbehaftet: eigene Identität und eigenes Volume je Pod|Stateful: its own identity and its own volume per pod",
  steps:[
    RES.Deployment.steps[0],
    RES.Deployment.steps[1],
    {id:"sts", title:"Speicher & Identität|Storage & identity",
     desc:"Jeder Pod bekommt einen festen Namen (name-0, name-1) und sein eigenes Volume. Genau darum ist ReadWriteOnce hier kein Problem, anders als beim Deployment.|Every pod gets a fixed name (name-0, name-1) and its own volume. That is precisely why ReadWriteOnce is not a problem here, unlike with a Deployment.",
     fields:[
      {k:"serviceName", t:"text", l:"serviceName", req:true, ph:"= Name der Ressource|= resource name",
        hint:"Muss auf einen headless Service zeigen (clusterIP: None). Ohne den haben die Pods keine eigenen DNS-Namen.|Must point at a headless service (clusterIP: None). Without it the pods have no individual DNS names."},
      {k:"vct", t:"list", l:"Volume je Pod|Volume per pod", item:[
        {k:"name", t:"text", l:"Name", ph:"data"},
        {k:"path", t:"text", l:"mountPath", ph:"/var/lib/data"},
        {k:"size", t:"text", l:"Größe|Size", ph:"20Gi"},
        {k:"class", t:"text", l:"storageClassName", ph:"standard"},
        {k:"access", t:"select", l:"accessMode",
          opts:[["","ReadWriteOnce"],["ReadWriteOncePod","ReadWriteOncePod"],["ReadWriteMany","ReadWriteMany"]]}
      ]},
      {k:"podManagement", t:"select", l:"podManagementPolicy", half:true,
        opts:[["","OrderedReady — einer nach dem anderen|OrderedReady — one after another"],
              ["Parallel","Parallel — alle gleichzeitig|Parallel — all at once"]]},
      {k:"partition", t:"text", l:"updateStrategy.partition", ph:"0", half:true,
        hint:"Nur Pods mit Ordinal ab diesem Wert werden aktualisiert — der Weg für ein gestaffeltes Update.|Only pods with an ordinal at or above this value get updated — the way to stage an update."},
      {k:"retainOnDelete", t:"bool", l:"Volumes beim Löschen behalten|Keep volumes when deleted",
        hint:"Standardmäßig bleiben die PVCs sowieso stehen, wenn das StatefulSet gelöscht wird. Dieses Feld macht es ausdrücklich.|By default the PVCs stay behind anyway when the StatefulSet is deleted. This field makes that explicit."}
     ]},
    RES.Deployment.steps[2],
    RES.Deployment.steps[3],
    RES.Deployment.steps[4],
    RES.Deployment.steps[5]
  ],
  build(d){
    const sel = d.name ? {app:d.name} : undefined;
    const labels = allLabels(d, sel);
    const vct = (d.vct||[]).filter(x => x.name && x.size);
    const extra = vct.filter(x => x.path).map(x => ({name:x.name, mountPath:x.path}));
    const part = num(d.partition);
    return {
      apiVersion:"apps/v1", kind:"StatefulSet",
      metadata:{name:d.name, namespace:d.namespace||undefined, labels:labels, annotations:kvObj(d.annotations)},
      spec:{
        serviceName: d.serviceName || d.name,
        replicas: d.replicas === undefined || d.replicas === "" ? 2 : num(d.replicas),
        podManagementPolicy: d.podManagement || undefined,
        updateStrategy: part !== undefined ? {type:"RollingUpdate", rollingUpdate:{partition:part}} : undefined,
        persistentVolumeClaimRetentionPolicy: d.retainOnDelete ? {whenDeleted:"Retain", whenScaled:"Retain"} : undefined,
        selector:{matchLabels: sel},
        template:{metadata:{labels:labels}, spec: podSpecOf(d, extra)},
        volumeClaimTemplates: vct.map(x => ({
          metadata:{name:x.name},
          spec:{
            accessModes:[x.access || "ReadWriteOnce"],
            storageClassName: x.class || undefined,
            resources:{requests:{storage:x.size}}
          }
        }))
      }
    };
  }
};

/* Wie der Container-Schritt des Deployments, nur ohne Replicas — dafür mit restartPolicy. */
const podFields = RES.Deployment.steps[1].fields.filter(f => f.k !== "replicas");
podFields.splice(podFields.findIndex(f => f.k === "pullPolicy") + 1, 0,
  {k:"restartPolicy", t:"select", l:"restartPolicy", half:true,
    opts:[["","Always (Standard)|Always (default)"],["OnFailure","OnFailure"],["Never","Never"]]});

RES.Pod = {
  group:"workloads", desc:"Ein einzelner Pod ohne Controller|A single pod without a controller",
  steps:[
    RES.Deployment.steps[0],
    {id:"pod", title:"Container",
     desc:"Ein Pod läuft genau so, wie er hier steht — einmal, ohne Replicas und ohne Ersatz. Zum Ausprobieren, für kurze Debug-Container und für Aufgaben, die von Hand angestoßen werden. Alles, was dauerhaft laufen soll, gehört in ein Deployment.|A pod runs exactly as written here — once, without replicas and without a replacement. Good for trying things out, for short-lived debug containers and for work you kick off by hand. Anything meant to keep running belongs in a Deployment.",
     fields: podFields},
    RES.Deployment.steps[2],
    RES.Deployment.steps[3],
    RES.Deployment.steps[4],
    {id:"adv", adv:true, title:"Erweitert|Advanced", desc:"Optional. Leere Felder landen nicht im YAML.|Optional. Empty fields never reach the YAML.",
     fields: RES.Deployment.steps[5].fields.filter(f => f.k !== "strategy")}
  ],
  build(d){
    const sel = d.name ? {app:d.name} : undefined;
    return {
      apiVersion:"v1", kind:"Pod",
      metadata:{name:d.name, namespace:d.namespace||undefined, labels:allLabels(d, sel),
        annotations:kvObj(d.annotations)},
      spec: Object.assign({restartPolicy: d.restartPolicy || undefined}, podSpecOf(d))
    };
  }
};

RES.Service = {
  group:"network", desc:"Stabile Adresse für eine Menge Pods|Stable address for a set of pods",
  steps:[
    {id:"meta", title:"Metadaten|Metadata", desc:"",
     fields:[{k:"name",t:"text",l:"Name|Name",req:true,ph:"my-app"},
             {k:"namespace",t:"text",l:"Namespace|Namespace"},
             {k:"labels",t:"kv",l:"Labels|Labels"}]},
    {id:"spec", title:"Auswahl & Ports|Selection & ports",
     desc:"Der Selector muss exakt zu den Pod-Labels passen, sonst bleibt der Service leer.|The selector has to match the pod labels exactly, otherwise the service stays empty.",
     fields:[
      {k:"type", t:"select", l:"Typ|Type", structural:true,
        opts:[["","ClusterIP (Standard)|ClusterIP (default)"],["NodePort","NodePort"],["LoadBalancer","LoadBalancer"],["ExternalName","ExternalName"]]},
      {k:"externalName", t:"text", l:"externalName", ph:"db.example.com", when:d=>d.type==="ExternalName"},
      {k:"selector", t:"kv", l:"Selector|Selector", when:d=>d.type!=="ExternalName",
        hint:"z. B. app = my-app|e.g. app = my-app"},
      {k:"ports", t:"list", l:"Ports|Ports", when:d=>d.type!=="ExternalName", item:[
        {k:"name", t:"text", l:"name", ph:"http"},
        {k:"port", t:"number", l:"port", ph:"80"},
        {k:"targetPort", t:"text", l:"targetPort", ph:"8080"},
        {k:"nodePort", t:"number", l:"nodePort", ph:"30080"},
        {k:"protocol", t:"select", l:"protocol", opts:[["","TCP"]].concat(PROTO.slice(1))}
      ]},
      {k:"headless", t:"bool", l:"Headless (clusterIP: None)", when:d=>!d.type}
     ]}
  ],
  build(d){
    return {apiVersion:"v1", kind:"Service",
      metadata:{name:d.name, namespace:d.namespace||undefined, labels:kvObj(d.labels)},
      spec:{
        type:d.type||undefined,
        externalName: d.type==="ExternalName" ? d.externalName : undefined,
        clusterIP: (!d.type && d.headless) ? "None" : undefined,
        selector: d.type==="ExternalName" ? undefined : kvObj(d.selector),
        ports: d.type==="ExternalName" ? undefined : (d.ports||[]).filter(p=>p.port).map(p=>({
          name:p.name||undefined, port:num(p.port),
          targetPort: p.targetPort===undefined||p.targetPort==="" ? undefined : (/^\d+$/.test(p.targetPort)?num(p.targetPort):p.targetPort),
          nodePort: d.type==="NodePort" ? num(p.nodePort) : undefined,
          protocol:p.protocol||undefined
        }))
      }};
  }
};

RES.ConfigMap = {
  group:"config", desc:"Nicht-vertrauliche Konfiguration|Non-confidential configuration",
  steps:[
    {id:"meta", title:"Metadaten|Metadata", desc:"",
     fields:[{k:"name",t:"text",l:"Name|Name",req:true,ph:"app-config"},
             {k:"namespace",t:"text",l:"Namespace|Namespace"},
             {k:"labels",t:"kv",l:"Labels|Labels"}]},
    {id:"data", title:"Daten|Data", desc:"Kurze Werte als Paare, ganze Dateien als Block.|Short values as pairs, whole files as blocks.",
     fields:[
      {k:"data", t:"kv", l:"Schlüssel/Wert|Key/value"},
      {k:"files", t:"list", l:"Dateien|Files", item:[
        {k:"name", t:"text", l:"Dateiname|File name", ph:"nginx.conf"},
        {k:"content", t:"textarea", l:"Inhalt|Content", full:true}
      ]},
      {k:"immutable", t:"bool", l:"immutable"}
     ]}
  ],
  build(d){
    const data = kvObj(d.data) || {};
    (d.files||[]).forEach(f=>{ if (f.name && f.content) data[f.name] = f.content.replace(/\r\n/g,"\n"); });
    return {apiVersion:"v1", kind:"ConfigMap",
      metadata:{name:d.name, namespace:d.namespace||undefined, labels:kvObj(d.labels)},
      immutable: d.immutable || undefined,
      data: Object.keys(data).length ? data : undefined};
  }
};

const SEAL_TODO = "REPLACE_WITH_KUBESEAL_OUTPUT";

function secretPayload(d){
  if (d.type === "kubernetes.io/tls") return {"tls.crt": d.tlsCrt, "tls.key": d.tlsKey};
  if (d.type === "kubernetes.io/dockerconfigjson"){
    if (!d.regServer || !d.regUser) return undefined;
    const cfg = {auths:{}};
    cfg.auths[d.regServer] = {username:d.regUser, password:d.regPass || "",
      auth:b64(d.regUser + ":" + (d.regPass || ""))};
    return {".dockerconfigjson": JSON.stringify(cfg)};
  }
  return kvObj(d.data);
}

function sealCommands(d){
  const keys = Object.keys(secretPayload(d) || {});
  if (!keys.length) return [];
  const scope = d.sealedScope || "";
  const cert = d.sealedCert ? " --cert " + d.sealedCert : "";
  let base = "kubeseal --raw --format base64" + cert;
  if (scope === "cluster") base += " --scope cluster-wide";
  else if (scope === "namespace") base += " --scope namespace-wide --namespace " + (d.namespace || "default");
  else base += " --namespace " + (d.namespace || "default") + " --name " + (d.name || "NAME");
  return keys.map(k => ({key:k, cmd:base + "   # -> encryptedData." + k}));
}

RES.Secret = {
  group:"config", desc:"Zugangsdaten — im Klartext, verschlüsselt oder als Verweis|Credentials — plaintext, encrypted or by reference",
  steps:[
    {id:"meta", title:"Metadaten|Metadata", desc:"",
     fields:[{k:"name",t:"text",l:"Name|Name",req:true,ph:"app-secrets"},
             {k:"namespace",t:"text",l:"Namespace|Namespace"},
             {k:"backend",t:"select",l:"Auslieferung|Delivery",structural:true,
              opts:[["","Secret — Werte stehen im Manifest|Secret — values live in the manifest"],
                    ["sealed","SealedSecret — verschlüsselt, Git-fähig|SealedSecret — encrypted, safe for Git"],
                    ["external","ExternalSecret — Verweis auf Vault o. ä.|ExternalSecret — reference to Vault or similar"]],
              why:"Ein gewöhnliches Secret ist base64-kodiert, nicht verschlüsselt — es gehört damit nicht in ein Repository. Ein SealedSecret enthält ein mit dem öffentlichen Schlüssel des Clusters verschlüsseltes Chiffrat; entschlüsseln kann es nur der Controller im Cluster, also darf es committet werden. Ein ExternalSecret enthält überhaupt kein Geheimnis, sondern nur den Pfad in einem externen Tresor — der Operator holt den Wert zur Laufzeit.|A plain Secret is base64-encoded, not encrypted — it does not belong in a repository. A SealedSecret contains a ciphertext encrypted with the cluster's public key; only the in-cluster controller can decrypt it, so it may be committed. An ExternalSecret contains no secret at all, only a path in an external vault — the operator fetches the value at runtime."},
             {k:"type",t:"select",l:"Typ|Type",structural:true, when:d=>d.backend!=="external",
              opts:[["","Opaque"],["kubernetes.io/tls","kubernetes.io/tls"],["kubernetes.io/dockerconfigjson","kubernetes.io/dockerconfigjson"]]}]},

    {id:"data", title:"Inhalt|Content",
     desc:"",
     fields:[
      {k:"data", t:"kv", secret:true, l:"stringData", when:d=>d.backend!=="external" && !d.type},
      {k:"tlsCrt", t:"textarea", l:"tls.crt", when:d=>d.backend!=="external" && d.type==="kubernetes.io/tls", ph:"-----BEGIN CERTIFICATE-----"},
      {k:"tlsKey", t:"textarea", secret:true, l:"tls.key", when:d=>d.backend!=="external" && d.type==="kubernetes.io/tls", ph:"-----BEGIN PRIVATE KEY-----"},
      {k:"regServer", t:"text", l:"Registry", ph:"registry.example.com", when:d=>d.backend!=="external" && d.type==="kubernetes.io/dockerconfigjson"},
      {k:"regUser", t:"text", l:"Benutzer|Username", half:true, when:d=>d.backend!=="external" && d.type==="kubernetes.io/dockerconfigjson"},
      {k:"regPass", t:"text", secret:true, l:"Passwort / Token|Password / token", half:true, when:d=>d.backend!=="external" && d.type==="kubernetes.io/dockerconfigjson"},

      {k:"sealedScope", t:"select", l:"Geltungsbereich|Scope", when:d=>d.backend==="sealed",
        opts:[["","strict — an Name und Namespace gebunden|strict — bound to name and namespace"],
              ["namespace","namespace-wide — im Namespace umbenennbar|namespace-wide — renameable within the namespace"],
              ["cluster","cluster-wide — überall einsetzbar|cluster-wide — usable anywhere"]],
        why:"strict ist die Voreinstellung und die sicherste Variante: Das Chiffrat lässt sich nur unter genau diesem Namen in genau diesem Namespace entschlüsseln. Wer es woanders einspielt, bekommt nichts. Die weiteren Bereiche lockern das — cluster-wide bedeutet, dass jeder mit Schreibrecht auf irgendeinen Namespace das Geheimnis für sich entschlüsseln lassen kann.|strict is the default and the safest option: the ciphertext can only be decrypted under exactly this name in exactly this namespace. Anyone applying it elsewhere gets nothing. The wider scopes loosen that — cluster-wide means anyone with write access to any namespace can have the secret decrypted for themselves."},
      {k:"sealedCert", t:"text", adv:true, l:"Zertifikatsdatei|Certificate file", ph:"./sealed-secrets.pem", when:d=>d.backend==="sealed",
        hint:"Leer lassen, wenn kubeseal den öffentlichen Schlüssel selbst aus dem Cluster holen darf. Für Rechner ohne Clusterzugriff das Zertifikat einmal exportieren.|Leave empty if kubeseal may fetch the public key from the cluster itself. For machines without cluster access, export the certificate once."},

      {k:"store", t:"text", l:"SecretStore", req:true, ph:"vault-backend", when:d=>d.backend==="external",
        hint:"Der Store muss im Cluster existieren und beschreibt, welcher Tresor angesprochen wird und wie sich der Operator dort anmeldet.|The store has to exist in the cluster and describes which vault is addressed and how the operator authenticates against it."},
      {k:"storeKind", t:"select", l:"Art des Store|Store kind", half:true, when:d=>d.backend==="external",
        opts:[["","SecretStore — nur dieser Namespace|SecretStore — this namespace only"],
              ["ClusterSecretStore","ClusterSecretStore — clusterweit|ClusterSecretStore — cluster-wide"]]},
      {k:"refresh", t:"text", l:"refreshInterval", ph:"1h", half:true, when:d=>d.backend==="external",
        hint:"Wie oft der Operator nachsieht. Eine Rotation im Tresor kommt erst mit dem nächsten Abgleich an — und Pods lesen sie erst nach einem Neustart.|How often the operator checks. A rotation in the vault only arrives with the next sync — and pods only pick it up after a restart."},
      {k:"extMode", t:"select", l:"Übernahme|Mapping", structural:true, when:d=>d.backend==="external",
        opts:[["","ganzen Pfad übernehmen|take the whole path"],["keys","Schlüssel einzeln zuordnen|map keys individually"]]},
      {k:"extPath", t:"text", l:"Pfad im Tresor|Path in the vault", ph:"secret/data/shop/db",
        when:d=>d.backend==="external" && !d.extMode},
      {k:"extKeys", t:"list", l:"Zuordnung|Mapping", when:d=>d.backend==="external" && d.extMode==="keys", item:[
        {k:"key", t:"text", l:"Schlüssel im Secret|Key in the secret", ph:"DB_PASSWORD"},
        {k:"remote", t:"text", l:"Pfad im Tresor|Path in the vault", ph:"secret/data/shop/db"},
        {k:"property", t:"text", l:"property", ph:"password"}
      ]}
     ]}
  ],

  build(d){
    const meta = {name:d.name, namespace:d.namespace||undefined, labels:kvObj(d.labels)};
    const type = d.type || "Opaque";

    if (d.backend === "sealed"){
      const keys = Object.keys(secretPayload(d) || {});
      const enc = {};
      keys.forEach(k => { enc[k] = SEAL_TODO; });
      const ann = {};
      if (d.sealedScope === "namespace") ann["sealedsecrets.bitnami.com/namespace-wide"] = "true";
      if (d.sealedScope === "cluster") ann["sealedsecrets.bitnami.com/cluster-wide"] = "true";
      return {apiVersion:"bitnami.com/v1alpha1", kind:"SealedSecret",
        metadata:Object.assign({}, meta, {annotations:Object.keys(ann).length ? ann : undefined}),
        spec:{
          encryptedData: keys.length ? enc : undefined,
          template:{metadata:{name:d.name, namespace:d.namespace||undefined, labels:kvObj(d.labels)}, type:type}
        }};
    }

    if (d.backend === "external"){
      const perKey = (d.extKeys||[]).filter(x => x.key && x.remote);
      return {apiVersion:"external-secrets.io/v1beta1", kind:"ExternalSecret",
        metadata:meta,
        spec:{
          refreshInterval: d.refresh || "1h",
          secretStoreRef:{name:d.store, kind:d.storeKind || "SecretStore"},
          target:{name:d.name, creationPolicy:"Owner"},
          data: d.extMode === "keys" && perKey.length
            ? perKey.map(x => ({secretKey:x.key, remoteRef:{key:x.remote, property:x.property || undefined}}))
            : undefined,
          dataFrom: d.extMode !== "keys" && d.extPath ? [{extract:{key:d.extPath}}] : undefined
        }};
    }

    return {apiVersion:"v1", kind:"Secret", metadata:meta, type:type, stringData:secretPayload(d)};
  }
};

RES.Ingress = {
  group:"network", desc:"HTTP-Routing von außen ins Cluster|HTTP routing from outside into the cluster",
  steps:[
    {id:"meta", title:"Metadaten|Metadata", desc:"",
     fields:[{k:"name",t:"text",l:"Name|Name",req:true,ph:"my-app"},
             {k:"namespace",t:"text",l:"Namespace|Namespace"},
             {k:"class",t:"text",l:"ingressClassName",ph:"nginx"},
             {k:"annotations",t:"kv",l:"Annotations|Annotations",
              hint:"Controller-spezifisch, z. B. cert-manager.io/cluster-issuer|Controller specific, e.g. cert-manager.io/cluster-issuer"}]},
    {id:"rules", title:"Routen|Routes", desc:"Pfad → Service. Ohne Host greift die Regel für jede Domain.|Path → service. Without a host the rule matches any domain.",
     fields:[
      {k:"host", t:"text", l:"Host|Host", ph:"app.example.com"},
      {k:"paths", t:"list", l:"Pfade|Paths", item:[
        {k:"path", t:"text", l:"path", ph:"/"},
        {k:"pathType", t:"select", l:"pathType", opts:[["","Prefix"],["Exact","Exact"],["ImplementationSpecific","ImplementationSpecific"]]},
        {k:"svc", t:"text", l:"service", ph:"my-app"},
        {k:"port", t:"number", l:"port", ph:"80"}
      ]}
     ]},
    {id:"tls", title:"TLS", desc:"",
     fields:[
      {k:"tls", t:"bool", l:"TLS aktivieren|Enable TLS", structural:true},
      {k:"tlsSecret", t:"text", l:"secretName", ph:"my-app-tls", when:d=>d.tls}
     ]}
  ],
  build(d){
    const paths = (d.paths||[]).filter(p=>p.svc).map(p=>({
      path: p.path || "/",
      pathType: p.pathType || "Prefix",
      backend:{service:{name:p.svc, port:{number:num(p.port)}}}
    }));
    return {apiVersion:"networking.k8s.io/v1", kind:"Ingress",
      metadata:{name:d.name, namespace:d.namespace||undefined, labels:kvObj(d.labels), annotations:kvObj(d.annotations)},
      spec:{
        ingressClassName: d.class || undefined,
        tls: d.tls ? [{hosts: d.host ? [d.host] : undefined, secretName: d.tlsSecret}] : undefined,
        rules: paths.length ? [{host:d.host||undefined, http:{paths}}] : undefined
      }};
  }
};

const jobPodFields = [
  {k:"image", t:"text", l:"Image|Image", req:true, ph:"busybox:1.36"},
  {k:"command", t:"lines", l:"command", hint:"Eine Zeile pro Argument.|One line per argument."},
  {k:"args", t:"lines", l:"args"},
  {k:"env", t:"kv", l:"Umgebungsvariablen|Environment variables"},
  {k:"restartPolicy", t:"select", l:"restartPolicy",
    opts:[["","OnFailure"],["Never","Never"]]}
];

function jobPodSpec(d){
  return {
    restartPolicy: d.restartPolicy || "OnFailure",
    containers:[{
      name: d.name || "job",
      image: d.image,
      command: lines(d.command), args: lines(d.args),
      env: kvList(d.env)
    }]
  };
}

RES.Job = {
  group:"workloads", desc:"Läuft einmal bis zum Erfolg|Runs once until it succeeds",
  steps:[
    {id:"meta", title:"Metadaten|Metadata", desc:"", fields:metaFields(true)},
    {id:"pod", title:"Container", desc:"", fields:jobPodFields},
    {id:"spec", title:"Ausführung|Execution", desc:"",
     fields:[
      {k:"backoffLimit", t:"number", l:"backoffLimit", ph:"6", half:true},
      {k:"completions", t:"number", l:"completions", ph:"1", half:true},
      {k:"parallelism", t:"number", l:"parallelism", ph:"1", half:true},
      {k:"ttl", t:"number", l:"ttlSecondsAfterFinished", ph:"3600", half:true,
        hint:"Räumt den Job nach Ablauf automatisch weg.|Cleans the job up automatically afterwards."},
      {k:"deadline", t:"number", l:"activeDeadlineSeconds"}
     ]}
  ],
  build(d){
    return {apiVersion:"batch/v1", kind:"Job",
      metadata:{name:d.name, namespace:d.namespace||undefined, labels:kvObj(d.labels)},
      spec:{
        backoffLimit:num(d.backoffLimit), completions:num(d.completions),
        parallelism:num(d.parallelism), ttlSecondsAfterFinished:num(d.ttl),
        activeDeadlineSeconds:num(d.deadline),
        template:{spec: jobPodSpec(d)}
      }};
  }
};

RES.CronJob = {
  group:"workloads", desc:"Job nach Zeitplan|Job on a schedule",
  steps:[
    {id:"meta", title:"Metadaten|Metadata", desc:"", fields:metaFields(true)},
    {id:"sched", title:"Zeitplan|Schedule", desc:"Cron-Syntax: Minute Stunde Tag Monat Wochentag.|Cron syntax: minute hour day month weekday.",
     fields:[
      {k:"schedule", t:"text", l:"schedule", req:true, ph:"0 3 * * *",
        hint:"0 3 * * * = täglich um 03:00|0 3 * * * = daily at 03:00"},
      {k:"timeZone", t:"text", l:"timeZone", ph:"Europe/Berlin", half:true},
      {k:"concurrency", t:"select", l:"concurrencyPolicy", half:true,
        opts:[["","Allow"],["Forbid","Forbid"],["Replace","Replace"]]},
      {k:"suspend", t:"bool", l:"suspend (angehalten anlegen)|suspend (create paused)"},
      {k:"histOk", t:"number", l:"successfulJobsHistoryLimit", ph:"3", half:true},
      {k:"histFail", t:"number", l:"failedJobsHistoryLimit", ph:"1", half:true}
     ]},
    {id:"pod", title:"Container", desc:"", fields:jobPodFields}
  ],
  build(d){
    return {apiVersion:"batch/v1", kind:"CronJob",
      metadata:{name:d.name, namespace:d.namespace||undefined, labels:kvObj(d.labels)},
      spec:{
        schedule:d.schedule, timeZone:d.timeZone||undefined,
        concurrencyPolicy:d.concurrency||undefined,
        suspend: d.suspend || undefined,
        successfulJobsHistoryLimit:num(d.histOk), failedJobsHistoryLimit:num(d.histFail),
        jobTemplate:{spec:{template:{spec: jobPodSpec(d)}}}
      }};
  }
};

RES.PersistentVolume = {
  group:"config", desc:"Ein konkretes Stück Speicher, clusterweit|A concrete piece of storage, cluster-wide",
  steps:[
    {id:"meta", title:"Metadaten|Metadata",
     desc:"Ein PersistentVolume gehört keinem Namespace. Normalerweise legt die StorageClass es automatisch an — von Hand schreibt man eines, wenn der Speicher schon existiert: eine NFS-Freigabe, eine Platte an einem bestimmten Node, ein fertiges Volume beim Anbieter.|A PersistentVolume belongs to no namespace. Normally the storage class creates one automatically — you write one by hand when the storage already exists: an NFS share, a disk on a particular node, a ready-made volume at your provider.",
     fields:[
      {k:"name", t:"text", l:"Name|Name", req:true, ph:"data-pv-01"},
      {k:"labels", t:"kv", l:"Labels|Labels",
        hint:"Ein Claim kann darüber auswählen, statt das Volume beim Namen zu nennen.|A claim can select by these instead of naming the volume."},
      {k:"annotations", t:"kv", adv:true, l:"Annotations|Annotations"}
     ]},
    {id:"spec", title:"Größe & Klasse|Size & class",
     desc:"Die Angaben müssen zum Claim passen, sonst kommt die Bindung nie zustande.|These have to match the claim, otherwise binding never happens.",
     fields:[
      {k:"size", t:"text", l:"capacity.storage", req:true, ph:"10Gi", half:true},
      {k:"class", t:"text", l:"storageClassName", ph:"manual", half:true,
        hint:"Frei wählbar, muss aber im Claim genauso stehen. Leer heißt: nur ein Claim ohne Klasse passt dazu.|Free to choose, but the claim has to say the same. Empty means only a claim without a class fits."},
      {k:"access", t:"select", l:"accessMode",
        opts:[["","ReadWriteOnce"],["ReadOnlyMany","ReadOnlyMany"],["ReadWriteMany","ReadWriteMany"],["ReadWriteOncePod","ReadWriteOncePod"]]},
      {k:"mode", t:"select", l:"volumeMode", opts:[["","Filesystem"],["Block","Block"]]},
      {k:"reclaim", t:"select", l:"persistentVolumeReclaimPolicy",
        opts:[["","Retain — Volume bleibt liegen|Retain — the volume stays behind"],
              ["Delete","Delete — verschwindet mit dem Claim|Delete — goes away with the claim"]]},
      {k:"mountOptions", t:"lines", adv:true, l:"mountOptions", hint:"Eine Zeile pro Option, z. B. hard oder nfsvers=4.1|One line per option, e.g. hard or nfsvers=4.1"}
     ]},
    {id:"src", title:"Woher der Speicher kommt|Where the storage comes from", desc:"",
     fields:[
      {k:"src", t:"select", l:"Art|Kind", def:"local", structural:true,
        opts:[["local","local — Pfad auf einem bestimmten Node|local — a path on one particular node"],
              ["nfs","nfs — Netzwerkfreigabe|nfs — a network share"],
              ["csi","csi — vorhandenes Volume eines Treibers|csi — an existing volume of some driver"],
              ["hostPath","hostPath — Pfad auf dem Node, nur für Tests|hostPath — a path on the node, for testing only"]]},
      {k:"server", t:"text", l:"NFS-Server|NFS server", req:true, ph:"nfs.intern", half:true, when:d=>d.src==="nfs"},
      {k:"path", t:"text", l:"Pfad|Path", req:true, ph:"/export/data", half:true,
        when:d=>d.src!=="csi"},
      {k:"node", t:"text", l:"Node", req:true, ph:"worker-01", when:d=>d.src==="local",
        hint:"kubernetes.io/hostname des Nodes, auf dem die Platte steckt.|The kubernetes.io/hostname of the node the disk sits in."},
      {k:"hostType", t:"select", l:"hostPath.type", when:d=>d.src==="hostPath",
        opts:[["","DirectoryOrCreate"],["Directory","Directory"],["FileOrCreate","FileOrCreate"],["File","File"]]},
      {k:"driver", t:"text", l:"csi.driver", req:true, ph:"ebs.csi.aws.com", half:true, when:d=>d.src==="csi"},
      {k:"handle", t:"text", l:"csi.volumeHandle", req:true, ph:"vol-0a1b2c3d", half:true, when:d=>d.src==="csi"},
      {k:"attrs", t:"kv", adv:true, l:"csi.volumeAttributes", when:d=>d.src==="csi"},
      {k:"fsType", t:"text", adv:true, l:"fsType", ph:"ext4", half:true, when:d=>d.src==="csi"||d.src==="local"},
      {k:"readOnly", t:"bool", l:"readOnly", when:d=>d.src==="nfs"||d.src==="csi"}
     ]},
    {id:"bind", adv:true, title:"Reservierung|Reservation",
     desc:"Ohne Reservierung nimmt der erste passende Claim das Volume — auch ein fremder aus einem anderen Namespace.|Without a reservation the first matching claim takes the volume — including someone else's from another namespace.",
     fields:[
      {k:"claimName", t:"text", l:"claimRef · Name", ph:"data", half:true},
      {k:"claimNs", t:"text", l:"claimRef · Namespace", ph:"default", half:true}
     ]}
  ],
  build(d){
    const src = d.src || "local";
    const spec = {
      capacity:{storage:d.size},
      volumeMode: d.mode || undefined,
      accessModes:[d.access || "ReadWriteOnce"],
      persistentVolumeReclaimPolicy: d.reclaim || "Retain",
      storageClassName: d.class || undefined,
      mountOptions: lines(d.mountOptions),
      claimRef: d.claimName ? {name:d.claimName, namespace:d.claimNs || "default"} : undefined
    };
    if (src === "nfs") spec.nfs = {server:d.server, path:d.path, readOnly:d.readOnly || undefined};
    else if (src === "hostPath") spec.hostPath = {path:d.path, type:d.hostType || undefined};
    else if (src === "csi") spec.csi = {driver:d.driver, volumeHandle:d.handle,
      fsType:d.fsType || undefined, readOnly:d.readOnly || undefined, volumeAttributes:kvObj(d.attrs)};
    else {
      spec.local = {path:d.path, fsType:d.fsType || undefined};
      spec.nodeAffinity = d.node ? {required:{nodeSelectorTerms:[{matchExpressions:[
        {key:"kubernetes.io/hostname", operator:"In", values:[d.node]}]}]}} : undefined;
    }
    return {apiVersion:"v1", kind:"PersistentVolume",
      metadata:{name:d.name, labels:kvObj(d.labels), annotations:kvObj(d.annotations)},
      spec:spec};
  }
};

RES.PersistentVolumeClaim = {
  group:"config", desc:"Anforderung von dauerhaftem Speicher|Request for durable storage",
  steps:[
    {id:"meta", title:"Metadaten|Metadata", desc:"",
     fields:[{k:"name",t:"text",l:"Name|Name",req:true,ph:"data"},
             {k:"namespace",t:"text",l:"Namespace|Namespace"},
             {k:"labels",t:"kv",l:"Labels|Labels"}]},
    {id:"spec", title:"Speicher|Storage", desc:"ReadWriteOnce ist der übliche Fall — ein Node schreibt.|ReadWriteOnce is the usual case — one node writes.",
     fields:[
      {k:"size", t:"text", l:"Größe|Size", req:true, ph:"10Gi", half:true},
      {k:"class", t:"text", l:"storageClassName", ph:"standard", half:true},
      {k:"access", t:"select", l:"accessMode",
        opts:[["","ReadWriteOnce"],["ReadOnlyMany","ReadOnlyMany"],["ReadWriteMany","ReadWriteMany"],["ReadWriteOncePod","ReadWriteOncePod"]]},
      {k:"mode", t:"select", l:"volumeMode",
        opts:[["","Filesystem"],["Block","Block"]]}
     ]},
    {id:"bind", title:"Bereitstellung|Provisioning",
     desc:"Normalerweise legt die StorageClass das Volume selbst an. Existiert der Speicher schon — als PersistentVolume von Hand geschrieben —, muss der Claim ausdrücklich darauf zeigen.|Normally the storage class creates the volume itself. If the storage already exists — written by hand as a PersistentVolume — the claim has to point at it explicitly.",
     fields:[
      {k:"bindMode", t:"select", l:"Woher das Volume kommt|Where the volume comes from", structural:true,
        opts:[["","dynamisch — die StorageClass legt es an|dynamic — the storage class creates it"],
              ["static","statisch — an ein vorhandenes PersistentVolume binden|static — bind to an existing PersistentVolume"]]},
      {k:"volumeName", t:"text", l:"volumeName", ph:"data-pv-01", when:d=>d.bindMode==="static",
        hint:"Der Name des PersistentVolume. Leer lassen, wenn stattdessen über Labels ausgewählt wird.|The name of the PersistentVolume. Leave empty if you select by labels instead."},
      {k:"pvSel", t:"kv", l:"…oder Auswahl über Labels|…or select by labels", when:d=>d.bindMode==="static"},
      {k:"emptyClass", t:"bool", def:true, l:"storageClassName ausdrücklich leer setzen|Set storageClassName to empty explicitly",
        when:d=>d.bindMode==="static",
        hint:"Ohne diese Zeile springt die Standard-StorageClass ein und legt ein zweites, dynamisches Volume an — das vorhandene bleibt unberührt liegen.|Without this line the default storage class steps in and provisions a second, dynamic volume — the existing one stays untouched."}
     ]}
  ],
  build(d){
    const staticBind = d.bindMode === "static";
    return {apiVersion:"v1", kind:"PersistentVolumeClaim",
      metadata:{name:d.name, namespace:d.namespace||undefined, labels:kvObj(d.labels)},
      spec:{
        accessModes:[d.access || "ReadWriteOnce"],
        volumeMode: d.mode || undefined,
        storageClassName: d.class || (staticBind && d.emptyClass ? EMPTY_STR : undefined),
        volumeName: staticBind ? (d.volumeName || undefined) : undefined,
        selector: staticBind && kvObj(d.pvSel) ? {matchLabels:kvObj(d.pvSel)} : undefined,
        resources:{requests:{storage:d.size}}
      }};
  }
};

RES.NetworkPolicy = {
  group:"network", desc:"Wer darf mit diesen Pods sprechen|Who is allowed to talk to these pods",
  steps:[
    {id:"meta", title:"Metadaten|Metadata", desc:"",
     fields:[{k:"name",t:"text",l:"Name|Name",req:true,ph:"shop-api"},
             {k:"namespace",t:"text",l:"Namespace|Namespace"},
             {k:"target",t:"select",l:"Gilt für|Applies to",structural:true,
              opts:[["","eine Anwendung|one application"],["all","alle Pods im Namespace|all pods in the namespace"]]},
             {k:"app",t:"text",l:"Pod-Label app|Pod label app",ph:"shop-api",when:d=>d.target!=="all"}]},
    {id:"rules", title:"Eingehend|Ingress", desc:"Ohne Regel ist alles verboten — genau das ist der Zweck einer Default-Deny-Policy.|With no rule everything is denied — which is exactly the point of a default-deny policy.",
     fields:[
      {k:"fromNs", t:"text", l:"Erlaubt aus Namespace|Allow from namespace", ph:"ingress-nginx",
        hint:"Matcht auf kubernetes.io/metadata.name. Leer = nichts erlaubt.|Matches kubernetes.io/metadata.name. Empty = nothing allowed."},
      {k:"fromApp", t:"text", l:"Erlaubt von Pods mit app|Allow from pods labelled app", ph:"frontend"},
      {k:"port", t:"number", l:"Auf Port|On port", ph:"8080", half:true},
      {k:"egress", t:"bool", l:"Ausgehenden Verkehr ebenfalls sperren|Deny egress as well",
        hint:"Nur setzen, wenn du DNS und die Ziele bewusst freigibst — sonst erreicht der Pod nichts mehr.|Only set this if you deliberately allow DNS and the destinations — otherwise the pod reaches nothing."}
     ]}
  ],
  build(d){
    const froms = [];
    if (d.fromNs) froms.push({namespaceSelector:{matchLabels:{"kubernetes.io/metadata.name": d.fromNs}}});
    if (d.fromApp) froms.push({podSelector:{matchLabels:{app: d.fromApp}}});
    const rule = {};
    if (froms.length) rule.from = froms;
    if (num(d.port) !== undefined) rule.ports = [{protocol:"TCP", port:num(d.port)}];
    return {apiVersion:"networking.k8s.io/v1", kind:"NetworkPolicy",
      metadata:{name:d.name, namespace:d.namespace||undefined, labels:kvObj(d.labels)},
      spec:{
        podSelector: d.target === "all" ? EMPTY_MAP : {matchLabels:{app: d.app || d.name}},
        policyTypes: d.egress ? ["Ingress","Egress"] : ["Ingress"],
        ingress: Object.keys(rule).length ? [rule] : undefined
      }};
  }
};

RES.PodDisruptionBudget = {
  group:"network", desc:"Schützt vor zu vielen gleichzeitigen Neustarts|Guards against too many simultaneous restarts",
  steps:[
    {id:"meta", title:"Metadaten|Metadata", desc:"Greift bei freiwilligen Störungen — Node-Drain, Cluster-Upgrade. Bei Abstürzen hilft es nicht.|Applies to voluntary disruptions — node drains, cluster upgrades. It does not help against crashes.",
     fields:[{k:"name",t:"text",l:"Name|Name",req:true,ph:"shop-api"},
             {k:"namespace",t:"text",l:"Namespace|Namespace"},
             {k:"app",t:"text",l:"Pod-Label app|Pod label app",ph:"shop-api"},
             {k:"mode",t:"select",l:"Regel|Rule",structural:true,
              opts:[["","minAvailable"],["max","maxUnavailable"]]},
             {k:"value",t:"text",l:"Wert|Value",ph:"1",def:"1",
              hint:"Absolute Zahl oder Prozent, z. B. 1 oder 50%.|Absolute number or percentage, e.g. 1 or 50%."}]}
  ],
  build(d){
    const v = /^\d+$/.test(String(d.value||"")) ? num(d.value) : (d.value || 1);
    const spec = {selector:{matchLabels:{app: d.app || d.name}}};
    if (d.mode === "max") spec.maxUnavailable = v; else spec.minAvailable = v;
    return {apiVersion:"policy/v1", kind:"PodDisruptionBudget",
      metadata:{name:d.name, namespace:d.namespace||undefined, labels:kvObj(d.labels)},
      spec:spec};
  }
};

RES.HorizontalPodAutoscaler = {
  group:"workloads", desc:"Replicas automatisch an die Last anpassen|Adjust replicas to load automatically",
  steps:[
    {id:"meta", title:"Ziel|Target",
     desc:"Der HPA übernimmt die Kontrolle über die Replica-Zahl. Steht replicas weiterhin im Deployment-Manifest, streiten sich beide bei jedem Apply.|The HPA takes over the replica count. If replicas stays in the Deployment manifest, the two fight on every apply.",
     fields:[
      {k:"name", t:"text", l:"Name|Name", req:true, ph:"shop-api"},
      {k:"namespace", t:"text", l:"Namespace|Namespace", half:true},
      {k:"targetKind", t:"select", l:"Ziel-Typ|Target kind", half:true,
        opts:[["Deployment","Deployment"],["StatefulSet","StatefulSet"]]},
      {k:"targetName", t:"text", l:"Ziel-Name|Target name", ph:"= Name|= name"}
     ]},
    {id:"scale", title:"Grenzen|Bounds", desc:"",
     fields:[
      {k:"min", t:"number", l:"minReplicas", def:2, min:1, half:true},
      {k:"max", t:"number", l:"maxReplicas", def:10, min:1, half:true},
      {k:"cpu", t:"number", l:"CPU-Auslastung in %|CPU utilisation in %", def:70, half:true,
        hint:"Prozent von requests.cpu, nicht von limits. Ohne gesetzte requests kann der HPA gar nichts rechnen.|Percentage of requests.cpu, not of limits. Without requests set, the HPA cannot compute anything at all."},
      {k:"mem", t:"number", l:"Speicher-Auslastung in %|Memory utilisation in %", half:true,
        hint:"Meist wenig sinnvoll: Viele Laufzeiten geben Speicher nie zurück, also skaliert es nur nach oben.|Usually of little use: many runtimes never return memory, so it only ever scales up."},
      {k:"stabilize", t:"number", adv:true, l:"Beruhigung beim Runterskalieren (s)|Scale-down stabilisation (s)", ph:"300",
        hint:"Wie lange gewartet wird, bevor tatsächlich verkleinert wird. Verhindert Zappeln bei schwankender Last.|How long to wait before actually shrinking. Prevents flapping under fluctuating load."}
     ]}
  ],
  build(d){
    const metrics = [];
    if (num(d.cpu) !== undefined) metrics.push({type:"Resource",
      resource:{name:"cpu", target:{type:"Utilization", averageUtilization:num(d.cpu)}}});
    if (num(d.mem) !== undefined) metrics.push({type:"Resource",
      resource:{name:"memory", target:{type:"Utilization", averageUtilization:num(d.mem)}}});
    const st = num(d.stabilize);
    return {apiVersion:"autoscaling/v2", kind:"HorizontalPodAutoscaler",
      metadata:{name:d.name, namespace:d.namespace||undefined, labels:kvObj(d.labels)},
      spec:{
        scaleTargetRef:{apiVersion:"apps/v1", kind:d.targetKind || "Deployment", name:d.targetName || d.name},
        minReplicas: num(d.min) === undefined ? 2 : num(d.min),
        maxReplicas: num(d.max) === undefined ? 10 : num(d.max),
        metrics: metrics.length ? metrics : undefined,
        behavior: st !== undefined ? {scaleDown:{stabilizationWindowSeconds:st}} : undefined
      }};
  }
};

const VERB_PRESETS = [
  ["read","nur lesen — get, list, watch|read only — get, list, watch"],
  ["write","lesen und ändern — get, list, watch, create, update, patch|read and write — get, list, watch, create, update, patch"],
  ["full","alles inklusive delete|everything including delete"],
  ["custom","eigene Liste|custom list"]
];
const VERB_MAP = {
  read:["get","list","watch"],
  write:["get","list","watch","create","update","patch"],
  full:["get","list","watch","create","update","patch","delete"]
};

RES.RBAC = {
  group:"config", multi:true, label:"Zugriffsrechte (RBAC)|Access rights (RBAC)",
  desc:"ServiceAccount, Role und Binding in einem Zug|ServiceAccount, Role and binding in one go",
  steps:[
    {id:"meta", title:"Identität|Identity",
     desc:"Ein ServiceAccount ist die Identität, unter der ein Pod mit der Kubernetes-API spricht. Ohne zugewiesene Rechte darf er praktisch nichts — und das ist der richtige Ausgangspunkt.|A service account is the identity a pod uses to talk to the Kubernetes API. Without granted rights it may do essentially nothing — and that is the right starting point.",
     fields:[
      {k:"name", t:"text", l:"Name|Name", req:true, ph:"shop-api",
        hint:"Wird für ServiceAccount, Role und Binding gleichermaßen verwendet.|Used for the service account, the role and the binding alike."},
      {k:"namespace", t:"text", l:"Namespace|Namespace", half:true},
      {k:"createSA", t:"bool", l:"ServiceAccount mit anlegen|Create the service account too", def:true},
      {k:"saExisting", t:"text", adv:true, l:"…oder vorhandenen verwenden|…or use an existing one",
        ph:"default", when:d=>!d.createSA}
     ]},
    {id:"scope", title:"Geltungsbereich|Scope",
     desc:"",
     fields:[
      {k:"scope", t:"select", l:"Reichweite|Reach", structural:true,
        opts:[["","Role — nur dieser Namespace|Role — this namespace only"],
              ["cluster","ClusterRole — der ganze Cluster|ClusterRole — the whole cluster"]],
        why:"Eine Role gilt ausschließlich in ihrem Namespace. Eine ClusterRole gilt überall und ist damit auch überall gefährlich. Es gibt einen Zwischenweg, den viele übersehen: eine ClusterRole per RoleBinding einbinden — dann gelten ihre Regeln nur im Namespace des Bindings. So verwendet man die eingebauten Rollen view und edit, ohne clusterweite Rechte zu vergeben.|A Role applies only within its namespace. A ClusterRole applies everywhere and is therefore dangerous everywhere. There is a middle path many people miss: bind a ClusterRole with a RoleBinding — then its rules apply only in the binding's namespace. That is how you use the built-in view and edit roles without granting cluster-wide access."},
      {k:"source", t:"select", l:"Regeln|Rules", structural:true,
        opts:[["","eingebaute Rolle verwenden|use a built-in role"],["own","eigene Regeln schreiben|write custom rules"]]},
      {k:"builtin", t:"select", l:"Eingebaute Rolle|Built-in role", when:d=>!d.source,
        opts:[["view","view — alles lesen außer Secrets|view — read everything except secrets"],
              ["edit","edit — lesen und ändern, keine Rechtevergabe|edit — read and write, no rights management"],
              ["admin","admin — alles im Namespace inklusive Rechtevergabe|admin — everything in the namespace including rights"],
              ["cluster-admin","cluster-admin — uneingeschränkt|cluster-admin — unrestricted"]],
        hint:"Diese Rollen bringt Kubernetes mit, sie werden nicht angelegt — nur gebunden.|Kubernetes ships these roles; they are not created here, only bound."},
      {k:"rules", t:"list", l:"Regeln|Rules", when:d=>d.source==="own", item:[
        {k:"group", t:"select", l:"apiGroup", opts:[
          ["","\"\" — Core (pods, services, configmaps…)"],
          ["apps","apps (deployments, statefulsets)"],
          ["batch","batch (jobs, cronjobs)"],
          ["networking.k8s.io","networking.k8s.io (ingresses, netpols)"],
          ["rbac.authorization.k8s.io","rbac.authorization.k8s.io"],
          ["autoscaling","autoscaling (hpa)"]]},
        {k:"resources", t:"text", l:"resources", ph:"pods,pods/log"},
        {k:"verbs", t:"select", l:"Zugriff|Access", opts:VERB_PRESETS},
        {k:"custom", t:"text", l:"eigene verbs|custom verbs", ph:"get,list,create"}
      ], why:"apiGroup bleibt für die Kern-Ressourcen leer — pods, services, configmaps und secrets liegen in der Gruppe mit dem leeren Namen. Deployments stehen in apps, Jobs in batch. resources werden immer im Plural und in Kleinschreibung geschrieben, so wie sie kubectl api-resources auflistet.|The apiGroup stays empty for core resources — pods, services, configmaps and secrets live in the group with the empty name. Deployments are in apps, jobs in batch. resources are always plural and lowercase, exactly as kubectl api-resources lists them."}
     ]}
  ],
  build(d){
    const name = d.name;
    if (!name) return [];
    const ns = d.namespace || undefined;
    const out = [];
    const sa = d.createSA ? name : (d.saExisting || "default");
    const cluster = d.scope === "cluster";
    const own = d.source === "own";
    const labels = kvObj(d.labels);

    if (d.createSA) out.push({apiVersion:"v1", kind:"ServiceAccount",
      metadata:{name:name, namespace:ns, labels:labels}});

    let roleName = own ? name : (d.builtin || "view");
    if (own) out.push({
      apiVersion:"rbac.authorization.k8s.io/v1",
      kind: cluster ? "ClusterRole" : "Role",
      metadata:{name:name, namespace: cluster ? undefined : ns, labels:labels},
      rules: (d.rules||[]).filter(r => r.resources).map(r => ({
        apiGroups:[r.group || EMPTY_STR],
        resources: String(r.resources).split(",").map(x => x.trim()).filter(Boolean),
        verbs: r.verbs === "custom"
          ? String(r.custom || "get").split(",").map(x => x.trim()).filter(Boolean)
          : (VERB_MAP[r.verbs] || VERB_MAP.read)
      }))
    });

    const bindKind = cluster && !ns ? "ClusterRoleBinding" : "RoleBinding";
    out.push({
      apiVersion:"rbac.authorization.k8s.io/v1",
      kind: bindKind,
      metadata:{name:name, namespace: bindKind === "RoleBinding" ? ns : undefined, labels:labels},
      roleRef:{apiGroup:"rbac.authorization.k8s.io",
        kind: (own && !cluster) ? "Role" : "ClusterRole", name: roleName},
      subjects:[{kind:"ServiceAccount", name:sa, namespace: ns || "default"}]
    });
    return out;
  }
};

RES._stack = {
  group:"preset", multi:true, label:"Komplette Anwendung|Complete application",
  desc:"Namespace, Config, Storage, Deployment, Service und Ingress in einem Durchgang|Namespace, config, storage, Deployment, Service and Ingress in one pass",
  steps:[
    {id:"app", title:"Anwendung|Application",
     desc:"Der Name trägt sich durch alles durch: Labels, Selector, ConfigMap-Namen, Ingress. Einmal hier richtig, überall richtig.|The name carries through everything: labels, selector, ConfigMap names, ingress. Get it right here and it is right everywhere.",
     fields:[
      {k:"name", t:"text", l:"App-Name|App name", req:true, ph:"my-app",
        hint:"Kleinbuchstaben, Ziffern, Bindestrich.|Lowercase, digits, hyphen."},
      {k:"namespace", t:"text", l:"Namespace|Namespace", ph:"default", half:true, structural:true},
      {k:"createNs", t:"bool", adv:true, l:"Namespace mit anlegen|Create the namespace too"},
      {k:"image", t:"text", l:"Image|Image", req:true, ph:"nginx:1.27-alpine"},
      {k:"port", t:"number", l:"Container-Port|Container port", req:true, ph:"8080", half:true},
      {k:"replicas", t:"number", l:"Replicas|Replicas", def:2, min:0, half:true},
      {k:"workload", t:"select", l:"Art der Anwendung|Kind of application", structural:true,
        opts:[["","zustandslos — Deployment|stateless — Deployment"],
              ["sts","zustandsbehaftet — StatefulSet|stateful — StatefulSet"]],
        hint:"Zustandsbehaftet heißt: jeder Pod behält seinen Namen und sein eigenes Volume. Nötig für Datenbanken und für alles, wo mehrere Replicas nicht auf denselben Daten schreiben dürfen.|Stateful means each pod keeps its name and its own volume. Required for databases and for anything where several replicas must not write to the same data.",
        why:"Beim Deployment sind alle Pods austauschbar und teilen sich ein Volume — bei ReadWriteOnce klemmt es damit ab der zweiten Replica. Ein StatefulSet gibt jedem Pod ein eigenes Volume über volumeClaimTemplates, dafür braucht es einen headless Service und Updates laufen der Reihe nach.|With a Deployment all pods are interchangeable and share one volume — with ReadWriteOnce that jams from the second replica onwards. A StatefulSet gives each pod its own volume via volumeClaimTemplates, but it needs a headless service and updates proceed in order."},
      {k:"pullPolicy", t:"select", adv:true, l:"imagePullPolicy", half:true,
        opts:[["","IfNotPresent (Standard)|IfNotPresent (default)"],["Always","Always"],["Never","Never"]]},
      {k:"privateReg", t:"select", adv:true, l:"Registry|Registry", structural:true,
        opts:[["","öffentlich — keine Anmeldung|public — no credentials"],
              ["new","privat — Zugangsdaten hier eingeben|private — enter credentials here"],
              ["existing","privat — Secret existiert bereits|private — secret already exists"]]},
      {k:"pullSecret", t:"text", adv:true, l:"imagePullSecrets", ph:"harbor-cred", when:d=>d.privateReg==="existing"},
      {k:"regServer", t:"text", adv:true, l:"Registry-Host|Registry host", ph:"harbor.firma.de", when:d=>d.privateReg==="new",
        hint:"Nur der Host, ohne Projekt und ohne https://|Host only, without the project and without https://"},
      {k:"regUser", t:"text", adv:true, l:"Benutzer|Username", ph:"robot$plattform+k8s", half:true, when:d=>d.privateReg==="new",
        hint:"In Harbor am besten ein Robot Account.|In Harbor, a robot account is the right choice."},
      {k:"regPass", t:"text", secret:true, adv:true, l:"Token / Passwort|Token / password", half:true, when:d=>d.privateReg==="new"},
      {k:"command", t:"lines", adv:true, l:"command", hint:"Eine Zeile pro Argument. Leer = Entrypoint des Images.|One line per argument. Empty = image entrypoint."}
     ]},

    {id:"cfg", title:"Konfiguration|Configuration",
     desc:"Variablen und Dateien. Was du hier einträgst, wird zu ConfigMaps und Secrets, die das Deployment automatisch einbindet.|Variables and files. Whatever you enter here becomes ConfigMaps and Secrets that the Deployment wires up automatically.",
     fields:[
      {k:"env", t:"kv", l:"Variablen direkt im Pod|Variables inline in the pod",
        hint:"Landen als env im Deployment.|Emitted as env in the Deployment."},
      {k:"cfg", t:"kv", adv:true, l:"Variablen aus ConfigMap|Variables from a ConfigMap",
        hint:"Werden zu <name>-config und per envFrom geladen.|Become <name>-config and are loaded via envFrom."},
      {k:"secretBackend", t:"select", adv:true, structural:true, l:"Geheimnisse ausliefern als|Deliver secrets as",
        opts:[["","Secret — Klartext im Manifest|Secret — plaintext in the manifest"],
              ["sealed","SealedSecret — verschlüsselt, Git-fähig|SealedSecret — encrypted, safe for Git"],
              ["external","ExternalSecret — Verweis auf einen Tresor|ExternalSecret — reference to a vault"]]},
      {k:"secretStore", t:"text", adv:true, l:"SecretStore", ph:"vault-backend", when:d=>d.secretBackend==="external"},
      {k:"secretPath", t:"text", adv:true, l:"Pfad im Tresor|Path in the vault", ph:"secret/data/shop", when:d=>d.secretBackend==="external"},
      {k:"secrets", t:"kv", secret:true, adv:true, l:"Vertrauliche Variablen|Confidential variables",
        hint:"Werden zu <name>-secrets. Klartext im Manifest — Datei nicht ins Repo.|Become <name>-secrets. Plaintext in the manifest — keep the file out of your repo."},
      {k:"files", t:"list", adv:true, l:"Konfigurationsdateien|Configuration files", item:[
        {k:"name", t:"text", l:"Dateiname|File name", ph:"app.conf"},
        {k:"content", t:"textarea", l:"Inhalt|Content", full:true}
      ]},
      {k:"filesPath", t:"text", adv:true, l:"Dateien mounten unter|Mount files at", ph:"/etc/app",
        hint:"Nur nötig, wenn oben Dateien angelegt sind.|Only needed when files are defined above."}
     ]},

    {id:"store", title:"Speicher|Storage",
     desc:"Nur wenn der Container Daten über einen Neustart hinaus behalten muss.|Only if the container has to keep data across a restart.",
     fields:[
      {k:"storage", t:"bool", l:"Dauerhaften Speicher anfordern|Request persistent storage", structural:true,
        hint:"Beim StatefulSet wird daraus ein volumeClaimTemplate — jeder Pod bekommt sein eigenes Volume. Beim Deployment ein einzelnes PVC, das alle Pods teilen.|With a StatefulSet this becomes a volumeClaimTemplate — every pod gets its own volume. With a Deployment it becomes a single PVC shared by all pods."},
      {k:"size", t:"text", l:"Größe|Size", ph:"10Gi", half:true, when:d=>d.storage},
      {k:"storageClass", t:"text", adv:true, l:"storageClassName", ph:"standard", half:true, when:d=>d.storage},
      {k:"mountPath", t:"text", l:"mountPath", ph:"/var/lib/data", when:d=>d.storage},
      {k:"access", t:"select", adv:true, l:"accessMode", when:d=>d.storage,
        opts:[["","ReadWriteOnce"],["ReadWriteMany","ReadWriteMany"],["ReadOnlyMany","ReadOnlyMany"],["ReadWriteOncePod","ReadWriteOncePod"]]}
     ]},

    {id:"net", title:"Erreichbarkeit|Reachability",
     desc:"Der Service gibt der Anwendung eine feste Adresse im Cluster. Der Ingress bringt sie von außen erreichbar.|The Service gives the app a fixed address inside the cluster. The Ingress makes it reachable from outside.",
     fields:[
      {k:"svcType", t:"select", l:"Service|Service", structural:true,
        opts:[["","ClusterIP — nur im Cluster|ClusterIP — cluster internal"],
              ["NodePort","NodePort — Port auf jedem Node|NodePort — port on every node"],
              ["LoadBalancer","LoadBalancer — externe IP|LoadBalancer — external IP"],
              ["none","kein Service|no Service"]]},
      {k:"svcPort", t:"number", l:"Service-Port|Service port", def:80, half:true, when:d=>d.svcType!=="none"},
      {k:"nodePort", t:"number", adv:true, l:"nodePort", ph:"30080", half:true, when:d=>d.svcType==="NodePort"},
      {k:"ingress", t:"bool", l:"Ingress anlegen|Create an Ingress", structural:true, when:d=>d.svcType!=="none"},
      {k:"host", t:"text", l:"Host|Host", ph:"app.example.com", when:d=>d.ingress},
      {k:"path", t:"text", adv:true, l:"Pfad|Path", ph:"/", half:true, when:d=>d.ingress},
      {k:"ingressClass", t:"text", adv:true, l:"ingressClassName", ph:"nginx", half:true, when:d=>d.ingress},
      {k:"tls", t:"bool", l:"TLS aktivieren|Enable TLS", structural:true, when:d=>d.ingress},
      {k:"tlsSecret", t:"text", adv:true, l:"secretName", ph:"= <name>-tls", when:d=>d.ingress&&d.tls},
      {k:"ingressAnn", t:"kv", adv:true, l:"Ingress-Annotations|Ingress annotations", when:d=>d.ingress}
     ]},

    {id:"ops", adv:true, title:"Betrieb|Operations",
     desc:"Grenzen und Health checks. Ohne diese Angaben läuft die Anwendung, aber der Scheduler fliegt blind.|Limits and health checks. The app runs without them, but the scheduler is flying blind.",
     fields:[
      {k:"cpuReq", t:"text", l:"requests.cpu", ph:"100m", def:"100m", half:true},
      {k:"memReq", t:"text", l:"requests.memory", ph:"128Mi", def:"128Mi", half:true},
      {k:"cpuLim", t:"text", l:"limits.cpu", ph:"500m", def:"500m", half:true},
      {k:"memLim", t:"text", l:"limits.memory", ph:"512Mi", def:"512Mi", half:true},
      {k:"probe", t:"select", l:"Health check|Health check", def:"http", structural:true,
        opts:[["http","httpGet"],["tcp","tcpSocket"],["","keiner|none"]]},
      {k:"probePath", t:"text", l:"Pfad|Path", ph:"/healthz", def:"/healthz", when:d=>d.probe==="http"},
      {k:"probeStartup", t:"bool", l:"startupProbe zusätzlich|Add a startupProbe as well", when:d=>!!d.probe,
        hint:"Deckt das Hochfahren ab, damit die livenessProbe eine langsam startende Anwendung nicht im Kreis neu startet.|Covers the startup phase so the liveness probe does not restart a slow-starting app in a loop."},
      {k:"sa", t:"text", l:"serviceAccountName", ph:"default", half:true},
      {k:"stdLabels", t:"bool", structural:true, def:true,
        l:"Empfohlene app.kubernetes.io-Labels setzen|Add the recommended app.kubernetes.io labels",
        hint:"Auf allen erzeugten Dokumenten. Der Selector bleibt bewusst nur app.|On every generated document. The selector stays app only on purpose."},
      {k:"component", t:"text", l:"app.kubernetes.io/component", ph:"backend", half:true, when:d=>d.stdLabels},
      {k:"partOf", t:"text", l:"app.kubernetes.io/part-of", ph:"shop", half:true, when:d=>d.stdLabels},
      {k:"hpa", t:"bool", l:"Automatisch skalieren (HPA)|Autoscale (HPA)", structural:true,
        hint:"Der HPA übernimmt dann die Replica-Zahl. Braucht zwingend gesetzte requests.cpu — die Auslastung wird prozentual dazu gerechnet.|The HPA then owns the replica count. Requires requests.cpu to be set — utilisation is computed relative to it."},
      {k:"hpaMin", t:"number", l:"minReplicas", def:2, half:true, when:d=>d.hpa},
      {k:"hpaMax", t:"number", l:"maxReplicas", def:10, half:true, when:d=>d.hpa},
      {k:"hpaCpu", t:"number", l:"CPU-Ziel in %|CPU target in %", def:70, half:true, when:d=>d.hpa},
      {k:"pdb", t:"bool", l:"PodDisruptionBudget anlegen|Create a PodDisruptionBudget", structural:true,
        hint:"Sinnvoll ab zwei Replicas. Verhindert, dass ein Node-Drain alle Pods gleichzeitig wegnimmt.|Useful from two replicas up. Stops a node drain from taking all pods at once."},
      {k:"pdbValue", t:"text", l:"minAvailable", ph:"1", def:"1", half:true, when:d=>d.pdb},
      {k:"netpol", t:"select", l:"NetworkPolicy|NetworkPolicy", structural:true,
        opts:[["","keine|none"],
              ["app","nur für diese Anwendung|for this application only"],
              ["deny","zusätzlich Default-Deny für den Namespace|plus default-deny for the namespace"]]},
      {k:"netpolNs", t:"text", l:"Ingress-Controller läuft in Namespace|Ingress controller runs in namespace",
        ph:"ingress-nginx", def:"ingress-nginx", when:d=>d.netpol},
      {k:"hardened", t:"bool", l:"Restricted-Härtung anwenden|Apply restricted hardening", def:true,
        hint:"Erfüllt den Pod Security Standard restricted. Wenn der Container ins Dateisystem schreiben muss, außerhalb von /tmp, dann hier aus.|Meets the restricted Pod Security Standard. Turn it off if the container has to write outside /tmp."},
      {k:"runAsNonRoot", t:"bool", l:"runAsNonRoot erzwingen|Enforce runAsNonRoot", def:true}
     ]}
  ],

  build(d){
    const name = d.name, ns = d.namespace || undefined, out = [];
    if (!name) return [];

    const cfgPairs = (d.cfg||[]).filter(p=>p.k);
    const secPairs = (d.secrets||[]).filter(p=>p.k);
    const files    = (d.files||[]).filter(f=>f.name && f.content);
    const cmName   = name + "-config";
    const fileName = name + "-files";
    const secName  = name + "-secrets";
    const pvcName  = name + "-data";
    const regName  = name + "-registry";

    const makeReg = d.privateReg === "new" && d.regServer && d.regUser;
    const pullSecret = makeReg ? regName : (d.privateReg === "existing" ? d.pullSecret : "");
    const lbl = toPairs(allLabels(d, {app:name}));

    if (d.createNs && ns) out.push(RES.Namespace.build({name:ns, labels:[{k:"name", v:ns}]}));
    if (makeReg) out.push(RES.Secret.build({
      name:regName, namespace:ns, type:"kubernetes.io/dockerconfigjson", labels:lbl,
      regServer:d.regServer, regUser:d.regUser, regPass:d.regPass}));
    if (cfgPairs.length) out.push(RES.ConfigMap.build({name:cmName, namespace:ns, data:cfgPairs, labels:lbl}));
    if (files.length)    out.push(RES.ConfigMap.build({name:fileName, namespace:ns, files:files, labels:lbl}));
    const secBackend = d.secretBackend || "";
    const wantsSecret = secBackend === "external" ? !!d.secretPath : secPairs.length > 0;
    if (wantsSecret) out.push(RES.Secret.build({
      name:secName, namespace:ns, data:secPairs, labels:lbl,
      backend:secBackend, sealedScope:d.sealedScope,
      store:d.secretStore, extPath:d.secretPath, extMode:""}));
    const isSts = d.workload === "sts";
    if (d.storage && !isSts) out.push(RES.PersistentVolumeClaim.build({
      name:pvcName, namespace:ns, size:d.size || "1Gi", class:d.storageClass, access:d.access, labels:lbl}));

    const workloadData = {
      name:name, namespace:ns, image:d.image, replicas:d.replicas,
      pullPolicy:d.pullPolicy, pullSecret:pullSecret, command:d.command,
      stdLabels:d.stdLabels, component:d.component, partOf:d.partOf,
      ports: d.port ? [{name:"http", containerPort:d.port}] : [],
      env:d.env,
      envCM: cfgPairs.length ? cmName : "",
      envSec: wantsSecret ? secName : "",
      volumes: (files.length && d.filesPath) ? [{cm:fileName, path:d.filesPath}] : [],
      pvc: d.storage ? pvcName : "", pvcPath: d.storage ? d.mountPath : "",
      cpuReq:d.cpuReq, memReq:d.memReq, cpuLim:d.cpuLim, memLim:d.memLim,
      probe:d.probe, probePath:d.probePath, probePort:d.port, probeStartup:d.probeStartup,
      sa:d.sa, runAsNonRoot:d.runAsNonRoot, hardened:d.hardened
    };
    if (isSts){
      workloadData.pvc = ""; workloadData.pvcPath = "";
      workloadData.serviceName = name;
      workloadData.vct = d.storage ? [{name:"data", path:d.mountPath || "/var/lib/data",
        size:d.size || "1Gi", class:d.storageClass, access:d.access}] : [];
      out.push(RES.StatefulSet.build(workloadData));
    } else {
      out.push(RES.Deployment.build(workloadData));
    }

    const svcPort = num(d.svcPort) === undefined ? 80 : num(d.svcPort);
    if (d.svcType !== "none"){
      out.push(RES.Service.build({
        name:name, namespace:ns, type:d.svcType, labels:lbl,
        headless: isSts && !d.svcType,
        selector:[{k:"app", v:name}],
        ports:[{name:"http", port:svcPort, targetPort:d.port, nodePort:d.nodePort}]
      }));
      if (d.ingress) out.push(RES.Ingress.build({
        name:name, namespace:ns, class:d.ingressClass, annotations:d.ingressAnn, labels:lbl,
        host:d.host, tls:d.tls, tlsSecret:d.tlsSecret || (name + "-tls"),
        paths:[{path:d.path || "/", pathType:"", svc:name, port:svcPort}]
      }));
    }

    if (d.hpa) out.push(RES.HorizontalPodAutoscaler.build({
      name:name, namespace:ns, labels:lbl,
      targetKind: isSts ? "StatefulSet" : "Deployment", targetName:name,
      min:d.hpaMin, max:d.hpaMax, cpu:d.hpaCpu}));

    if (d.pdb) out.push(RES.PodDisruptionBudget.build({
      name:name, namespace:ns, app:name, value:d.pdbValue || "1", labels:lbl}));

    if (d.netpol){
      if (d.netpol === "deny") out.push(RES.NetworkPolicy.build({
        name:"default-deny-ingress", namespace:ns, target:"all"}));
      out.push(RES.NetworkPolicy.build({
        name:name, namespace:ns, app:name, labels:lbl,
        fromNs: d.ingress ? (d.netpolNs || "ingress-nginx") : "",
        port: d.port
      }));
    }
    return out;
  }
};

/* Empfehlungen je Ressource. Bewusst kurz und bewusst wertend — was ohnehin
   im Feld danebensteht, gehört hier nicht noch einmal hin. */
const BEST = {
Namespace:[
 "Ein Namespace je Team oder Umgebung, nicht je Anwendung — sonst wächst die Zahl schneller als die Übersicht.|One namespace per team or environment, not per application — otherwise the count grows faster than the overview.",
 "`pod-security.kubernetes.io/enforce` als Label setzen, dann weist der Cluster unsichere Pods von sich aus ab.|Set `pod-security.kubernetes.io/enforce` as a label and the cluster rejects unsafe pods on its own.",
 "ResourceQuota und LimitRange gehören dazu, sonst kann eine einzelne Anwendung den ganzen Cluster belegen.|A ResourceQuota and a LimitRange belong with it, otherwise a single application can occupy the whole cluster.",
 "Steht der Namespace im selben Manifest, erledigt `kubectl apply` die Reihenfolge von allein.|If the namespace is in the same manifest, `kubectl apply` handles the ordering by itself."],

Deployment:[
 "Ab zwei Replicas übersteht die Anwendung Node-Ausfälle und Updates ohne Unterbrechung.|From two replicas upwards the app survives node failures and updates without downtime.",
 "Fester Tag oder Digest im Image — niemals `:latest`, sonst laufen zwei Pods auf verschiedenen Ständen.|A fixed tag or digest in the image — never `:latest`, or two pods end up on different builds.",
 "`requests` immer setzen, `limits` mindestens für Speicher: ohne requests plant der Scheduler blind.|Always set `requests`, and `limits` at least for memory: without requests the scheduler is flying blind.",
 "readinessProbe ist Pflicht, livenessProbe nur bei echten Hängern — eine zu strenge startet gesunde Pods im Kreis neu.|A readiness probe is mandatory, a liveness probe only against genuine deadlocks — an over-strict one restarts healthy pods in a loop.",
 "In `matchLabels` nur `app`, niemals die Version: der Selector lässt sich nachträglich nicht ändern.|Only `app` in `matchLabels`, never the version: the selector cannot be changed later."],

StatefulSet:[
 "Nur nehmen, wenn die Pods wirklich nicht austauschbar sind — alles andere ist ein Deployment.|Only use it when the pods genuinely are not interchangeable — everything else is a Deployment.",
 "Den headless Service zuerst anlegen, sonst haben die Pods keine eigenen DNS-Namen.|Create the headless service first, otherwise the pods have no individual DNS names.",
 "`volumeClaimTemplates` sind unveränderlich: knapp anfangen, vergrößern geht später, verkleinern nie.|`volumeClaimTemplates` are immutable: start small, growing works later, shrinking never does.",
 "Die PVCs überleben das Löschen des StatefulSet. Das ist Absicht — und der häufigste Grund für verwaisten Speicher.|The PVCs survive deleting the StatefulSet. That is intentional — and the most common source of orphaned storage."],

Pod:[
 "Für alles, was laufen bleiben soll, ein Deployment nehmen: einen Pod ersetzt nach einem Node-Ausfall niemand.|For anything meant to keep running, use a Deployment: nobody replaces a pod after a node failure.",
 "Zum kurzen Ausprobieren ist `kubectl run --rm -it` schneller als ein Manifest.|For a quick try, `kubectl run --rm -it` beats writing a manifest.",
 "`restartPolicy: Never`, wenn der Pod eine Aufgabe einmal erledigen soll — sonst startet der Container endlos neu.|`restartPolicy: Never` when the pod should do one job — otherwise the container restarts forever.",
 "Als Debug-Werkzeug im Cluster besser `kubectl debug`: der hängt sich an den laufenden Pod, statt einen zweiten daneben zu stellen.|As an in-cluster debug tool, `kubectl debug` is better: it attaches to the running pod instead of placing a second one beside it."],

Service:[
 "ClusterIP ist die Voreinstellung und fast immer richtig; LoadBalancer kostet beim Anbieter Geld und fehlt lokal ganz.|ClusterIP is the default and almost always right; LoadBalancer costs money at your provider and does not exist locally.",
 "Ports benennen und `targetPort` auf den Namen zeigen lassen — dann bricht nichts, wenn sich die Nummer ändert.|Name the ports and point `targetPort` at the name — then nothing breaks when the number changes.",
 "Nach dem Anlegen `kubectl get endpoints` prüfen: ein Service ohne Endpoints meldet keinen Fehler.|Check `kubectl get endpoints` afterwards: a service without endpoints reports no error.",
 "Für Datenbanken und andere Nicht-HTTP-Dienste braucht es keinen Ingress — der Service reicht clusterintern.|Databases and other non-HTTP services need no ingress — the service is enough inside the cluster."],

ConfigMap:[
 "Nur Unkritisches. Alles Vertrauliche gehört ins Secret, auch wenn es hier bequemer wäre.|Non-sensitive data only. Anything confidential belongs in a Secret, however much more convenient this is.",
 "`immutable` setzen, wenn die Werte fest sind: schützt vor Versehen und entlastet die API.|Set `immutable` when the values are fixed: it guards against mistakes and takes load off the API.",
 "Laufende Pods lesen Änderungen nicht von selbst. Sicher wirkt nur `kubectl rollout restart`.|Running pods do not pick up changes by themselves. Only `kubectl rollout restart` reliably applies them.",
 "Größere Dateien gehören ins Image oder auf ein Volume — bei etwa 1 MB ist Schluss.|Larger files belong in the image or on a volume — the limit sits around 1 MB."],

Secret:[
 "base64 ist keine Verschlüsselung. Ein gewöhnliches Secret gehört nicht in ein Repository.|base64 is not encryption. A plain Secret does not belong in a repository.",
 "Sobald das Manifest versioniert wird: SealedSecret oder ExternalSecret statt Klartext.|As soon as the manifest is versioned: SealedSecret or ExternalSecret instead of plaintext.",
 "Lieber als Volume einhängen als über `env`: Umgebungsvariablen landen in Prozesslisten und Fehlerberichten.|Prefer mounting as a volume over `env`: environment variables end up in process listings and crash reports.",
 "Je Anwendung ein eigenes Secret, nicht ein gemeinsames für den ganzen Namespace.|One Secret per application, not a shared one for the whole namespace."],

Ingress:[
 "`ingressClassName` immer setzen — passt die Klasse nicht, passiert schlicht gar nichts.|Always set `ingressClassName` — if the class does not match, nothing happens at all.",
 "Zertifikate von cert-manager ausstellen lassen statt von Hand gepflegter Secrets.|Let cert-manager issue the certificates instead of hand-maintained secrets.",
 "Ein Ingress je Anwendung. Sammel-Ingresses mit vielen Regeln werden schnell unwartbar.|One ingress per application. Collective ingresses with many rules quickly become unmaintainable.",
 "Der Backend-Port ist der des Service, nicht der des Containers — eine der häufigsten Verwechslungen.|The backend port is the service's, not the container's — one of the most common mix-ups."],

Job:[
 "`ttlSecondsAfterFinished` setzen, sonst bleiben abgeschlossene Jobs samt Pods für immer liegen.|Set `ttlSecondsAfterFinished`, otherwise finished jobs and their pods stay around forever.",
 "`restartPolicy: Never` legt für jeden Versuch einen neuen Pod an — die Logs der Fehlversuche bleiben dadurch erhalten.|`restartPolicy: Never` creates a new pod per attempt — which is what preserves the logs of the failed ones.",
 "`backoffLimit` niedrig halten: was zwanzigmal scheitert, scheitert auch beim einundzwanzigsten Mal.|Keep `backoffLimit` low: what fails twenty times will fail the twenty-first time too.",
 "`activeDeadlineSeconds` als Notbremse für alles, was hängen bleiben kann.|`activeDeadlineSeconds` as the emergency brake for anything that can get stuck."],

CronJob:[
 "`concurrencyPolicy: Forbid` für alles, was sich nicht überlappen darf — Backups vor allem.|`concurrencyPolicy: Forbid` for anything that must not overlap — backups above all.",
 "`timeZone` setzen, sonst gilt UTC und der nächtliche Lauf wandert mit der Sommerzeit.|Set `timeZone`, otherwise UTC applies and the nightly run drifts with daylight saving.",
 "Vor dem ersten Termin einmal von Hand auslösen: `kubectl create job --from=cronjob/name test`.|Trigger it by hand once before the first scheduled run: `kubectl create job --from=cronjob/name test`.",
 "Die History-Limits klein halten, sonst sammeln sich Job-Objekte über Wochen an.|Keep the history limits small, otherwise job objects pile up over weeks."],

PersistentVolume:[
 "Von Hand nur schreiben, wenn der Speicher schon existiert. Sonst die StorageClass arbeiten lassen.|Only write one by hand when the storage already exists. Otherwise let the storage class do the work.",
 "`reclaimPolicy: Retain`, damit ein gelöschter Claim nicht die Daten mitnimmt.|`reclaimPolicy: Retain`, so a deleted claim does not take the data with it.",
 "`claimRef` setzen, sonst greift sich der erste passende Claim das Volume — auch einer aus einem fremden Namespace.|Set `claimRef`, otherwise the first matching claim takes the volume — including one from someone else's namespace.",
 "`local` ohne nodeAffinity ist ein Pod, der ewig Pending bleibt.|`local` without a nodeAffinity is a pod that stays Pending forever."],

PersistentVolumeClaim:[
 "Eher knapp anfangen: vergrößern geht bei den meisten Klassen, verkleinern bei keiner.|Start small: growing works with most classes, shrinking with none.",
 "Der accessMode beschreibt Nodes, nicht Pods. ReadWriteOnce und zwei Replicas auf verschiedenen Nodes vertragen sich nicht.|The access mode describes nodes, not pods. ReadWriteOnce and two replicas on different nodes do not mix.",
 "Leerer `storageClassName` heißt Standardklasse — auf Clustern ohne Standard bleibt der Claim für immer Pending.|An empty `storageClassName` means the default class — on clusters without a default the claim stays Pending forever.",
 "Bei statischer Bindung `storageClassName` ausdrücklich leer setzen, sonst wird zusätzlich dynamisch bereitgestellt.|For static binding set `storageClassName` to empty explicitly, otherwise something is provisioned dynamically on top."],

NetworkPolicy:[
 "Mit einer Default-Deny-Policy je Namespace anfangen und dann gezielt öffnen.|Start with a default-deny policy per namespace and then open up deliberately.",
 "Den Namespace des Ingress-Controllers ausdrücklich erlauben, sonst ist die Anwendung von außen tot.|Explicitly allow the ingress controller's namespace, otherwise the app is dead from outside.",
 "Egress erst sperren, wenn DNS ausdrücklich freigegeben ist — sonst sieht jeder Fehler nach kaputter Namensauflösung aus.|Only deny egress once DNS is explicitly allowed — otherwise every error looks like broken name resolution.",
 "Policies addieren sich. Eine zusätzliche Regel kann nie etwas verbieten, immer nur mehr erlauben.|Policies are additive. An extra rule can never forbid anything, only allow more."],

PodDisruptionBudget:[
 "Erst ab zwei Replicas sinnvoll: bei einer blockiert `minAvailable: 1` jeden Node-Drain auf Dauer.|Only useful from two replicas up: with one, `minAvailable: 1` blocks every node drain indefinitely.",
 "`maxUnavailable` wächst mit der Replica-Zahl mit und ist deshalb meist die robustere Wahl.|`maxUnavailable` scales with the replica count and is therefore usually the more robust choice.",
 "Gilt nur bei freiwilligen Störungen. Gegen Abstürze und harte Node-Ausfälle hilft es nicht.|Applies only to voluntary disruptions. It does not help against crashes or hard node failures."],

HorizontalPodAutoscaler:[
 "Ohne `requests.cpu` rechnet der HPA nie — die Auslastung ist ein Prozentsatz davon.|Without `requests.cpu` the HPA never computes anything — utilisation is a percentage of it.",
 "`replicas` aus dem Deployment-Manifest nehmen, sonst überschreiben sich beide bei jedem Apply.|Remove `replicas` from the Deployment manifest, otherwise the two overwrite each other on every apply.",
 "`minReplicas` mindestens zwei: aus einem einzelnen Pod heraus skaliert es sich schlecht.|`minReplicas` at least two: scaling out of a single pod works badly.",
 "Speicher als Metrik taugt selten, weil viele Laufzeiten Speicher nie zurückgeben.|Memory as a metric is rarely useful because many runtimes never hand memory back."],

RBAC:[
 "Mit `view` anfangen und nur ergänzen, was tatsächlich fehlt.|Start with `view` and add only what is actually missing.",
 "Eine ClusterRole per RoleBinding einbinden, wenn die Rechte nur in einem Namespace gelten sollen.|Bind a ClusterRole with a RoleBinding when the rights should apply in one namespace only.",
 "Je Anwendung ein eigener ServiceAccount — `default` teilt sich seine Rechte mit allem im Namespace.|One service account per application — `default` shares its rights with everything in the namespace.",
 "`cluster-admin` niemals an einen ServiceAccount binden. Wer das darf, darf sich alles Weitere selbst geben.|Never bind `cluster-admin` to a service account. Whoever may do that can grant themselves everything else."],

_stack:[
 "Der Name trägt sich durch alles: Labels, Selector, ConfigMap-Namen, Ingress. Einmal hier richtig, überall richtig.|The name carries through everything: labels, selector, ConfigMap names, ingress. Right here means right everywhere.",
 "Erst Ressourcen und Probes sauber setzen, HPA und PDB danach ergänzen.|Get resources and probes right first, add the HPA and the PDB afterwards.",
 "Die Härtung anlassen und nur abschalten, wenn der Container wirklich außerhalb von `/tmp` schreiben muss.|Leave the hardening on and switch it off only if the container really has to write outside `/tmp`.",
 "Das Ergebnis ist ein Ausgangspunkt, kein fertiges Produktionsmanifest — die Prüfungen rechts sagen, was noch fehlt.|The result is a starting point, not a finished production manifest — the checks on the right say what is still missing."]
};
Object.keys(BEST).forEach(k => { if (RES[k]) RES[k].best = BEST[k]; });

function kvObj(arr){
  const o = {};
  (arr||[]).forEach(p => { if (p.k) o[p.k] = p.v === undefined ? "" : p.v; });
  return Object.keys(o).length ? o : undefined;
}
function toPairs(o){
  return Object.keys(o||{}).map(k => ({k:k, v:o[k]}));
}

/* Version aus dem Image-Tag. Digests und :latest liefern nichts Sinnvolles. */
function imageTag(img){
  if (!img) return "";
  let last = String(img).split("/").pop();
  if (last.indexOf("@") !== -1) return "";
  const i = last.lastIndexOf(":");
  if (i === -1) return "";
  const tag = last.slice(i + 1);
  return /^[A-Za-z0-9][\w.\-]{0,62}$/.test(tag) ? tag : "";
}

function stdLabels(d){
  if (!d.stdLabels || !d.name) return {};
  const o = {
    "app.kubernetes.io/name": d.name,
    "app.kubernetes.io/instance": d.namespace ? d.name + "-" + d.namespace : d.name,
    "app.kubernetes.io/managed-by": "manifest-wizard"
  };
  const v = imageTag(d.image);
  if (v) o["app.kubernetes.io/version"] = v;
  if (d.component) o["app.kubernetes.io/component"] = d.component;
  if (d.partOf) o["app.kubernetes.io/part-of"] = d.partOf;
  return o;
}


function volEntries(d){
  return (d.volumes||[]).map((v, i) => {
    const type = v.type || "cm";
    const src = (v.cm || "").trim();
    if (!v.path) return null;
    if (type !== "emptyDir" && !src) return null;
    const name = type === "emptyDir" ? ("scratch-" + (i+1))
      : (type === "pvc" ? "pvc-" + src : (type === "secret" ? "sec-" + src : "cm-" + src));
    let source;
    if (type === "secret") source = {secret:{secretName:src}};
    else if (type === "pvc") source = {persistentVolumeClaim:{claimName:src}};
    else if (type === "emptyDir") source = {emptyDir: v.size ? {sizeLimit:v.size} : EMPTY_MAP};
    else source = {configMap:{name:src}};
    return {
      mount:{name:name, mountPath:v.path, subPath:v.subPath || undefined, readOnly:v.readOnly || undefined},
      vol: Object.assign({name:name}, source)
    };
  }).filter(Boolean);
}

function containerOf(d, extraMounts){
  const vols = volEntries(d);
  const c = {
    name: d.containerName || d.name,
    image: d.image,
    imagePullPolicy: d.pullPolicy || undefined,
    command: lines(d.command), args: lines(d.args),
    ports: (d.ports||[]).filter(p => p.containerPort).map(p => ({
      name:p.name||undefined, containerPort:num(p.containerPort), protocol:p.protocol||undefined})),
    env: kvList(d.env),
    envFrom: envFrom(d),
    volumeMounts: vols.map(v => v.mount)
      .concat(d.pvc && d.pvcPath ? [{name:"data", mountPath:d.pvcPath}] : [])
      .concat(extraMounts || []),
    resources: {
      requests:{cpu:d.cpuReq, memory:d.memReq},
      limits:{cpu:d.cpuLim, memory:d.memLim}
    }
  };
  const pr = probesOf(d);
  if (pr){
    if (pr.readinessProbe) c.readinessProbe = pr.readinessProbe;
    if (pr.livenessProbe) c.livenessProbe = pr.livenessProbe;
    if (pr.startupProbe) c.startupProbe = pr.startupProbe;
  }
  if (d.hardened){
    c.securityContext = {
      allowPrivilegeEscalation:false, readOnlyRootFilesystem:true, runAsNonRoot:true,
      capabilities:{drop:["ALL"]}
    };
    c.volumeMounts = c.volumeMounts.concat([{name:"tmp", mountPath:"/tmp"}]);
  }
  return c;
}

/* Ein Sidecar ist ein initContainer mit restartPolicy Always: Er startet vor dem
   Hauptcontainer, blockiert ihn aber nicht und läuft dann daneben weiter. */
function initContainersOf(d, mainMounts){
  return (d.initContainers||[]).filter(c => c.name && c.image).map(c => {
    const out = {
      name: c.name,
      image: c.image,
      command: lines(c.command),
      restartPolicy: c.mode === "sidecar" ? "Always" : undefined,
      volumeMounts: c.mounts ? mainMounts : undefined
    };
    /* readOnlyRootFilesystem bleibt aussen vor — der Pod Security Standard
       restricted verlangt es nicht, und Init-Container schreiben oft. */
    if (d.hardened) out.securityContext = {
      allowPrivilegeEscalation:false, runAsNonRoot:true, capabilities:{drop:["ALL"]}
    };
    return out;
  });
}

/* Das Gegenstück zum Taint auf dem Node: die Erlaubnis des Pods. */
function tolerationsOf(d){
  const out = (d.tolerations||[]).filter(x => x.key || x.op === "Exists").map(x => {
    const tol = {key:x.key || undefined, operator:x.op || "Equal"};
    /* Exists duldet keinen Wert — die API weist das ab. */
    if (x.op !== "Exists" && x.value) tol.value = x.value;
    if (x.effect) tol.effect = x.effect;
    const s = num(x.seconds);
    if (s !== undefined) tol.tolerationSeconds = s;
    return tol;
  });
  return out.length ? out : undefined;
}

function podSpecOf(d, extraMounts){
  const main = containerOf(d, extraMounts);
  const inits = initContainersOf(d, main.volumeMounts);
  return {
    serviceAccountName: d.sa || undefined,
    imagePullSecrets: d.pullSecret ? [{name:d.pullSecret}] : undefined,
    nodeSelector: kvObj(d.nodeSelector),
    tolerations: tolerationsOf(d),
    securityContext: d.hardened
      ? {runAsNonRoot:true, seccompProfile:{type:"RuntimeDefault"}}
      : (d.runAsNonRoot ? {runAsNonRoot:true} : undefined),
    initContainers: inits.length ? inits : undefined,
    containers:[main],
    volumes: volEntries(d).map(v => v.vol)
      .concat(d.pvc && d.pvcPath ? [{name:"data", persistentVolumeClaim:{claimName:d.pvc}}] : [])
      .concat(d.hardened ? [{name:"tmp", emptyDir:EMPTY_MAP}] : [])
  };
}

/* Selector-Labels plus Standard-Labels plus eigene. */
function allLabels(d, sel){
  const o = Object.assign({}, sel || {}, stdLabels(d), kvObj(d.labels) || {});
  return Object.keys(o).length ? o : undefined;
}
function kvList(arr){
  const l = (arr||[]).filter(p=>p.k).map(p=>({name:p.k, value:p.v===undefined?"":p.v}));
  return l.length ? l : undefined;
}
function lines(s){
  if (!s) return undefined;
  const l = String(s).split("\n").map(x=>x.trim()).filter(Boolean);
  return l.length ? l : undefined;
}
function num(v){
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}
function envFrom(d){
  const a = [];
  if (d.envCM) a.push({configMapRef:{name:d.envCM}});
  if (d.envSec) a.push({secretRef:{name:d.envSec}});
  return a.length ? a : undefined;
}
function probe(d, path){
  const port = num(d.probePort);
  if (d.probe === "http") return {httpGet:{path:path || d.probePath || "/healthz", port:port===undefined?80:port}};
  if (d.probe === "tcp") return {tcpSocket:{port:port===undefined?80:port}};
  if (d.probe === "exec") return {exec:{command:lines(d.probeCmd)}};
  return null;
}

/* readiness, liveness und startup aus einer Definition. Fehlende Schalter
   bedeuten an — so bleiben ältere gespeicherte Dateien bei ihrem Verhalten. */
function probesOf(d){
  if (!probe(d)) return null;
  const delay = num(d.probeDelay), per = num(d.probePeriod),
        to = num(d.probeTimeout), fail = num(d.probeFailures);
  const timings = p => {
    if (per !== undefined) p.periodSeconds = per;
    if (to !== undefined) p.timeoutSeconds = to;
    if (fail !== undefined) p.failureThreshold = fail;
    return p;
  };
  const out = {};
  if (d.probeReadiness !== false){
    const p = timings(probe(d));
    if (delay !== undefined) p.initialDelaySeconds = delay;
    out.readinessProbe = p;
  }
  if (d.probeLiveness !== false){
    const p = timings(probe(d, d.probe === "http" ? d.livenessPath : ""));
    /* Der Vorlauf ist nur nötig, solange keine startupProbe den Start abdeckt. */
    if (delay !== undefined) p.initialDelaySeconds = delay;
    else if (!d.probeStartup) p.initialDelaySeconds = 15;
    if (per === undefined && !d.probeStartup) p.periodSeconds = 20;
    out.livenessProbe = p;
  }
  if (d.probeStartup){
    const sp = num(d.startupPeriod), sf = num(d.startupFailures);
    const p = probe(d);
    p.periodSeconds = sp === undefined ? 10 : sp;
    p.failureThreshold = sf === undefined ? 30 : sf;
    if (to !== undefined) p.timeoutSeconds = to;
    out.startupProbe = p;
  }
  return out;
}
function b64(s){
  try { return btoa(unescape(encodeURIComponent(s))); } catch(e){ return ""; }
}

const DNS1123 = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

const QTY_UNITS = {"":1, m:1e-3, k:1e3, M:1e6, G:1e9, T:1e12, P:1e15,
                   Ki:1024, Mi:1048576, Gi:1073741824, Ti:1099511627776, Pi:1125899906842624};
function qty(v){
  if (v === undefined || v === null || v === "") return undefined;
  const m = String(v).trim().match(/^(\d+(?:\.\d+)?)([A-Za-z]*)$/);
  if (!m) return null;
  const u = QTY_UNITS[m[2]];
  return u === undefined ? null : parseFloat(m[1]) * u;
}

function validate(docs){
  const out = [];
  let ctx = null;
  const err = (m, field) => out.push({lvl:"err", m:m, src:ctx, field:field});
  const warn = (m, field) => out.push({lvl:"warn", m:m, src:ctx, field:field});
  const podLabels = [];
  const pvcs = {}, pvs = {};
  docs.forEach(d => {
    if (d.kind === "PersistentVolumeClaim") pvcs[(d.metadata||{}).name] = d;
    if (d.kind === "PersistentVolume") pvs[(d.metadata||{}).name] = d;
  });

  docs.forEach(doc => {
    ctx = doc.__src || null;
    const kind = doc.kind, meta = doc.metadata || {};
    const nm = meta.name;
    if (!nm){ err(t("Name fehlt|Name is missing") + " · " + kind); }
    else if (!DNS1123.test(nm)) err(kind + "/" + nm + ": " + t("Name nur Kleinbuchstaben, Ziffern und Bindestrich|name allows lowercase, digits and hyphen only"), "name");
    else if (nm.length > 63) err(kind + "/" + nm + ": " + t("länger als 63 Zeichen|longer than 63 characters"), "name");
    if (meta.namespace && !DNS1123.test(meta.namespace)) err(t("Namespace ist kein gültiger DNS-Name|Namespace is not a valid DNS name"), "namespace");

    walk(doc, (k, v, path) => {
      if (k === "image" && typeof v === "string" && v && v.indexOf(":") === -1)
        warn(nm + ": image " + v + " " + t("ohne Tag — zieht implizit :latest|has no tag — implicitly pulls :latest"), "image");
      if ((k === "containerPort" || k === "port" || k === "nodePort") && typeof v === "number" && (v < 1 || v > 65535))
        err(nm + ": " + k + " " + v + " " + t("außerhalb 1–65535|outside 1–65535"));
      if (k === "nodePort" && typeof v === "number" && (v < 30000 || v > 32767))
        warn(nm + ": nodePort " + v + " " + t("liegt außerhalb des Standardbereichs 30000–32767|is outside the default range 30000–32767"));
    });

    if (kind === "Deployment" || kind === "StatefulSet" || kind === "Pod"){
      /* Beim Pod ist das Dokument selbst die Pod-Vorlage. */
      const tpl = kind === "Pod" ? doc : ((doc.spec||{}).template||{});
      const lbl = (tpl.metadata||{}).labels;
      if (lbl) podLabels.push(lbl);
      const cs = ((tpl.spec||{}).containers)||[];
      cs.forEach(c => {
        const lim = (c.resources||{}).limits;
        if (!lim || (!lim.cpu && !lim.memory))
          warn(nm + ": " + t("keine resources.limits gesetzt|no resources.limits set"), "cpuLim");
        if (!c.readinessProbe)
          warn(nm + ": " + t("keine readinessProbe — Traffic geht sofort an neue Pods|no readinessProbe — traffic hits new pods immediately"), "probe");
      });
      const nsPorts = new Set();
      cs.forEach(c => (c.ports||[]).forEach(p => {
        if (nsPorts.has(p.containerPort)) err(nm + ": containerPort " + p.containerPort + " " + t("doppelt vergeben|used twice"));
        nsPorts.add(p.containerPort);
      }));
      const pullSecs = ((tpl.spec||{}).imagePullSecrets)||[];
      cs.forEach(c => {
        const img = c.image || "";
        const host = img.split("/")[0];
        const isPrivateHost = img.indexOf("/") !== -1 && (host.indexOf(".") !== -1 || host.indexOf(":") !== -1);
        if (isPrivateHost && !pullSecs.length)
          warn(nm + ": " + t("Image von|image from") + " " + host + " " + t("ohne imagePullSecrets — schlägt fehl, wenn die Registry Anmeldung verlangt|without imagePullSecrets — fails if the registry requires credentials"), "image");

        if (c.livenessProbe && !c.readinessProbe)
          warn(nm + ": " + t("livenessProbe ohne readinessProbe — der Service schickt Anfragen an einen Container, der noch startet|livenessProbe without a readinessProbe — the service sends requests to a container that is still starting"), "probeReadiness");

        /* Probe-Port muss zu einem deklarierten containerPort passen */
        const declared = (c.ports||[]).map(p => p.containerPort).filter(p => typeof p === "number");
        ["readinessProbe","livenessProbe","startupProbe"].forEach(pk => {
          const pr = c[pk]; if (!pr) return;
          const pp = ((pr.httpGet || pr.tcpSocket || {}).port);
          if (typeof pp === "number" && declared.length && declared.indexOf(pp) === -1)
            warn(nm + ": " + pk + " " + t("prüft Port|targets port") + " " + pp + ", " +
              t("deklariert ist aber|but the container declares") + " " + declared.join(", "), "probePort");
        });

        const rq = (c.resources||{}).requests || {}, lm = (c.resources||{}).limits || {};
        ["cpu","memory"].forEach(key => {
          const a = qty(rq[key]), b = qty(lm[key]);
          if (a === null) err(nm + ": requests." + key + " — " + t("ungültige Mengenangabe|invalid quantity") + ": " + rq[key], key === "cpu" ? "cpuReq" : "memReq");
          if (b === null) err(nm + ": limits." + key + " — " + t("ungültige Mengenangabe|invalid quantity") + ": " + lm[key], key === "cpu" ? "cpuLim" : "memLim");
          if (typeof a === "number" && typeof b === "number" && b < a)
            err(nm + ": limits." + key + " (" + lm[key] + ") " +
              t("liegt unter requests|is below requests") + "." + key + " (" + rq[key] + ")", key === "cpu" ? "cpuLim" : "memLim");
        });
      });

      ((tpl.spec||{}).volumes||[]).forEach(v => {
        const lim = (v.emptyDir||{}).sizeLimit;
        if (lim && qty(lim) === null)
          err(nm + ": emptyDir " + v.name + " — sizeLimit " + lim + " " + t("ist keine gültige Mengenangabe|is not a valid quantity"), "volumes");
      });
      ((tpl.spec||{}).tolerations||[]).forEach(tol => {
        if (tol.operator === "Exists" && tol.value !== undefined)
          err(nm + ": toleration " + (tol.key || "") + " — " +
            t("operator Exists verträgt keinen value|operator Exists must not carry a value"), "tolerations");
        if (!tol.key && tol.operator !== "Exists")
          err(nm + ": " + t("toleration ohne key braucht operator Exists|a toleration without a key needs operator Exists"), "tolerations");
        if (!tol.key && tol.operator === "Exists" && !tol.effect)
          warn(nm + ": " + t("toleriert jeden Taint — auch die, mit denen Kubernetes Nodes als nicht bereit oder überlastet markiert. Der Pod bleibt dann auf einem kaputten Node liegen.|tolerates every taint — including the ones Kubernetes uses to mark nodes as not ready or under pressure. The pod then stays put on a broken node."), "tolerations");
        if (tol.tolerationSeconds !== undefined && tol.effect && tol.effect !== "NoExecute")
          warn(nm + ": toleration " + (tol.key || "") + " — " +
            t("tolerationSeconds wirkt nur bei NoExecute und wird hier ignoriert|tolerationSeconds only applies to NoExecute and is ignored here"), "tolerations");
      });

      /* Container- und Init-Container-Namen teilen sich einen Namensraum. */
      const inits = ((tpl.spec||{}).initContainers)||[];
      const seenNames = {};
      cs.concat(inits).forEach(c => {
        if (!c.name) return;
        if (seenNames[c.name])
          err(nm + ": " + t("zwei Container heißen|two containers are named") + " " + c.name +
            " — " + t("Container und Init-Container teilen sich einen Namensraum|containers and init containers share one namespace"), "initContainers");
        seenNames[c.name] = true;
      });

      cs.concat(inits).forEach(c => {
        const names = ((tpl.spec||{}).volumes||[]).map(v => v.name)
          .concat((((doc.spec||{}).volumeClaimTemplates)||[]).map(v => v.metadata.name));
        (c.volumeMounts||[]).forEach(m => {
          if (names.indexOf(m.name) === -1)
            err(nm + ": " + t("mountPath|mountPath") + " " + m.mountPath + " " +
              t("verweist auf das Volume|refers to volume") + " " + m.name + ", " +
              t("das nirgends definiert ist|which is defined nowhere"), "volumes");
        });
        const paths = {};
        (c.volumeMounts||[]).forEach(m => {
          if (paths[m.mountPath]) err(nm + ": " + t("zwei Volumes auf demselben Pfad|two volumes on the same path") + " " + m.mountPath, "volumes");
          paths[m.mountPath] = true;
        });
      });

      const reps = (doc.spec||{}).replicas;
      if (typeof reps === "number" && reps > 1){
        ((tpl.spec||{}).volumes||[]).forEach(v => {
          const claim = (v.persistentVolumeClaim||{}).claimName;
          if (!claim || !pvcs[claim]) return;
          const modes = ((pvcs[claim].spec||{}).accessModes)||[];
          if (modes.indexOf("ReadWriteOnce") !== -1 || modes.indexOf("ReadWriteOncePod") !== -1)
            err(nm + ": " + reps + " " + t("Replicas teilen sich das Volume|replicas share the volume") + " " + claim +
              " (" + modes.join(", ") + ") — " +
              t("nur ein Node darf mounten, weitere Pods bleiben in ContainerCreating hängen|only one node may mount it, further pods get stuck in ContainerCreating"), "replicas");
        });
      }
    }

    if (kind === "Pod")
      warn(nm + ": " + t("einzelner Pod ohne Controller — bei einem Node-Ausfall wird er nirgends neu angelegt, und Skalierung, Rolling Update und Selbstheilung gibt es nicht. Für alles, was laufen bleiben soll, ist ein Deployment der richtige Weg.|a single pod with no controller — after a node failure nothing recreates it anywhere, and there is no scaling, no rolling update and no self-healing. For anything meant to keep running, a Deployment is the way to go."));

    if (kind === "StatefulSet"){
      const sn = (doc.spec||{}).serviceName;
      if (!sn) err(nm + ": " + t("serviceName fehlt — ein StatefulSet braucht einen headless Service|serviceName is missing — a StatefulSet needs a headless service"), "serviceName");
      const vcts = (doc.spec||{}).volumeClaimTemplates || [];
      const mountNames = (((((doc.spec||{}).template||{}).spec||{}).containers||[])[0]||{}).volumeMounts || [];
      vcts.forEach(v => {
        const sz = ((v.spec||{}).resources||{}).requests || {};
        if (qty(sz.storage) === null || qty(sz.storage) === undefined)
          err(nm + ": volumeClaimTemplate " + v.metadata.name + " — " + t("keine gültige Größe|no valid size"), "vct");
        if (!mountNames.some(m => m.name === v.metadata.name))
          warn(nm + ": volumeClaimTemplate " + v.metadata.name + " " +
            t("wird von keinem Container eingehängt|is not mounted by any container"), "vct");
      });
      if (vcts.length) warn(nm + ": " + t("volumeClaimTemplates lassen sich nachträglich nicht ändern. Eine andere Größe oder StorageClass erfordert, das StatefulSet zu löschen und neu anzulegen — die PVCs bleiben dabei erhalten.|volumeClaimTemplates cannot be changed later. A different size or storage class means deleting and recreating the StatefulSet — the PVCs survive that."), "vct");
    }

    if (kind === "HorizontalPodAutoscaler"){
      const sp = doc.spec || {};
      const tgt = (sp.scaleTargetRef||{}).name;
      if (num(sp.minReplicas) > num(sp.maxReplicas))
        err(nm + ": minReplicas " + sp.minReplicas + " > maxReplicas " + sp.maxReplicas, "min");
      if (!(sp.metrics||[]).length)
        err(nm + ": " + t("keine Metrik angegeben — der HPA hätte nichts, woran er sich orientiert|no metric given — the HPA would have nothing to go by"), "cpu");
      const owner = docs.filter(x => (x.kind === "Deployment" || x.kind === "StatefulSet") &&
        (x.metadata||{}).name === tgt)[0];
      if (owner){
        const cs = ((((owner.spec||{}).template||{}).spec||{}).containers)||[];
        const wantsCpu = (sp.metrics||[]).some(m => ((m.resource||{}).name) === "cpu");
        const hasCpuReq = cs.some(c => (((c.resources||{}).requests)||{}).cpu);
        if (wantsCpu && !hasCpuReq)
          err(nm + ": " + t("CPU-Ziel gesetzt, aber|CPU target set, but") + " " + tgt + " " +
            t("hat kein requests.cpu — die Auslastung wird prozentual dazu gerechnet, ohne Bezugsgröße skaliert der HPA nie|has no requests.cpu — utilisation is computed relative to it, and without that reference the HPA never scales"), "cpuReq");
        if ((owner.spec||{}).replicas !== undefined)
          warn(nm + ": " + tgt + " " + t("hat weiterhin ein festes replicas im Manifest — bei jedem Apply wird der HPA überstimmt|still has a fixed replicas in the manifest — every apply overrides the HPA"), "replicas");
      }
    }

    if (kind === "ClusterRoleBinding" || kind === "RoleBinding"){
      const rr = doc.roleRef || {};
      if (rr.name === "cluster-admin")
        err(nm + ": " + t("Bindung auf cluster-admin — der ServiceAccount darf damit alles im gesamten Cluster, inklusive Rechtevergabe an sich selbst|binding to cluster-admin — the service account may then do anything in the entire cluster, including granting itself more rights"), "builtin");
      else if (kind === "ClusterRoleBinding")
        warn(nm + ": " + t("ClusterRoleBinding gilt in jedem Namespace. Ein RoleBinding auf dieselbe ClusterRole würde sie auf einen Namespace begrenzen|a ClusterRoleBinding applies in every namespace. A RoleBinding to the same ClusterRole would limit it to one namespace"), "scope");
    }
    if (kind === "Role" || kind === "ClusterRole"){
      (doc.rules||[]).forEach(r => {
        if ((r.verbs||[]).indexOf("*") !== -1 || (r.resources||[]).indexOf("*") !== -1)
          warn(nm + ": " + t("Regel mit * — das ist selten das, was tatsächlich gebraucht wird|rule containing * — rarely what is actually needed"), "rules");
        if ((r.resources||[]).indexOf("secrets") !== -1 && (r.verbs||[]).some(v => v !== "get" && v !== "list" && v !== "watch"))
          warn(nm + ": " + t("Schreibrecht auf secrets — damit lassen sich fremde Zugangsdaten überschreiben|write access to secrets — that allows overwriting other people's credentials"), "rules");
      });
      if (!(doc.rules||[]).length)
        err(nm + ": " + t("keine Regel definiert|no rule defined"), "rules");
    }

    if (kind === "Service"){
      const sel = (doc.spec||{}).selector;
      if ((doc.spec||{}).type !== "ExternalName" && !sel)
        err(nm + ": " + t("Selector fehlt — der Service findet keine Pods|selector missing — the service will find no pods"), "selector");
      if (!((doc.spec||{}).ports||[]).length && (doc.spec||{}).type !== "ExternalName")
        err(nm + ": " + t("kein Port definiert|no port defined"), "ports");
      if (sel && podLabels.length){
        const match = podLabels.some(pl => Object.keys(sel).every(k => pl[k] === sel[k]));
        if (!match) warn(nm + ": " + t("Selector passt zu keinem Deployment in diesem Manifest|selector matches no Deployment in this manifest"), "selector");
      }
    }

    if (kind === "SealedSecret"){
      const enc = (doc.spec||{}).encryptedData || {};
      const keys = Object.keys(enc);
      if (!keys.length)
        err(nm + ": " + t("keine Schlüssel angegeben|no keys given"), "data");
      else if (keys.some(k => enc[k] === SEAL_TODO))
        warn(nm + ": " + t("noch nicht verschlüsselt — die Platzhalter mit der Ausgabe von kubeseal ersetzen, sonst schlägt der Apply fehl|not encrypted yet — replace the placeholders with the output of kubeseal, otherwise the apply fails"), "data");
      if (((doc.metadata||{}).annotations||{})["sealedsecrets.bitnami.com/cluster-wide"] === "true")
        warn(nm + ": " + t("cluster-wide — das Chiffrat lässt sich in jedem Namespace entschlüsseln, also von jedem mit Schreibrecht auf irgendeinen Namespace|cluster-wide — the ciphertext can be decrypted in any namespace, so by anyone with write access to any namespace"), "sealedScope");
    }

    if (kind === "ExternalSecret"){
      const sp = doc.spec || {};
      if (!(sp.secretStoreRef||{}).name)
        err(nm + ": " + t("kein SecretStore angegeben|no SecretStore given"), "store");
      if (!(sp.data||[]).length && !(sp.dataFrom||[]).length)
        err(nm + ": " + t("kein Pfad im Tresor angegeben|no path in the vault given"), "extPath");
    }

    if (kind === "Secret" && doc.stringData)
      warn(nm + ": " + t("Werte stehen im Klartext im Manifest. Unter Auslieferung gibt es SealedSecret und ExternalSecret als Alternativen.|values are stored in plaintext in the manifest. Under Delivery there are SealedSecret and ExternalSecret as alternatives."), "backend");

    if (kind === "Ingress" && !((doc.spec||{}).rules||[]).length)
      err(nm + ": " + t("keine Route definiert|no route defined"), "paths");

    if (kind === "CronJob"){
      const s = (doc.spec||{}).schedule;
      if (!s) err(nm + ": " + t("schedule fehlt|schedule is missing"), "schedule");
      else if (s.trim().split(/\s+/).length !== 5 && s[0] !== "@")
        err(nm + ": " + t("schedule braucht 5 Felder|schedule needs 5 fields") + " — " + s, "schedule");
    }

    if (kind === "PersistentVolume"){
      const sp = doc.spec || {};
      const cap = (sp.capacity||{}).storage;
      if (!cap) err(nm + ": " + t("keine Größe angegeben|no size given"), "size");
      else if (qty(cap) === null) err(nm + ": capacity.storage — " + t("ungültige Mengenangabe|invalid quantity") + ": " + cap, "size");
      if (!sp.local && !sp.nfs && !sp.hostPath && !sp.csi)
        err(nm + ": " + t("keine Quelle angegeben — ohne local, nfs, csi oder hostPath beschreibt das PV keinen Speicher|no source given — without local, nfs, csi or hostPath the PV describes no storage"), "src");
      if (sp.local && !sp.nodeAffinity)
        err(nm + ": " + t("local ohne nodeAffinity — der Scheduler weiß nicht, wo die Platte steckt, und der Pod bleibt Pending|local without nodeAffinity — the scheduler does not know where the disk is and the pod stays Pending"), "node");
      if (sp.hostPath)
        warn(nm + ": " + t("hostPath greift auf das Dateisystem des Nodes zu, bindet den Pod an genau diesen Node und wird von Pod Security Standards blockiert. Für Produktion praktisch nie die Antwort.|hostPath reaches into the node's filesystem, pins the pod to that one node and is blocked by Pod Security Standards. For production, almost never the answer."), "src");
      if (sp.persistentVolumeReclaimPolicy === "Delete")
        warn(nm + ": " + t("reclaimPolicy Delete — mit dem Claim verschwindet auch das Volume samt Inhalt|reclaimPolicy Delete — the volume and its contents disappear along with the claim"), "reclaim");
    }

    if (kind === "PersistentVolumeClaim"){
      const sp = doc.spec || {};
      if (!((sp.resources||{}).requests||{}).storage)
        err(nm + ": " + t("keine Größe angegeben|no size given"), "size");
      const pv = sp.volumeName ? pvs[sp.volumeName] : null;
      if (sp.volumeName && !pv)
        warn(nm + ": " + t("bindet an das PersistentVolume|binds to the PersistentVolume") + " " + sp.volumeName + ", " +
          t("das nicht in diesem Manifest steht — es muss im Cluster bereits existieren|which is not in this manifest — it has to exist in the cluster already"), "volumeName");
      if (pv){
        const cls = v => (v === undefined || v === EMPTY_STR) ? "" : v;
        const pvSpec = pv.spec || {};
        if (cls(pvSpec.storageClassName) !== cls(sp.storageClassName))
          err(nm + ": storageClassName " + t("passt nicht zu|does not match") + " " + sp.volumeName +
            " (\"" + cls(sp.storageClassName) + "\" ≠ \"" + cls(pvSpec.storageClassName) + "\") — " +
            t("die Bindung kommt damit nie zustande|binding will therefore never happen"), "class");
        const want = qty(((sp.resources||{}).requests||{}).storage), got = qty((pvSpec.capacity||{}).storage);
        if (typeof want === "number" && typeof got === "number" && want > got)
          err(nm + ": " + t("fordert mehr an, als|requests more than") + " " + sp.volumeName + " " +
            t("hergibt|provides") + " (" + sp.resources.requests.storage + " > " + pvSpec.capacity.storage + ")", "size");
        const pvModes = pvSpec.accessModes || [];
        (sp.accessModes||[]).forEach(m => {
          if (pvModes.indexOf(m) === -1)
            err(nm + ": accessMode " + m + " " + t("bietet das Volume nicht an|is not offered by the volume") + " " +
              sp.volumeName + " (" + pvModes.join(", ") + ")", "access");
        });
      }
      if (!sp.volumeName && sp.selector && sp.storageClassName !== EMPTY_STR && !sp.storageClassName)
        warn(nm + ": " + t("Auswahl über Labels, aber storageClassName fehlt — die Standardklasse legt dann ein zweites, dynamisches Volume an|selecting by labels but storageClassName is missing — the default class then provisions a second, dynamic volume"), "emptyClass");
    }
  });

  ctx = null;
  const seen = new Set();
  docs.forEach(d => {
    const key = d.kind + "/" + ((d.metadata||{}).namespace||"default") + "/" + (d.metadata||{}).name;
    if (seen.has(key)) err(t("Doppelte Ressource|Duplicate resource") + ": " + key);
    seen.add(key);
  });
  return out;
}

function walk(o, fn, path){
  path = path || [];
  if (Array.isArray(o)) return o.forEach((v,i)=>walk(v, fn, path.concat(i)));
  if (o && typeof o === "object")
    return Object.keys(o).forEach(k => { fn(k, o[k], path); walk(o[k], fn, path.concat(k)); });
}

const S = { docs: [], current: null, step: 0, editIndex: null };

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

const GROUPS = [["workloads", UI.workloads], ["network", UI.network], ["config", UI.config]];

function renderPicker(){
  const has = S.docs.length > 0;
  let h = '<span class="eyebrow">' + t(has ? UI.another : UI.pick) + "</span>";
  h += '<button class="rescard rescard--hero" data-res="_stack">' +
       '<u>' + t(UI.recommended) + "</u><b>" + t(RES._stack.label) + "</b><i>" +
       t(RES._stack.desc) + '</i><span class="chain">Namespace → ConfigMap → Secret → PVC → Deployment → Service → Ingress</span>' +
       '<u class="go">' + t(UI.build) + " →</u></button>";
  h += '<p class="stepdesc">' + t(UI.pickDesc) + "</p>";
  GROUPS.forEach(([g, label]) => {
    const keys = Object.keys(RES).filter(k => RES[k].group === g);
    if (!keys.length) return;
    h += '<p class="hgroup">' + t(label) + "</p><div class=\"picker-grid\">";
    keys.forEach(k => {
      h += '<button class="rescard" data-res="' + k + '"><b>' + k + "</b><i>" +
           t(RES[k].desc) + "</i><u>" + t(UI.build) + " →</u></button>";
    });
    h += "</div>";
  });
  $("picker").innerHTML = h;
}

function startRes(kind){
  const d = {};
  RES[kind].steps.forEach(st => st.fields.forEach(f => { if (f.def !== undefined) d[f.k] = f.def; }));
  applyProfile(kind, d);
  if (kind === "Service"){
    const all = currentDocs().slice().reverse();
    const dep = all.find(x => x.kind === "Deployment") || all.find(x => x.kind === "Pod");
    if (dep){
      const l = (dep.metadata||{}).labels || {};
      d.selector = Object.keys(l).map(k => ({k:k, v:l[k]}));
      d.name = dep.metadata.name;
      d.namespace = dep.metadata.namespace;
    }
  }
  S.current = {kind:kind, data:d};
  S.editIndex = null;
  S.step = 0;
  render();
}

let SHORT = true;

function fieldVisible(f, d){
  if (f.when && !f.when(d)) return false;
  return !(SHORT && f.adv);
}
function visibleFields(step, d){
  return step.fields.filter(f => fieldVisible(f, d));
}
function stepVisible(st, d){
  return !(SHORT && st.adv) && visibleFields(st, d).length > 0;
}
function visibleSteps(kind, d){
  const out = [];
  RES[kind].steps.forEach((st, i) => { if (stepVisible(st, d)) out.push(i); });
  return out.length ? out : [0];
}
function hasAdv(kind){
  return RES[kind].steps.some(st => st.adv || st.fields.some(f => f.adv));
}

function renderForm(){
  const cur = S.current;
  const step = RES[cur.kind].steps[S.step];
  const d = cur.data;
  $("stepTitle").textContent = t(step.title);
  $("stepDesc").textContent = step.desc ? t(step.desc) : "";
  $("stepDesc").hidden = !step.desc;

  const vis = visibleSteps(cur.kind, d);
  let h = S.step === vis[0] ? bestHtml(cur.kind) : "";
  visibleFields(step, d).forEach(f => { h += renderField(f, d); });
  $("form").innerHTML = h;

  // rail
  if (vis.indexOf(S.step) === -1){ S.step = vis[0]; }
  let r = "";
  vis.forEach((i, n) => {
    r += '<button data-step="' + i + '" aria-current="' + (i === S.step) + '"><span class="n">' +
         String(n+1).padStart(2,"0") + "</span>" + t(RES[cur.kind].steps[i].title) + "</button>";
  });
  if (hasAdv(cur.kind))
    r += '<button class="modetog" id="modeTog" aria-pressed="' + !SHORT + '">' +
         t(SHORT ? UI.modeFull : UI.modeShort) + "</button>";
  $("rail").innerHTML = r;

  // nav
  const last = vis[vis.length - 1] === S.step;
  const editing = S.editIndex !== null;
  let n = '<button class="btn" data-nav="back">' +
    (S.step === 0 ? "← " + t(editing ? UI.cancel : UI.discard) : "← " + t(UI.back)) + "</button>";
  n += '<div class="nav-sp"></div>';
  n += '<button class="btn btn--ghost jump" data-nav="jump">YAML ↓</button>';
  if (!last) n += '<button class="btn btn--go" data-nav="next">' + t(UI.next) + " →</button>";
  n += '<button class="btn ' + (last ? "btn--go" : "") + '" data-nav="commit">' +
    t(editing ? UI.save : UI.add) + "</button>";
  $("stepnav").innerHTML = n;
}

let EXPLAIN = false;

function bestHtml(kind){
  const b = (RES[kind] || {}).best;
  if (!b || !b.length) return "";
  return '<details class="best"' + (EXPLAIN ? " open" : "") + "><summary>" + esc(t(UI.best)) +
    "</summary><ul>" + b.map(x => "<li>" + mdInline(t(x)) + "</li>").join("") + "</ul></details>";
}

function whyFor(f){
  const kind = S.current ? S.current.kind : "";
  const w = f.why || WHY[kind + "." + f.k] || WHY[f.k];
  if (!w) return "";
  return '<details class="why"' + (EXPLAIN ? " open" : "") + "><summary>" + esc(t(UI.why)) +
         "</summary><p>" + esc(t(w)) + "</p></details>";
}

function renderField(f, d){
  const lab = t(f.l);
  const req = f.req ? ' <span class="req">*</span>' : "";
  const hint = (f.hint ? '<span class="hint">' + esc(t(f.hint)) + "</span>" : "") + whyFor(f);
  const v = d[f.k];
  const id = "fld_" + f.k;
  let inner = "";

  if (f.t === "text" || f.t === "number"){
    inner = '<input id="' + id + '" type="' + (f.t === "number" ? "number" : "text") + '" data-k="' + f.k +
      '" value="' + esc(v === undefined ? "" : v) + '" placeholder="' + esc(f.ph ? t(f.ph) : "") + '"' +
      (f.min !== undefined ? ' min="' + f.min + '"' : "") + ">";
  } else if (f.t === "textarea"){
    inner = '<textarea id="' + id + '" data-k="' + f.k + '" placeholder="' + esc(f.ph ? t(f.ph) : "") + '">' +
      esc(v === undefined ? "" : v) + "</textarea>";
  } else if (f.t === "lines"){
    inner = '<textarea id="' + id + '" data-k="' + f.k + '" style="min-height:58px" placeholder="' +
      esc(f.ph ? t(f.ph) : "") + '">' + esc(v === undefined ? "" : v) + "</textarea>";
  } else if (f.t === "select"){
    inner = '<select id="' + id + '" data-k="' + f.k + '"' + (f.structural ? ' data-structural="1"' : "") + ">";
    f.opts.forEach(o => {
      inner += '<option value="' + esc(o[0]) + '"' + (String(v||"") === o[0] ? " selected" : "") + ">" + esc(t(o[1])) + "</option>";
    });
    inner += "</select>";
  } else if (f.t === "bool"){
    return '<div class="f"><label class="check"><input type="checkbox" data-k="' + f.k + '"' +
      (f.structural ? ' data-structural="1"' : "") + (v ? " checked" : "") + "><span>" + esc(lab) + "</span></label>" + hint + "</div>";
  } else if (f.t === "kv"){
    const rows = v || [];
    let rh = '<div class="rows">';
    if (!rows.length) rh += '<p class="empty">' + t(UI.none) + "</p>";
    rows.forEach((p, i) => {
      rh += '<div class="row row--kv"><input type="text" data-kv="' + f.k + '" data-i="' + i + '" data-part="k" value="' +
        esc(p.k||"") + '" placeholder="key" aria-label="' + esc(lab + " — key " + (i+1)) + '"><input type="text" data-kv="' + f.k + '" data-i="' + i +
        '" data-part="v" value="' + esc(p.v||"") + '" placeholder="value" aria-label="' + esc(lab + " — value " + (i+1)) + '">' +
        '<button type="button" class="xbtn" data-act="delkv" data-target="' + f.k + '" data-i="' + i + '" aria-label="' + esc(t(UI.remove) + " " + (i+1)) + '">×</button></div>';
    });
    rh += '<button type="button" class="addbtn" data-act="addkv" data-target="' + f.k + '">' + t(UI.addRow) + "</button></div>";
    return '<div class="f"><span class="lab">' + esc(lab) + req + "</span>" + rh + hint + "</div>";
  } else if (f.t === "list"){
    const rows = v || [];
    let rh = '<div class="rows">';
    if (!rows.length) rh += '<p class="empty">' + t(UI.none) + "</p>";
    rows.forEach((it, i) => {
      rh += '<div class="row row--obj"><div class="sub">';
      f.item.forEach(sf => {
        const sv = it[sf.k] === undefined ? "" : it[sf.k];
        const style = sf.full ? ' style="grid-column:1/-1"' : "";
        rh += "<div" + style + '><span class="lab">' + esc(t(sf.l)) + "</span>";
        if (sf.t === "select"){
          rh += '<select data-list="' + f.k + '" data-i="' + i + '" data-k="' + sf.k + '">';
          sf.opts.forEach(o => { rh += '<option value="' + esc(o[0]) + '"' + (String(sv) === o[0] ? " selected" : "") + ">" + esc(t(o[1])) + "</option>"; });
          rh += "</select>";
        } else if (sf.t === "textarea"){
          rh += '<textarea data-list="' + f.k + '" data-i="' + i + '" data-k="' + sf.k + '">' + esc(sv) + "</textarea>";
        } else if (sf.t === "bool"){
          rh += '<label class="check"><input type="checkbox" data-list="' + f.k + '" data-i="' + i +
            '" data-k="' + sf.k + '"' + (sv ? " checked" : "") + "></label>";
        } else {
          rh += '<input type="' + (sf.t === "number" ? "number" : "text") + '" data-list="' + f.k + '" data-i="' + i +
            '" data-k="' + sf.k + '" value="' + esc(sv) + '" placeholder="' + esc(sf.ph ? t(sf.ph) : "") + '">';
        }
        rh += "</div>";
      });
      rh += '</div><button type="button" class="xbtn" data-act="dellist" data-target="' + f.k + '" data-i="' + i + '" aria-label="remove">×</button></div>';
    });
    rh += '<button type="button" class="addbtn" data-act="addlist" data-target="' + f.k + '">' + t(UI.addItem) + "</button></div>";
    return '<div class="f"><span class="lab">' + esc(lab) + req + "</span>" + rh + hint + "</div>";
  }

  const cls = f.half ? "f f--in" : "f";
  return '<div class="' + cls + '"><label for="' + id + '">' + esc(lab) + req + "</label>" + inner + hint + "</div>";
}

/* ---------- YAML pane ---------- */
function buildEntry(entry, index){
  if (!entry || !RES[entry.kind]) return [];
  const b = RES[entry.kind].build(entry.data);
  const arr = Array.isArray(b) ? b : [b];
  const ok = arr.filter(x => x && !isEmpty(x.metadata));
  if (index !== undefined && index !== null)
    ok.forEach(doc => Object.defineProperty(doc, "__src", {value:{entry:index, kind:entry.kind}, enumerable:false}));
  return ok;
}

function buildCurrent(){
  return buildEntry(S.current, S.editIndex === null ? (S.docs.length) : S.editIndex);
}

function currentDocs(){
  const out = [];
  S.docs.forEach((e, i) => {
    const ds = (i === S.editIndex) ? buildCurrent() : buildEntry(e, i);
    ds.forEach(d => out.push(d));
  });
  if (S.editIndex === null) buildCurrent().forEach(d => out.push(d));
  return out;
}

/* Welcher Schritt enthält dieses Feld? -1 wenn die Ressource es nicht kennt. */
function stepOf(kind, field){
  const steps = (RES[kind]||{}).steps || [];
  for (let i = 0; i < steps.length; i++)
    if (steps[i].fields.some(f => f.k === field)) return i;
  return -1;
}

function entryLabel(e, i){
  const ds = (i === S.editIndex) ? buildCurrent() : buildEntry(e);
  if (RES[e.kind].multi) return (e.data.name || "?") + " · " + ds.length;
  if (!ds.length) return e.kind;
  return ds[0].kind + "/" + ((ds[0].metadata||{}).name || "?");
}

function refreshYaml(){
  const docs = currentDocs();
  const text = docs.map(toYaml).join("\n---\n");
  const raw = text ? text + "\n" : "";
  $("code").dataset.raw = raw;

  if (!docs.length){
    $("code").innerHTML = '<span class="c-sep">' + esc(t(UI.emptyYaml)) + "</span>";
  } else {
    const ls = raw.replace(/\n$/,"").split("\n");
    $("code").innerHTML = ls.map((l,i) =>
      '<span class="ln">' + (i+1) + "</span>" + highlight(l)).join("\n");
  }
  $("yamlMeta").textContent = "manifest.yaml · " + docs.length + " " + t(UI.docs).toLowerCase() +
    " · " + (raw ? raw.replace(/\n$/,"").split("\n").length : 0) + " " + (LANG==="de"?"Zeilen":"lines");

  const issues = validate(docs);
  $("checks").innerHTML = !docs.length ? "" :
    (issues.length
      ? issues.map((i, n) => {
          const jump = i.src && S.docs[i.src.entry];
          const tag = jump ? "button" : "div";
          const attr = jump ? ' data-jump="' + n + '" title="' + esc(t(UI.jumpHint)) + '"' : "";
          return "<" + tag + ' class="chk chk--' + i.lvl + (jump ? " chk--jump" : "") + '"' + attr + "><b>" +
                 (i.lvl === "err" ? "error" : "warn") + "</b><span>" + esc(i.m) + "</span></" + tag + ">";
        }).join("")
      : '<div class="chk chk--ok"><b>ok</b><span>' + t(UI.allGood) + "</span></div>");
  ISSUES = issues;

  const app = docs.find(d => d.kind === "Deployment") || docs.find(d => d.kind === "StatefulSet");
  const pod = app ? null : docs.find(d => d.kind === "Pod");
  const head = app || pod;
  const nsFlag = head && head.metadata.namespace ? " -n " + head.metadata.namespace : "";
  const rolloutRef = (app && app.kind === "StatefulSet" ? "statefulset/" : "deploy/") + (app ? app.metadata.name : "");

  /* kubeseal-Aufrufe für alle SealedSecrets im Manifest */
  const seals = [];
  S.docs.concat(S.current && S.editIndex === null ? [S.current] : []).forEach(e => {
    if (!e || !RES[e.kind]) return;
    if (e.kind === "Secret" && e.data.backend === "sealed") sealCommands(e.data).forEach(x => seals.push(x));
    if (e.kind === "_stack" && e.data.secretBackend === "sealed" && (e.data.secrets||[]).some(x => x.k))
      sealCommands({name:(e.data.name||"") + "-secrets", namespace:e.data.namespace,
        data:e.data.secrets, sealedScope:e.data.sealedScope, sealedCert:e.data.sealedCert}).forEach(x => seals.push(x));
  });

  $("cmds").innerHTML = !docs.length ? "" :
    ["kubectl apply -f manifest.yaml"]
      .concat(app ? [
        "kubectl rollout status " + rolloutRef + nsFlag,
        "kubectl logs -l app=" + app.metadata.name + nsFlag + " -f --tail=50"
      ] : [])
      .concat(pod ? [
        "kubectl get pod " + pod.metadata.name + nsFlag + " -w",
        "kubectl logs " + pod.metadata.name + nsFlag + " -f --tail=50",
        "kubectl describe pod " + pod.metadata.name + nsFlag
      ] : [])
      .map(c => '<button class="cmd" data-cmd="' + esc(c) + '"><span>' + esc(c) + "</span></button>").join("")
      + seals.map(x => '<button class="cmd cmd--seal" data-cmd="' + esc(x.cmd) +
          '" title="' + esc(t(UI.sealHint)) + '"><span>kubeseal → ' + esc(x.key) + "</span></button>").join("");

  $("doclist").innerHTML = '<span class="lab">' + t(UI.docs) + "</span>" +
    (S.docs.length
      ? S.docs.map((e,i) => '<span class="chip' + (i === S.editIndex ? " chip--on" : "") + '">' +
          '<button data-edit="' + i + '" title="' + esc(t(UI.editHint)) + '">' + esc(entryLabel(e,i)) + "</button>" +
          '<button class="chip-x" data-del="' + i + '" aria-label="' + esc(t(UI.remove)) + '">×</button></span>').join("")
        + '<button class="addbtn addbtn--env" id="envBtn">' + t(UI.envAdd) + "</button>"
      : '<span class="lab">' + t(UI.noDocs) + "</span>");

  const nErr = issues.filter(i => i.lvl === "err").length;
  const nWarn = issues.filter(i => i.lvl === "warn").length;
  const summary = !docs.length ? "" : nErr + " " + t(UI.errors) + ", " + nWarn + " " + t(UI.warnings);
  if ($("checkSummary").textContent !== summary) $("checkSummary").textContent = summary;
}

function highlight(line){
  if (/^---\s*$/.test(line)) return '<span class="c-sep">---</span>';
  if (/^\s*#/.test(line)) return '<span class="c-sep">' + esc(line) + "</span>";
  const e = esc(line);
  const m = e.match(/^(\s*)(-\s)?([A-Za-z0-9_.\-\/]+)(:)(\s?)(.*)$/);
  if (m) return m[1] + (m[2] ? '<span class="c-dash">' + m[2] + "</span>" : "") +
    '<span class="c-key">' + m[3] + "</span>:" + m[5] + valHl(m[6]);
  const dm = e.match(/^(\s*)(-\s)(.*)$/);
  if (dm) return dm[1] + '<span class="c-dash">' + dm[2] + "</span>" + valHl(dm[3]);
  return e;
}
function valHl(v){
  if (v === "") return "";
  if (/^(true|false|null|\d+(\.\d+)?)$/.test(v)) return '<span class="c-num">' + v + "</span>";
  return v;
}

function render(){
  const on = !!S.current;
  $("picker").hidden = on;
  $("wizard").hidden = !on;
  $("stepnav").hidden = !on;
  if (on) renderForm(); else renderPicker();
  refreshYaml();
}

function setVal(el){
  const d = S.current.data;
  let v;
  if (el.type === "checkbox") v = el.checked;
  else if (el.type === "number") v = el.value === "" ? "" : Number(el.value);
  else v = el.value;

  if (el.dataset.kv){
    d[el.dataset.kv][+el.dataset.i][el.dataset.part] = v;
  } else if (el.dataset.list){
    d[el.dataset.list][+el.dataset.i][el.dataset.k] = v;
  } else if (el.dataset.k){
    d[el.dataset.k] = v;
  } else return false;
  return true;
}

$("form").addEventListener("input", e => { if (setVal(e.target)) refreshYaml(); });
$("form").addEventListener("change", e => {
  if (!setVal(e.target)) return;
  if (e.target.dataset.structural) renderForm();
  refreshYaml();
});
$("form").addEventListener("click", e => {
  const b = e.target.closest("button[data-act]");
  if (!b) return;
  const d = S.current.data, k = b.dataset.target;
  if (b.dataset.act === "addkv"){ d[k] = d[k] || []; d[k].push({k:"", v:""}); }
  if (b.dataset.act === "delkv"){ d[k].splice(+b.dataset.i, 1); }
  if (b.dataset.act === "addlist"){ d[k] = d[k] || []; d[k].push({}); }
  if (b.dataset.act === "dellist"){ d[k].splice(+b.dataset.i, 1); }
  renderForm(); refreshYaml();
});

$("picker").addEventListener("click", e => {
  const b = e.target.closest("button[data-res]");
  if (b) startRes(b.dataset.res);
});

function stepDelta(dir){
  const vis = visibleSteps(S.current.kind, S.current.data);
  const at = vis.indexOf(S.step);
  const next = Math.max(0, Math.min(vis.length - 1, at + dir));
  return vis[next];
}

$("rail").addEventListener("click", e => {
  if (e.target.closest("#modeTog")){
    SHORT = !SHORT;
    renderForm(); refreshYaml();
    return;
  }
  const b = e.target.closest("button[data-step]");
  if (b){ S.step = +b.dataset.step; renderForm(); $("stepTitle").focus(); }
});

$("stepnav").addEventListener("click", e => {
  const b = e.target.closest("button[data-nav]");
  if (!b) return;
  const nav = b.dataset.nav;
  if (nav === "back"){
    if (S.step === visibleSteps(S.current.kind, S.current.data)[0]){ S.current = null; S.editIndex = null; render(); }
    else { S.step = stepDelta(-1); renderForm(); refreshYaml(); $("stepTitle").focus(); }
  } else if (nav === "next"){
    S.step = stepDelta(1); renderForm(); refreshYaml();
    window.scrollTo({top:0, behavior:"smooth"});
    $("stepTitle").focus();
  } else if (nav === "commit"){
    if (S.editIndex !== null) S.docs[S.editIndex] = S.current;
    else S.docs.push(S.current);
    S.current = null; S.editIndex = null;
    render();
    window.scrollTo({top:0, behavior:"smooth"});
  } else if (nav === "jump"){
    document.querySelector(".pane--yaml").scrollIntoView({behavior:"smooth"});
  }
});

let UNDO = null, UNDO_TIMER = null;

function showToast(msg, undoLabel){
  $("toastText").textContent = msg;
  $("toastUndo").textContent = undoLabel;
  $("toast").hidden = false;
  clearTimeout(UNDO_TIMER);
  UNDO_TIMER = setTimeout(hideToast, 9000);
}
function hideToast(){ $("toast").hidden = true; UNDO = null; }

$("toastUndo").addEventListener("click", () => {
  if (!UNDO) return;
  S.docs.splice(Math.min(UNDO.index, S.docs.length), 0, UNDO.entry);
  if (S.editIndex !== null && S.editIndex >= UNDO.index) S.editIndex++;
  hideToast();
  render();
});

$("doclist").addEventListener("click", e => {
  if (e.target.closest("#envBtn")) { openEnv(); return; }
  const del = e.target.closest("button[data-del]");
  if (del){
    const i = +del.dataset.del;
    const entry = S.docs[i];
    S.docs.splice(i, 1);
    UNDO = {entry:entry, index:i};
    showToast(entryLabel(entry, -1) + " " + t(UI.deleted), t(UI.undo));
    if (S.editIndex === i){ S.current = null; S.editIndex = null; render(); }
    else { if (S.editIndex !== null && S.editIndex > i) S.editIndex--; refreshYaml(); }
    return;
  }
  const ed = e.target.closest("button[data-edit]");
  if (ed) startEdit(+ed.dataset.edit);
});

function startEdit(i, field){
  const e = S.docs[i];
  if (!e) return;
  S.current = {kind:e.kind, data: JSON.parse(JSON.stringify(e.data))};
  S.editIndex = i;
  const si = field ? stepOf(e.kind, field) : -1;
  S.step = si >= 0 ? si : 0;
  render();
  window.scrollTo({top:0, behavior:"smooth"});
  if (field){
    const el = $("form").querySelector('[data-k="' + field + '"], [data-kv="' + field + '"], [data-list="' + field + '"]');
    if (el) el.focus();
  }
}

let ISSUES = [];
$("checks").addEventListener("click", e => {
  const b = e.target.closest("button[data-jump]");
  if (!b) return;
  const i = ISSUES[+b.dataset.jump];
  if (i && i.src) startEdit(i.src.entry, i.field);
});

$("cmds").addEventListener("click", e => {
  const b = e.target.closest("button[data-cmd]");
  if (!b) return;
  copyText(b.dataset.cmd);
  const s = b.querySelector("span"), old = s.textContent;
  s.textContent = t(UI.copied);
  setTimeout(()=>{ s.textContent = old; }, 1000);
});

function copyText(text){
  if (navigator.clipboard && window.isSecureContext){
    navigator.clipboard.writeText(text).catch(fb);
  } else fb();
  function fb(){
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch(err){}
    document.body.removeChild(ta);
  }
}

$("copyBtn").addEventListener("click", () => {
  const raw = $("code").dataset.raw || "";
  const done = () => { $("copyBtn").textContent = t(UI.copied); setTimeout(()=>{$("copyBtn").textContent="copy";}, 1400); };
  if (navigator.clipboard && window.isSecureContext){
    navigator.clipboard.writeText(raw).then(done, fallback);
  } else fallback();
  function fallback(){
    const ta = document.createElement("textarea");
    ta.value = raw; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(); } catch(err){}
    document.body.removeChild(ta);
  }
});

function download(text, filename, mime){
  const blob = new Blob([text], {type:mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

$("dlBtn").addEventListener("click", () => {
  download($("code").dataset.raw || "", "manifest.yaml", "application/yaml");
});

$("saveBtn").addEventListener("click", () => {
  const name = (S.docs.length && S.docs[0].data.name) ? S.docs[0].data.name : "manifest";
  download(JSON.stringify({
    tool:"manifest.wizard", v:1, saved:new Date().toISOString(),
    entries: S.docs.map(e => ({kind:e.kind, data:e.data}))
  }, null, 2), name + ".wizard.json", "application/json");
});

$("loadBtn").addEventListener("click", () => $("loadFile").click());
$("loadFile").addEventListener("change", e => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const p = JSON.parse(r.result);
      if (p.tool !== "manifest.wizard" || !Array.isArray(p.entries)) throw new Error("shape");
      S.docs = p.entries.filter(x => x && RES[x.kind]).map(x => ({kind:x.kind, data:x.data||{}}));
      S.current = null; S.editIndex = null; S.step = 0;
      render();
      $("loadBtn").textContent = t(UI.loaded);
      setTimeout(()=>{ $("loadBtn").textContent = LANG === "de" ? "Laden" : "Load"; }, 1400);
    } catch(err){
      alert(t(UI.loadBad));
    }
  };
  r.readAsText(file);
  e.target.value = "";
});

$("resetAll").addEventListener("click", () => {
  S.docs = []; S.current = null; S.step = 0; S.editIndex = null; render();
});


/* Alle Panels liegen auf derselben Ebene — zwei gleichzeitig offen heisst,
   dass das obere die Klicks des unteren abfängt. Also immer nur eines. */
const PANELS = ["wikiPanel","clusterPanel","profilePanel","envPanel","testPanel","searchPanel"];
function closePanels(except){
  PANELS.forEach(id => { if (id !== except) $(id).hidden = true; });
}
/* Gibt zurück, ob das Panel danach offen ist. */
function togglePanel(id){
  const open = $(id).hidden;
  closePanels(id);
  $(id).hidden = !open;
  return open;
}

let PROFILE = null;

const PROFILE_EXAMPLE = {
  tool: "manifest.wizard.profile",
  v: 1,
  defaults: {
    namespace: "prod",
    privateReg: "existing",
    pullSecret: "harbor-cred",
    regServer: "harbor.firma.de",
    storageClass: "fast-ssd",
    ingressClass: "nginx",
    netpolNs: "ingress-nginx",
    cpuReq: "100m", memReq: "128Mi", cpuLim: "500m", memLim: "512Mi",
    stdLabels: true, hardened: true, partOf: "plattform"
  }
};

/* Vorbelegung greift nur für Felder, die die jeweilige Ressource überhaupt kennt. */
function applyProfile(kind, d){
  if (!PROFILE || !PROFILE.defaults) return;
  const known = {};
  (RES[kind].steps||[]).forEach(st => st.fields.forEach(f => { known[f.k] = true; }));
  Object.keys(PROFILE.defaults).forEach(k => {
    if (known[k] && d[k] === undefined) d[k] = PROFILE.defaults[k];
  });
}

function profileTexts(){
  $("profileEyebrow").textContent = LANG === "de" ? "Team-Profil" : "Team profile";
  $("profileDesc").textContent = LANG === "de"
    ? "Vorbelegungen für jeden neuen Wizard-Durchlauf. Schlüssel sind Feldnamen — was eine Ressource nicht kennt, wird ignoriert. Wird nicht im Browser gespeichert, also als Datei ablegen und ins Team-Repo legen."
    : "Defaults for every new wizard run. Keys are field names — anything a resource does not know is ignored. Not stored in the browser, so save it as a file and put it in your team repo.";
  $("profileApply").textContent = LANG === "de" ? "Übernehmen" : "Apply";
  $("profileSave").textContent = LANG === "de" ? "Als Datei speichern" : "Save as file";
  $("profileLoad").textContent = LANG === "de" ? "Datei laden" : "Load file";
  $("profileClear").textContent = LANG === "de" ? "Leeren" : "Clear";
  $("profileBtn").textContent = (LANG === "de" ? "Profil" : "Profile") + (PROFILE ? " ●" : "");
}

$("profileBtn").addEventListener("click", () => {
  if (togglePanel("profilePanel")){
    $("profileText").value = JSON.stringify(PROFILE || PROFILE_EXAMPLE, null, 2);
    $("profileText").focus();
  }
});
$("profileClose").addEventListener("click", () => { $("profilePanel").hidden = true; });

$("profileApply").addEventListener("click", () => {
  try {
    const p = JSON.parse($("profileText").value);
    if (!p || typeof p.defaults !== "object") throw new Error("shape");
    PROFILE = {tool:"manifest.wizard.profile", v:1, defaults:p.defaults};
    $("profilePanel").hidden = true;
    profileTexts();
  } catch(e){
    alert(LANG === "de" ? "Kein gültiges JSON, oder defaults fehlt." : "Not valid JSON, or defaults is missing.");
  }
});
$("profileClear").addEventListener("click", () => {
  PROFILE = null;
  $("profileText").value = JSON.stringify(PROFILE_EXAMPLE, null, 2);
  profileTexts();
});
$("profileSave").addEventListener("click", () => {
  download($("profileText").value, "wizard-profile.json", "application/json");
});
$("profileLoad").addEventListener("click", () => $("profileFile").click());
$("profileFile").addEventListener("change", e => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = () => { $("profileText").value = r.result; };
  r.readAsText(file);
  e.target.value = "";
});


const KUBECTL = [
  {g:"Anwenden und ändern|Applying and changing", items:[
    {c:"kubectl apply -f manifest.yaml", d:"Legt alles an, was noch fehlt, und gleicht den Rest an. Mehrfach ausführbar — das ist der Unterschied zu create.|Creates whatever is missing and reconciles the rest. Safe to run repeatedly — that is what sets it apart from create."},
    {c:"kubectl apply -f manifest.yaml --dry-run=server", d:"Schickt das Manifest zur Prüfung an den API-Server, ohne etwas zu ändern. Findet Tippfehler in Feldnamen, die eine reine Syntaxprüfung nie sieht.|Sends the manifest to the API server for validation without changing anything. Catches typos in field names that a pure syntax check never sees."},
    {c:"kubectl diff -f manifest.yaml", d:"Zeigt vor dem Apply, was sich ändern würde. Der wichtigste Befehl vor jedem Eingriff in Produktion.|Shows what would change before you apply. The single most important command before touching production."},
    {c:"kubectl delete -f manifest.yaml", d:"Entfernt genau die Ressourcen aus der Datei. Achtung: Ein PVC nimmt je nach reclaimPolicy die Daten mit.|Removes exactly the resources in the file. Careful: depending on reclaimPolicy a PVC takes the data with it."},
    {c:"kubectl label deploy/{app} tier=backend -n {ns} --overwrite", d:"Setzt ein Label am Objekt selbst. Nicht an seinen Pods — deren Labels stehen in spec.template und lassen sich nur über das Manifest ändern.|Sets a label on the object itself. Not on its pods — their labels live in spec.template and only change through the manifest."},
    {c:"kubectl label deploy/{app} tier- -n {ns}", d:"Das angehängte Minus entfernt den Schlüssel wieder. Dieselbe Schreibweise wie beim Entfernen eines Taints.|The trailing minus removes the key again. The same notation as removing a taint."},
    {c:"kubectl annotate deploy/{app} kubernetes.io/change-cause=\"Rollback auf 2.3\" -n {ns}", d:"Annotations trägt niemand als Auswahlkriterium heran; sie sind Beiwerk für Werkzeuge. Diese hier taucht in kubectl rollout history als Grund auf.|Nobody selects on annotations; they are metadata for tooling. This one shows up in kubectl rollout history as the reason."},
    {c:"kubectl apply -f manifest.yaml --prune -l app={app}", d:"Löscht zusätzlich Ressourcen mit diesem Label, die nicht mehr in der Datei stehen. Mächtig und entsprechend gefährlich.|Additionally deletes labelled resources that are no longer in the file. Powerful and correspondingly dangerous."}
  ]},
  {g:"Ansehen|Looking around", items:[
    {c:"kubectl get pods -n {ns}", d:"Der Standardblick. STATUS und RESTARTS sind die beiden Spalten, die zuerst etwas verraten.|The default view. STATUS and RESTARTS are the two columns that tell you something first."},
    {c:"kubectl get pods -n {ns} -o wide", d:"Zusätzlich Node und Pod-IP — nötig, sobald es um Verteilung oder Netzwerk geht.|Adds node and pod IP — needed as soon as placement or networking is the question."},
    {c:"kubectl get all -n {ns}", d:"Überblick über die gängigen Ressourcen. Zeigt trotz des Namens nicht alles, etwa keine ConfigMaps und keine Secrets.|Overview of the common resources. Despite the name it does not show everything — no ConfigMaps, no Secrets."},
    {c:"kubectl describe pod -l app={app} -n {ns}", d:"Der erste Griff bei Problemen. Unten unter Events steht meistens im Klartext, woran es hakt.|The first thing to reach for when something is wrong. The Events section at the bottom usually spells out the problem."},
    {c:"kubectl get events -n {ns} --sort-by=.lastTimestamp", d:"Alle Vorgänge im Namespace, zeitlich sortiert. Events verfallen nach etwa einer Stunde — bei einem alten Vorfall ist hier nichts mehr zu holen.|Everything that happened in the namespace, sorted by time. Events expire after roughly an hour, so an old incident leaves nothing here."},
    {c:"kubectl get deploy/{app} -n {ns} -o yaml", d:"Der tatsächliche Stand im Cluster, inklusive der Felder, die Kubernetes selbst ergänzt hat.|The actual state in the cluster, including the fields Kubernetes filled in itself."},
    {c:"kubectl get endpoints {app} -n {ns}", d:"Prüft, ob der Service überhaupt Pods gefunden hat. Leere Endpoints heißt fast immer: Selector passt nicht zu den Pod-Labels.|Checks whether the service found any pods at all. Empty endpoints nearly always means the selector does not match the pod labels."}
  ]},
  {g:"Fehler suchen|Debugging", items:[
    {c:"kubectl logs -l app={app} -n {ns} --tail=100 -f", d:"Logs aller Pods der Anwendung, fortlaufend. Ohne Label-Selector bekommt man nur einen einzelnen Pod.|Logs of every pod of the app, streaming. Without the label selector you only get one pod."},
    {c:"kubectl logs {app}-xxxxx -n {ns} --previous", d:"Die Logs des vorherigen, abgestürzten Containers. Bei CrashLoopBackOff die einzige Stelle, an der die eigentliche Ursache steht.|Logs of the previous, crashed container. With CrashLoopBackOff this is the only place the actual cause appears."},
    {c:"kubectl exec -it deploy/{app} -n {ns} -- sh", d:"Shell im laufenden Container. Bei distroless oder scratch-Images gibt es keine Shell — dann hilft nur kubectl debug.|A shell in the running container. Distroless or scratch images have no shell — then only kubectl debug helps."},
    {c:"kubectl debug -it deploy/{app} -n {ns} --image=busybox --target={app}", d:"Hängt einen Debug-Container in denselben Pod, ohne ihn neu zu starten. Der Weg für Images ohne Werkzeuge.|Attaches a debug container to the same pod without restarting it. The way in for images without tooling."},
    {c:"kubectl port-forward svc/{app} 8080:80 -n {ns}", d:"Leitet einen lokalen Port in den Cluster. Testet den Service direkt, ohne Ingress und ohne DNS — grenzt Fehler schnell ein.|Forwards a local port into the cluster. Tests the service directly, bypassing ingress and DNS — narrows down a fault fast."},
    {c:"kubectl top pod -l app={app} -n {ns}", d:"Tatsächlicher CPU- und Speicherverbrauch. Die Grundlage, um requests und limits zu setzen, statt zu raten. Braucht den metrics-server.|Actual CPU and memory usage. The basis for setting requests and limits instead of guessing. Requires metrics-server."}
  ]},
  {g:"Rollout|Rollout", items:[
    {c:"kubectl rollout status deploy/{app} -n {ns}", d:"Wartet, bis das Update durch ist, und bricht ab, wenn es hängt. Gehört in jede Deployment-Pipeline.|Waits until the update completes and fails if it stalls. Belongs in every deployment pipeline."},
    {c:"kubectl rollout undo deploy/{app} -n {ns}", d:"Zurück auf die vorherige Version. Der schnellste Weg aus einem kaputten Release.|Back to the previous revision. The fastest way out of a broken release."},
    {c:"kubectl rollout history deploy/{app} -n {ns}", d:"Welche Revisionen es gibt. Wie viele aufgehoben werden, steuert revisionHistoryLimit.|Which revisions exist. How many are kept is controlled by revisionHistoryLimit."},
    {c:"kubectl rollout restart deploy/{app} -n {ns}", d:"Startet alle Pods rollierend neu, ohne das Image zu ändern. Der übliche Weg, damit geänderte ConfigMaps oder Secrets greifen.|Restarts all pods in a rolling fashion without changing the image. The usual way to pick up changed ConfigMaps or Secrets."},
    {c:"kubectl set image deploy/{app} {app}=IMAGE:TAG -n {ns}", d:"Ändert nur den Tag. Praktisch für einen schnellen Test, weicht danach aber vom Manifest ab — beim nächsten Apply ist es wieder weg.|Changes just the tag. Handy for a quick test, but it drifts from the manifest and the next apply reverts it."}
  ]},
  {g:"Skalieren und Nodes|Scaling and nodes", items:[
    {c:"kubectl scale deploy/{app} --replicas=3 -n {ns}", d:"Ändert die Anzahl sofort. Genau wie set image weicht das vom Manifest ab.|Changes the count immediately. Just like set image this drifts from the manifest."},
    {c:"kubectl drain NODE --ignore-daemonsets --delete-emptydir-data", d:"Räumt einen Node für Wartung. Genau hier greift ein PodDisruptionBudget und bremst, wenn zu viele Replicas gleichzeitig gingen.|Clears a node for maintenance. This is exactly where a PodDisruptionBudget kicks in and slows things down if too many replicas would go at once."},
    {c:"kubectl cordon NODE", d:"Node bekommt keine neuen Pods mehr, laufende bleiben. uncordon nimmt es zurück.|The node accepts no new pods while running ones stay. uncordon reverses it."},
    {c:"kubectl taint nodes NODE dedicated=gpu:NoSchedule", d:"Sperrt den Node für alles, was keine passende toleration mitbringt. Anders als cordon wirkt das gezielt: Wer den Taint toleriert, darf weiterhin darauf. So reserviert man Nodes für bestimmte Arbeitslasten.|Keeps everything off the node that does not carry a matching toleration. Unlike cordon this is selective: whoever tolerates the taint may still run there. That is how you reserve nodes for particular workloads."},
    {c:"kubectl taint nodes NODE dedicated=gpu:NoExecute", d:"NoExecute wirft zusätzlich alles hinaus, was bereits läuft und den Taint nicht toleriert — sofort, nicht bei nächster Gelegenheit.|NoExecute additionally throws out whatever is already running and does not tolerate the taint — immediately, not at the next opportunity."},
    {c:"kubectl taint nodes NODE dedicated-", d:"Das angehängte Minus entfernt den Taint. Ohne Effekt entfernt es alle Taints mit diesem Schlüssel. Vergisst man den Bindestrich, legt derselbe Befehl den Taint stattdessen an.|The trailing minus removes the taint. Without an effect it removes every taint with that key. Forget the hyphen and the same command adds the taint instead."},
    {c:"kubectl get nodes -o custom-columns=NAME:.metadata.name,UNSCHEDULABLE:.spec.unschedulable,TAINTS:.spec.taints[*].key", d:"Zeigt auf einen Blick, welcher Node gesperrt ist und welche Taints tatsächlich gesetzt sind. Bleibt ein Pod Pending, steht die Antwort oft in dieser Tabelle.|Shows at a glance which node is cordoned and which taints are actually set. If a pod stays Pending, the answer is often in this table."}
  ]},
  {g:"Kontext und Namespace|Context and namespace", items:[
    {c:"kubectl config get-contexts", d:"Welche Cluster konfiguriert sind und welcher gerade aktiv ist. Der Blick, der einen Apply im falschen Cluster verhindert.|Which clusters are configured and which is active. The check that prevents applying to the wrong cluster."},
    {c:"kubectl config set-context --current --namespace={ns}", d:"Setzt den Standard-Namespace für die aktuelle Sitzung. Spart das ständige -n.|Sets the default namespace for the current context. Saves typing -n every time."},
    {c:"kubectl explain deploy.spec.template.spec.containers", d:"Die Feldbeschreibung direkt aus dem Cluster, passend zu dessen Version. Besser als jede Dokumentation im Netz, weil es die eigene API-Version beschreibt.|Field documentation straight from the cluster, matching its version. Better than any docs online because it describes your own API version."},
    {c:"kubectl api-resources", d:"Alle Ressourcentypen, die dieser Cluster kennt, samt Kurznamen und apiVersion. Zeigt auch, was an CRDs installiert ist.|Every resource type this cluster knows, with short names and apiVersion. Also reveals which CRDs are installed."}
  ]},
  {g:"ConfigMaps und Secrets|ConfigMaps and secrets", items:[
    {c:"kubectl get secret {app}-secrets -n {ns} -o jsonpath='{.data.KEY}' | base64 -d", d:"Liest einen einzelnen Wert im Klartext. Zeigt nebenbei, wie wenig Schutz base64 bietet.|Reads a single value in plain text. Demonstrates in passing how little protection base64 offers."},
    {c:"kubectl create secret generic NAME --from-literal=KEY=VALUE --dry-run=client -o yaml", d:"Erzeugt YAML, ohne etwas anzulegen. Der übliche Weg, ein Secret zu bauen, ohne es in die Shell-History zu schreiben.|Generates YAML without creating anything. The usual way to build a secret without putting it in your shell history."},
    {c:"kubectl create configmap NAME --from-file=./datei.conf --dry-run=client -o yaml", d:"Macht aus einer echten Datei eine ConfigMap — praktisch bei größeren Konfigurationen.|Turns a real file into a ConfigMap — handy for larger configurations."}
  ]}
];

function renderWiki(){
  const docs = currentDocs();
  const app = docs.find(d => d.kind === "Deployment") || docs.find(d => d.kind === "StatefulSet")
    || docs.find(d => d.kind === "Pod");
  const appName = app ? app.metadata.name : "my-app";
  const nsName = (app && app.metadata.namespace) || "default";
  const q = ($("wikiFilter").value || "").toLowerCase();

  let h = "";
  KUBECTL.forEach(sec => {
    const items = sec.items
      .map(it => ({c: it.c.replace(/\{app\}/g, appName).replace(/\{ns\}/g, nsName), d: t(it.d)}))
      .filter(it => !q || (it.c + " " + it.d).toLowerCase().indexOf(q) !== -1);
    if (!items.length) return;
    h += '<p class="hgroup">' + esc(t(sec.g)) + "</p><div class=\"wikiitems\">";
    items.forEach(it => {
      h += '<div class="wikiitem"><button class="cmd cmd--wiki" data-cmd="' + esc(it.c) + '"><span>' +
           esc(it.c) + "</span></button><p>" + esc(it.d) + "</p></div>";
    });
    h += "</div>";
  });
  $("wikiList").innerHTML = h || '<p class="empty">—</p>';
}

$("wikiBtn").addEventListener("click", () => {
  const open = togglePanel("wikiPanel");
  $("wikiBtn").setAttribute("aria-expanded", open);
  if (open){ setWikiTab(WIKI_TAB); if (WIKI_TAB === "ref") $("wikiFilter").focus(); }
});
$("wikiClose").addEventListener("click", () => { $("wikiPanel").hidden = true; });
$("wikiFilter").addEventListener("input", renderWiki);
$("wikiList").addEventListener("click", e => {
  const b = e.target.closest("button[data-cmd]");
  if (!b) return;
  copyText(b.dataset.cmd);
  const s = b.querySelector("span"), old = s.textContent;
  s.textContent = t(UI.copied);
  setTimeout(()=>{ s.textContent = old; }, 1000);
});

$("explainBtn").addEventListener("click", () => {
  EXPLAIN = !EXPLAIN;
  $("explainBtn").setAttribute("aria-pressed", EXPLAIN);
  if (S.current) renderForm();
});


const MASK = "\u2022\u2022\u2022\u2022\u2022";

function fieldValueMd(f, d){
  const v = d[f.k];
  if (v === undefined || v === null || v === "") return null;
  if (f.t === "bool") return v ? (LANG === "de" ? "ja" : "yes") : null;
  if (f.secret && f.t !== "kv") return "`" + MASK + "`";
  if (f.t === "kv"){
    const p = (v||[]).filter(x => x.k);
    if (!p.length) return null;
    return p.map(x => "`" + x.k + "` = `" + (f.secret ? MASK : x.v) + "`").join(", ");
  }
  if (f.t === "list"){
    const rows = (v||[]).filter(x => Object.keys(x).some(k => x[k] !== "" && x[k] !== undefined));
    if (!rows.length) return null;
    return rows.map(r => "\n  - " + f.item
      .filter(sf => r[sf.k] !== undefined && r[sf.k] !== "")
      .map(sf => sf.k + ": " + String(r[sf.k]).replace(/\n/g, " / "))
      .join(", ")).join("");
  }
  if (f.t === "select"){
    const o = f.opts.filter(x => x[0] === String(v))[0];
    return "`" + (v || "(default)") + "`" + (o ? " (" + t(o[1]) + ")" : "");
  }
  if (f.t === "lines" || f.t === "textarea")
    return "\n\n  ```\n" + String(v).replace(/\n+$/, "").split("\n").map(l => "  " + l).join("\n") + "\n  ```\n";
  return "`" + v + "`";
}

function toMarkdown(){
  const docs = currentDocs();
  const raw = docs.map(toYaml).join("\n---\n");
  const app = docs.filter(x => x.kind === "Deployment")[0];
  const pod = app ? null : docs.filter(x => x.kind === "Pod")[0];
  const title = (app || pod) ? (app || pod).metadata.name
    : (S.docs.length ? entryLabel(S.docs[0], -1) : "manifest");
  const de = LANG === "de";
  let m = "# " + title + "\n\n";
  m += (de ? "Erzeugt mit manifest.wizard am " : "Generated with manifest.wizard on ") +
       new Date().toISOString().slice(0, 10) + ". " +
       (de ? "Vertrauliche Werte sind maskiert — das eingebettete Manifest weiter unten enthält sie jedoch im Klartext."
           : "Confidential values are masked — but the embedded manifest further down still contains them in plain text.") + "\n\n";

  m += "## " + (de ? "Was angelegt wird" : "What gets created") + "\n\n";
  m += "| Kind | Name | Namespace |\n|---|---|---|\n";
  docs.forEach(d => {
    const ns = (d.metadata||{}).namespace;
    m += "| " + d.kind + " | `" + ((d.metadata||{}).name || "?") + "` | " +
         (d.kind === "Namespace" ? "—" : "`" + (ns || "default") + "`") + " |\n";
  });
  m += "\n";

  m += "## " + (de ? "Die Entscheidungen" : "The decisions") + "\n\n";
  S.docs.forEach(e => {
    const r = RES[e.kind];
    m += "### " + (r.label ? t(r.label) : e.kind) + " — `" + (e.data.name || "?") + "`\n\n";
    if (r.best){
      m += "**" + t(UI.best) + "**\n\n";
      r.best.forEach(x => { m += "- " + t(x) + "\n"; });
      m += "\n";
    }
    r.steps.forEach(st => {
      const fs = st.fields.filter(f => (!f.when || f.when(e.data)) && fieldValueMd(f, e.data) !== null);
      if (!fs.length) return;
      m += "**" + t(st.title) + "**\n\n";
      fs.forEach(f => {
        m += "- " + t(f.l) + ": " + fieldValueMd(f, e.data) + "\n";
        const w = f.why || WHY[e.kind + "." + f.k] || WHY[f.k];
        if (w) m += "  > " + t(w) + "\n";
      });
      m += "\n";
    });
  });

  const issues = validate(docs);
  if (issues.length){
    m += "## " + (de ? "Offene Hinweise" : "Open issues") + "\n\n";
    issues.forEach(i => { m += "- **" + (i.lvl === "err" ? "error" : "warn") + "** — " + i.m + "\n"; });
    m += "\n";
  }

  const nsSrc = app || pod;
  const ns = nsSrc && nsSrc.metadata.namespace ? " -n " + nsSrc.metadata.namespace : "";
  m += "## " + (de ? "Anwenden" : "Applying") + "\n\n```sh\nkubectl diff -f manifest.yaml\nkubectl apply -f manifest.yaml\n";
  if (app) m += "kubectl rollout status deploy/" + app.metadata.name + ns + "\n";
  else if (pod) m += "kubectl get pod " + pod.metadata.name + ns + " -w\n";
  m += "```\n\n## manifest.yaml\n\n```yaml\n" + raw + "```\n";
  return m;
}

$("docBtn").addEventListener("click", () => {
  const docs = currentDocs();
  if (!docs.length) return;
  const app = docs.filter(x => x.kind === "Deployment")[0] || docs.filter(x => x.kind === "Pod")[0];
  download(toMarkdown(), (app ? app.metadata.name : "manifest") + ".md", "text/markdown");
});


function openEnv(){
  if (!S.docs.length) return;
  const de = LANG === "de";
  $("envEyebrow").textContent = de ? "Weitere Umgebung" : "Another environment";
  $("envDesc").textContent = de
    ? "Kopiert einen vorhandenen Eintrag und ersetzt dabei nur die Felder, die sich zwischen Umgebungen unterscheiden. Der Name bleibt gleich — in einem anderen Namespace stört das nicht."
    : "Copies an existing entry and replaces only the fields that differ between environments. The name stays the same — in another namespace that causes no conflict.";
  $("envApply").textContent = de ? "Kopie anlegen" : "Create copy";

  let h = '<div class="f"><label for="envSrc">' + (de ? "Vorlage" : "Source") + '</label><select id="envSrc">';
  S.docs.forEach((e, i) => { h += '<option value="' + i + '">' + esc(entryLabel(e, -1)) + "</option>"; });
  h += "</select></div>";
  h += '<div class="f f--in"><label for="envNs">Namespace</label><input type="text" id="envNs" placeholder="staging"></div>';
  h += '<div class="f f--in"><label for="envReplicas">Replicas</label><input type="number" id="envReplicas" min="0" placeholder="1"></div>';
  h += '<div class="f"><label for="envHost">' + (de ? "Ingress-Host" : "Ingress host") +
       '</label><input type="text" id="envHost" placeholder="shop.staging.example.com"></div>';
  $("envFields").innerHTML = h;
  closePanels("envPanel");
  $("envPanel").hidden = false;
  $("envNs").focus();
}

$("envApply").addEventListener("click", () => {
  const i = +$("envSrc").value;
  const src = S.docs[i];
  if (!src) return;
  const copy = {kind:src.kind, data: JSON.parse(JSON.stringify(src.data))};
  const known = {};
  (RES[src.kind].steps||[]).forEach(st => st.fields.forEach(f => { known[f.k] = true; }));
  const ns = $("envNs").value.trim();
  const rp = $("envReplicas").value.trim();
  const hs = $("envHost").value.trim();
  if (ns && known.namespace) copy.data.namespace = ns;
  if (rp !== "" && known.replicas) copy.data.replicas = Number(rp);
  if (hs && known.host) copy.data.host = hs;
  S.docs.push(copy);
  $("envPanel").hidden = true;
  render();
});
$("envClose").addEventListener("click", () => { $("envPanel").hidden = true; });


document.addEventListener("keydown", e => {
  if (e.key === "Escape"){
    ["wikiPanel","profilePanel","envPanel","testPanel","searchPanel","clusterPanel"].forEach(id => { $(id).hidden = true; });
    if (!$("toast").hidden) hideToast();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")){
    e.preventDefault(); openSearch(); return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && S.current){
    e.preventDefault();
    const v = visibleSteps(S.current.kind, S.current.data);
    const last = v[v.length - 1] === S.step;
    const btn = $("stepnav").querySelector(last ? '[data-nav="commit"]' : '[data-nav="next"]');
    if (btn) btn.click();
  }
});


const K_KINDS = [["pods","pods"],["deploy","deployments"],["svc","services"],["ingress","ingresses"],
  ["configmap","configmaps"],["secret","secrets"],["pvc","pvcs"],["job","jobs"],["cronjob","cronjobs"],
  ["networkpolicy","networkpolicies"],["pdb","poddisruptionbudgets"],["events","events"],
  ["nodes","nodes"],["all","all"]];

let CMD = {task:"list", o:{}, ctx:""};

function nsF(o){ return o.allNs ? " -A" : (o.ns ? " -n " + o.ns : ""); }
function ctxF(){ return CMD.ctx ? " --context=" + CMD.ctx : ""; }
function target(o, def){
  if (o.selector) return "";
  return " " + (o.targetKind || def || "deploy") + "/" + (o.name || "NAME");
}

const CMDTASKS = [
{id:"list", l:"Auflisten|List", d:"Was existiert gerade?|What exists right now?",
 fields:[
  {k:"kind", t:"select", l:"Typ|Type", opts:K_KINDS},
  {k:"ns", t:"text", l:"Namespace", ph:"default", half:true},
  {k:"allNs", t:"bool", l:"über alle Namespaces|across all namespaces"},
  {k:"selector", t:"text", l:"Label-Filter|Label filter", ph:"app=my-app"},
  {k:"out", t:"select", l:"Ausgabe|Output", structural:true,
   opts:[["","Tabelle|table"],["wide","wide — mit Node und IP|wide — with node and IP"],
         ["yaml","yaml — vollständig|yaml — complete"],["name","name — nur Namen|name — names only"],
         ["jsonpath","jsonpath — ein Feld|jsonpath — a single field"]]},
  {k:"jsonpath", t:"text", l:"jsonpath", ph:"{.items[*].metadata.name}", when:o=>o.out==="jsonpath"},
  {k:"watch", t:"bool", l:"laufend beobachten|keep watching"}
 ],
 build(o){
  let c = "kubectl get " + (o.kind || "pods") + ctxF() + nsF(o);
  const f = [];
  if (o.selector){ c += " -l " + o.selector; f.push(["-l", "Filtert über Labels, nicht über Namen — dieselbe Logik, die auch ein Service benutzt.|Filters by labels, not names — the same logic a service uses."]); }
  if (o.out === "wide"){ c += " -o wide"; f.push(["-o wide", "Zeigt zusätzlich Node und Pod-IP.|Additionally shows node and pod IP."]); }
  if (o.out === "yaml"){ c += " -o yaml"; f.push(["-o yaml", "Der vollständige Stand im Cluster, inklusive der Felder, die Kubernetes selbst gesetzt hat.|The complete state in the cluster, including fields Kubernetes set itself."]); }
  if (o.out === "name"){ c += " -o name"; f.push(["-o name", "Nur die Namen — praktisch, um die Ausgabe in einen anderen Befehl zu leiten.|Names only — useful for piping into another command."]); }
  if (o.out === "jsonpath"){ c += " -o jsonpath='" + (o.jsonpath || "{.items[*].metadata.name}") + "'"; f.push(["-o jsonpath", "Greift genau ein Feld heraus. Der Pfad folgt der Struktur, die -o yaml zeigt.|Extracts exactly one field. The path follows the structure that -o yaml shows."]); }
  if (o.watch){ c += " -w"; f.push(["-w", "Bleibt offen und meldet jede Änderung. Beenden mit Strg+C.|Stays open and reports every change. Stop with Ctrl+C."]); }
  if (o.allNs) f.push(["-A", "Über alle Namespaces hinweg. Auf großen Clustern wird die Ausgabe schnell unübersichtlich.|Across all namespaces. On large clusters the output gets unwieldy fast."]);
  return {c:c, f:f, r:[]};
 }},

{id:"describe", l:"Details|Describe", d:"Warum tut es nicht, was es soll?|Why is it not doing what it should?",
 fields:[
  {k:"kind", t:"select", l:"Typ|Type", opts:K_KINDS},
  {k:"ns", t:"text", l:"Namespace", ph:"default", half:true},
  {k:"name", t:"text", l:"Name", ph:"my-app", half:true},
  {k:"selector", t:"text", l:"…oder Label-Filter|…or label filter", ph:"app=my-app"}
 ],
 build(o){
  let c = "kubectl describe " + (o.kind || "pods") + ctxF();
  if (o.selector) c += " -l " + o.selector; else if (o.name) c += " " + o.name;
  c += nsF(o);
  return {c:c, f:[["describe", "Der erste Griff bei Problemen. Der Abschnitt Events ganz unten benennt die Ursache meist im Klartext.|The first thing to reach for. The Events section at the very bottom usually names the cause outright."]], r:[]};
 }},

{id:"logs", l:"Logs", d:"Was sagt die Anwendung selbst?|What does the app itself say?",
 fields:[
  {k:"targetKind", t:"select", l:"Ziel|Target", opts:[["deploy","deploy"],["pod","pod"],["job","job"],["sts","statefulset"]]},
  {k:"name", t:"text", l:"Name", ph:"my-app", half:true},
  {k:"ns", t:"text", l:"Namespace", ph:"default", half:true},
  {k:"selector", t:"text", l:"…oder Label-Filter|…or label filter", ph:"app=my-app",
   hint:"Mit Selector kommen die Logs aller passenden Pods, nicht nur eines.|With a selector you get the logs of every matching pod, not just one."},
  {k:"follow", t:"bool", l:"laufend mitlesen|follow"},
  {k:"tail", t:"text", l:"Letzte n Zeilen|Last n lines", ph:"100", half:true},
  {k:"since", t:"text", l:"Zeitraum|Since", ph:"1h", half:true},
  {k:"previous", t:"bool", l:"vorheriger, abgestürzter Container|previous, crashed container"},
  {k:"container", t:"text", l:"Container", ph:"nur bei mehreren|only with several"}
 ],
 build(o){
  let c = "kubectl logs" + ctxF();
  if (o.selector) c += " -l " + o.selector; else c += target(o, "deploy");
  c += nsF(o);
  const f = [];
  if (o.container) c += " -c " + o.container;
  if (o.tail){ c += " --tail=" + o.tail; f.push(["--tail", "Ohne Begrenzung kommt die gesamte Historie auf einmal.|Without a limit the entire history arrives at once."]); }
  if (o.since){ c += " --since=" + o.since; f.push(["--since", "Nur Einträge aus diesem Zeitraum, etwa 15m oder 2h.|Only entries from that window, e.g. 15m or 2h."]); }
  if (o.previous){ c += " --previous"; f.push(["--previous", "Die Logs des abgestürzten Vorgängers. Bei CrashLoopBackOff die einzige Stelle, an der die eigentliche Ursache steht.|Logs of the crashed predecessor. With CrashLoopBackOff this is the only place the real cause appears."]); }
  if (o.follow){ c += " -f"; f.push(["-f", "Bleibt offen. Zusammen mit --previous nicht möglich.|Stays open. Cannot be combined with --previous."]); }
  const r = [];
  if (o.follow && o.previous) r.push({lvl:"err", m:t("-f und --previous schließen sich aus: Ein beendeter Container liefert keine neuen Zeilen mehr.|-f and --previous are mutually exclusive: a terminated container produces no new lines.")});
  return {c:c, f:f, r:r};
 }},

{id:"exec", l:"Shell|Shell", d:"Von innen nachsehen|Take a look from inside",
 fields:[
  {k:"targetKind", t:"select", l:"Ziel|Target", opts:[["deploy","deploy"],["pod","pod"]]},
  {k:"name", t:"text", l:"Name", ph:"my-app", half:true},
  {k:"ns", t:"text", l:"Namespace", ph:"default", half:true},
  {k:"shell", t:"select", l:"Programm|Program", opts:[["sh","sh"],["bash","bash"],["custom","eigener Befehl|custom command"]], structural:true},
  {k:"custom", t:"text", l:"Befehl|Command", ph:"env", when:o=>o.shell==="custom"},
  {k:"container", t:"text", l:"Container", ph:"nur bei mehreren|only with several"}
 ],
 build(o){
  let c = "kubectl exec -it" + ctxF() + target(o, "deploy") + nsF(o);
  if (o.container) c += " -c " + o.container;
  c += " -- " + (o.shell === "custom" ? (o.custom || "env") : (o.shell || "sh"));
  return {c:c, f:[
    ["-it", "Interaktives Terminal. Ohne beide Flags bleibt die Shell sofort wieder stehen.|Interactive terminal. Without both flags the shell exits immediately."],
    ["--", "Trennt die Flags von kubectl vom Befehl im Container. Alles danach gehört dem Container.|Separates kubectl's own flags from the command in the container. Everything after belongs to the container."]
  ], r:[{lvl:"warn", m:t("Änderungen im Container überleben keinen Neustart. Was bleiben soll, gehört ins Image oder ins Manifest.|Changes inside the container do not survive a restart. Anything that should persist belongs in the image or the manifest.")}]};
 }},

{id:"pf", l:"Port-Forward", d:"Ohne Ingress und ohne DNS testen|Test without ingress and without DNS",
 fields:[
  {k:"targetKind", t:"select", l:"Ziel|Target", opts:[["svc","svc"],["deploy","deploy"],["pod","pod"]]},
  {k:"name", t:"text", l:"Name", ph:"my-app", half:true},
  {k:"ns", t:"text", l:"Namespace", ph:"default", half:true},
  {k:"local", t:"text", l:"Lokaler Port|Local port", ph:"8080", half:true},
  {k:"remote", t:"text", l:"Port im Cluster|Port in the cluster", ph:"80", half:true}
 ],
 build(o){
  const c = "kubectl port-forward" + ctxF() + target(o, "svc") + " " +
            (o.local || "8080") + ":" + (o.remote || "80") + nsF(o);
  return {c:c, f:[
    ["port-forward", "Baut einen Tunnel vom eigenen Rechner in den Cluster. Grenzt schnell ein, ob ein Problem am Ingress oder an der Anwendung liegt.|Builds a tunnel from your machine into the cluster. Quickly narrows down whether a fault sits in the ingress or in the app."],
    ["svc/…", "Auf einen Service zeigend geht es über den Selector — damit testest du auch gleich, ob der überhaupt Pods findet.|Pointing at a service goes through the selector — so you also test whether it finds any pods at all."]
  ], r:[]};
 }},

{id:"apply", l:"Anwenden|Apply", d:"Manifest ins Cluster bringen|Get the manifest into the cluster",
 fields:[
  {k:"file", t:"text", l:"Datei|File", ph:"manifest.yaml"},
  {k:"ns", t:"text", l:"Namespace", ph:"aus dem Manifest|from the manifest", half:true},
  {k:"dry", t:"select", l:"Trockenlauf|Dry run",
   opts:[["","nein, wirklich anwenden|no, actually apply"],["server","server — vom Cluster prüfen lassen|server — let the cluster validate"],["client","client — nur lokal prüfen|client — local check only"]]},
  {k:"diff", t:"bool", l:"vorher kubectl diff zeigen|show kubectl diff first"},
  {k:"prune", t:"text", l:"--prune mit Label|--prune with label", ph:"app=my-app"}
 ],
 build(o){
  const file = o.file || "manifest.yaml";
  let c = "";
  if (o.diff) c += "kubectl diff" + ctxF() + " -f " + file + nsF(o) + "\n";
  c += "kubectl apply" + ctxF() + " -f " + file + nsF(o);
  const f = [], r = [];
  if (o.dry){ c += " --dry-run=" + o.dry;
    f.push(["--dry-run=" + o.dry, o.dry === "server"
      ? t("Der API-Server prüft vollständig, ändert aber nichts. Findet Tippfehler in Feldnamen, die eine reine Syntaxprüfung nie sieht.|The API server validates fully but changes nothing. Catches typos in field names that a pure syntax check never sees.")
      : t("Prüft nur lokal. Erkennt kaputtes YAML, aber keine falschen Felder.|Checks locally only. Detects broken YAML but not wrong fields.")]);
  }
  if (o.prune){ c += " --prune -l " + o.prune;
    f.push(["--prune", "Löscht Ressourcen mit diesem Label, die nicht mehr in der Datei stehen.|Deletes labelled resources that are no longer in the file."]);
    r.push({lvl:"err", m:t("--prune löscht. Passt das Label auf mehr, als du denkst, verschwindet mehr, als du wolltest. Vorher mit --dry-run=server prüfen.|--prune deletes. If the label matches more than you think, more disappears than you intended. Check with --dry-run=server first.")});
  }
  if (o.diff) f.push(["diff", "Zeigt vorab, was sich ändern würde. Der wichtigste Schritt vor jedem Eingriff in Produktion.|Shows in advance what would change. The most important step before touching production."]);
  if (!CMD.ctx && !o.dry) r.push({lvl:"warn", m:t("Ohne --context gilt der gerade aktive Cluster. Bei mehreren Clustern lohnt sich der explizite Name.|Without --context the currently active cluster applies. With several clusters the explicit name is worth it.")});
  return {c:c, f:f, r:r};
 }},

{id:"rollout", l:"Rollout", d:"Update beobachten, wiederholen, zurücknehmen|Watch, repeat or revert an update",
 fields:[
  {k:"action", t:"select", l:"Aktion|Action", structural:true,
   opts:[["status","status — warten bis fertig|status — wait until done"],
         ["restart","restart — Pods neu starten|restart — restart the pods"],
         ["undo","undo — zurück auf vorher|undo — back to the previous revision"],
         ["history","history — Revisionen auflisten|history — list revisions"]]},
  {k:"targetKind", t:"select", l:"Typ|Type", opts:[["deploy","deploy"],["sts","statefulset"],["ds","daemonset"]]},
  {k:"name", t:"text", l:"Name", ph:"my-app", half:true},
  {k:"ns", t:"text", l:"Namespace", ph:"default", half:true},
  {k:"revision", t:"text", l:"Zu Revision|To revision", ph:"3", when:o=>o.action==="undo"}
 ],
 build(o){
  const a = o.action || "status";
  let c = "kubectl rollout " + a + ctxF() + target(o, "deploy") + nsF(o);
  const f = [], r = [];
  if (a === "undo" && o.revision) c += " --to-revision=" + o.revision;
  if (a === "status") f.push(["status", "Wartet, bis das Update durch ist, und endet mit einem Fehlercode, wenn es hängt. Gehört in jede Pipeline.|Waits until the update completes and exits non-zero if it stalls. Belongs in every pipeline."]);
  if (a === "restart") f.push(["restart", "Startet alle Pods rollierend neu, ohne das Image zu ändern. Der übliche Weg, damit geänderte ConfigMaps oder Secrets greifen.|Restarts all pods in a rolling fashion without changing the image. The usual way to pick up changed ConfigMaps or Secrets."]);
  if (a === "undo"){
    f.push(["undo", "Setzt auf die vorherige Revision zurück. Der schnellste Weg aus einem kaputten Release.|Rolls back to the previous revision. The fastest way out of a broken release."]);
    r.push({lvl:"warn", m:t("Danach weicht der Cluster vom Manifest ab. Beim nächsten Apply ist die zurückgenommene Version wieder da — die Ursache gehört also auch im Repository behoben.|Afterwards the cluster differs from the manifest. The next apply brings the reverted version back — so fix the cause in the repository too.")});
  }
  return {c:c, f:f, r:r};
 }},

{id:"scale", l:"Skalieren|Scale", d:"Mehr oder weniger Replicas|More or fewer replicas",
 fields:[
  {k:"targetKind", t:"select", l:"Typ|Type", opts:[["deploy","deploy"],["sts","statefulset"]]},
  {k:"name", t:"text", l:"Name", ph:"my-app", half:true},
  {k:"replicas", t:"text", l:"Replicas", ph:"3", half:true},
  {k:"ns", t:"text", l:"Namespace", ph:"default"}
 ],
 build(o){
  const c = "kubectl scale" + ctxF() + target(o, "deploy") + " --replicas=" + (o.replicas || "1") + nsF(o);
  const r = [{lvl:"warn", m:t("Wirkt sofort, weicht danach aber vom Manifest ab. Beim nächsten Apply gilt wieder der Wert aus der Datei.|Takes effect immediately but then drifts from the manifest. The next apply restores the value from the file.")}];
  if (String(o.replicas) === "0") r.push({lvl:"warn", m:t("Null Replicas heißt: Die Anwendung ist weg, aber das Deployment bleibt bestehen.|Zero replicas means the app is gone while the deployment stays.")});
  return {c:c, f:[], r:r};
 }},

{id:"node", l:"Nodes", d:"Sperren, räumen, Taints setzen|Cordon, drain, taints",
 fields:[
  {k:"action", t:"select", l:"Aktion|Action", structural:true,
   opts:[["taint","taint setzen — Node reservieren|add a taint — reserve the node"],
         ["untaint","taint entfernen|remove a taint"],
         ["show","Taints und Zustand auflisten|list taints and state"],
         ["cordon","cordon — keine neuen Pods|cordon — no new pods"],
         ["uncordon","uncordon — wieder freigeben|uncordon — allow scheduling again"],
         ["drain","drain — für Wartung räumen|drain — clear for maintenance"],
         ["label","label — Node beschriften|label — label the node"]]},
  {k:"name", t:"text", l:"Node", ph:"worker-01", half:true, when:o=>o.action!=="show"},
  {k:"selector", t:"text", l:"…oder Label-Filter|…or label filter", ph:"disktype=ssd", half:true,
   when:o=>!o.action||o.action==="taint"||o.action==="untaint"||o.action==="label"},
  {k:"key", t:"text", l:"Schlüssel|Key", ph:"dedicated", half:true,
   when:o=>!o.action||o.action==="taint"||o.action==="untaint"},
  {k:"value", t:"text", l:"Wert|Value", ph:"gpu", half:true, when:o=>!o.action||o.action==="taint"},
  {k:"effect", t:"select", l:"effect", when:o=>!o.action||o.action==="taint"||o.action==="untaint",
   opts:[["NoSchedule","NoSchedule — keine neuen Pods|NoSchedule — no new pods"],
         ["PreferNoSchedule","PreferNoSchedule — möglichst nicht|PreferNoSchedule — avoid if possible"],
         ["NoExecute","NoExecute — auch laufende Pods hinaus|NoExecute — evict running pods too"],
         ["","jeder Effekt — nur beim Entfernen|any effect — removal only"]]},
  {k:"label", t:"text", l:"Label", ph:"disktype=ssd", when:o=>o.action==="label"},
  {k:"overwrite", t:"bool", l:"--overwrite", when:o=>o.action==="label"},
  {k:"ignoreDS", t:"bool", l:"--ignore-daemonsets", when:o=>o.action==="drain"},
  {k:"emptyDir", t:"bool", l:"--delete-emptydir-data", when:o=>o.action==="drain"},
  {k:"force", t:"bool", l:"--force", when:o=>o.action==="drain"},
  {k:"timeout", t:"text", l:"--timeout", ph:"5m", half:true, when:o=>o.action==="drain"}
 ],
 build(o){
  const a = o.action || "taint";
  const byLabel = o.selector && (a === "taint" || a === "untaint" || a === "label");
  const tgt = byLabel ? " -l " + o.selector : " " + (o.name || "NODE");
  const eff = o.effect === undefined ? "NoSchedule" : o.effect;
  const key = o.key || "dedicated";
  let c = "";
  const f = [], r = [];

  if (a === "taint"){
    c = "kubectl taint nodes" + ctxF() + tgt + " " + key + (o.value ? "=" + o.value : "") + ":" + (eff || "NoSchedule");
    f.push(["key=value:Effect", "Der Taint besteht aus Schlüssel, optionalem Wert und Effekt. Auf den Node darf nur noch, wer in seiner toleration genau dazu passt — der Taint ist die Absage des Nodes, die toleration die Erlaubnis des Pods.|A taint is a key, an optional value and an effect. Only pods whose toleration matches exactly may still land there — the taint is the node's refusal, the toleration the pod's permission."]);
    f.push(["nodeSelector", "Ein Taint hält andere fern, zieht aber niemanden an. Damit die gewünschten Pods auch tatsächlich hier landen, braucht es zusätzlich nodeSelector oder nodeAffinity auf ein Label des Nodes.|A taint keeps others away but attracts nobody. To get the intended pods to actually land here you also need a nodeSelector or nodeAffinity on one of the node's labels."]);
    if (eff === "NoExecute") r.push({lvl:"err", m:t("NoExecute wirft sofort alles hinaus, was bereits läuft und den Taint nicht toleriert — auch mitten im Betrieb. Für ein geplantes Räumen ist drain der richtige Befehl.|NoExecute immediately throws out everything already running that does not tolerate the taint — in the middle of operation too. For a planned evacuation, drain is the right command.")});
    else r.push({lvl:"warn", m:t("Ab jetzt kommt kein Pod ohne passende toleration mehr auf diesen Node. Bereits laufende bleiben unberührt.|From now on no pod without a matching toleration lands on this node. Those already running stay untouched.")});
    if (byLabel) r.push({lvl:"warn", m:t("Mit -l trifft es jeden passenden Node auf einmal. Vorher mit kubectl get nodes -l und demselben Filter prüfen.|With -l this hits every matching node at once. Check first with kubectl get nodes -l and the same filter.")});
  }

  if (a === "untaint"){
    c = "kubectl taint nodes" + ctxF() + tgt + " " + key + (eff ? ":" + eff : "") + "-";
    f.push(["-", "Das angehängte Minus entfernt. Vergisst man es, legt derselbe Befehl den Taint stattdessen an.|The trailing minus removes. Forget it and the same command adds the taint instead."]);
    if (!eff) f.push(["ohne Effekt|without an effect", "Entfernt alle Taints mit diesem Schlüssel, unabhängig vom Effekt.|Removes every taint with that key, whatever its effect."]);
  }

  if (a === "show"){
    c = "kubectl get nodes" + ctxF() +
        " -o custom-columns=NAME:.metadata.name,UNSCHEDULABLE:.spec.unschedulable,TAINTS:.spec.taints[*].key,VERSION:.status.nodeInfo.kubeletVersion";
    f.push(["custom-columns", "Gesperrte Nodes und gesetzte Taints in einer Tabelle. Bleibt ein Pod Pending, ohne dass Ressourcen fehlen, steht die Erklärung meistens hier.|Cordoned nodes and the taints in place, in one table. If a pod stays Pending without lacking resources, the explanation is usually here."]);
  }

  if (a === "cordon" || a === "uncordon"){
    c = "kubectl " + a + ctxF() + " " + (o.name || "NODE");
    if (a === "cordon"){
      f.push(["cordon", "Setzt unschedulable auf dem Node. Neue Pods kommen nicht mehr dazu.|Sets unschedulable on the node. No new pods are added."]);
      r.push({lvl:"warn", m:t("Laufende Pods bleiben, wo sie sind. Wer sie wirklich wegbekommen will, braucht drain.|Running pods stay where they are. To actually move them you need drain.")});
    } else f.push(["uncordon", "Nimmt die Sperre zurück. Taints bleiben davon unberührt — die müssen einzeln entfernt werden.|Lifts the block. Taints are unaffected and have to be removed separately."]);
  }

  if (a === "drain"){
    c = "kubectl drain" + ctxF() + " " + (o.name || "NODE");
    if (o.ignoreDS) c += " --ignore-daemonsets";
    if (o.emptyDir) c += " --delete-emptydir-data";
    if (o.force) c += " --force";
    if (o.timeout) c += " --timeout=" + o.timeout;
    f.push(["drain", "Sperrt den Node und verschiebt anschließend alle Pods. Das ist der Befehl vor jeder Wartung, nicht cordon allein.|Cordons the node and then moves every pod off it. This is the command before any maintenance, not cordon on its own."]);
    if (!o.ignoreDS) r.push({lvl:"warn", m:t("DaemonSet-Pods lassen sich nicht evakuieren — ohne --ignore-daemonsets bricht drain gleich zu Beginn ab.|DaemonSet pods cannot be evacuated — without --ignore-daemonsets, drain aborts right at the start.")});
    if (o.emptyDir) r.push({lvl:"warn", m:t("Der Inhalt aller emptyDir-Volumes auf diesem Node ist danach weg. Für Caches egal, für alles andere vorher prüfen.|The contents of every emptyDir volume on this node are gone afterwards. Irrelevant for caches, worth checking for anything else.")});
    if (o.force) r.push({lvl:"err", m:t("--force löscht auch Pods ohne Controller. Ein einzelner Pod wird nirgends neu angelegt — er ist danach schlicht weg.|--force also deletes pods without a controller. A single pod is not recreated anywhere — it is simply gone afterwards.")});
    r.push({lvl:"warn", m:t("Hier greift ein PodDisruptionBudget: Zu streng gesetzt, wartet drain endlos, statt Replicas gleichzeitig wegzunehmen.|This is where a PodDisruptionBudget applies: set too strictly, drain waits forever instead of taking replicas away at once.")});
  }

  if (a === "label"){
    c = "kubectl label nodes" + ctxF() + tgt + " " + (o.label || "disktype=ssd");
    if (o.overwrite) c += " --overwrite";
    f.push(["label", "Auf diese Labels zeigen nodeSelector und nodeAffinity in den Manifesten. Ein Taint hält fern, ein Label zieht an — für reservierte Nodes braucht es beides.|nodeSelector and nodeAffinity in your manifests point at these labels. A taint keeps away, a label attracts — reserved nodes need both."]);
    if (!o.overwrite) r.push({lvl:"warn", m:t("Ein bereits vorhandenes Label ändert sich nur mit --overwrite, sonst bricht der Befehl ab.|An existing label only changes with --overwrite, otherwise the command fails.")});
  }

  return {c:c, f:f, r:r};
 }},

{id:"label", l:"Beschriften|Labels", d:"Labels und Annotations an jeder Ressource|Labels and annotations on any resource",
 fields:[
  {k:"what", t:"select", l:"Art|Kind", structural:true,
   opts:[["","Label — danach lässt sich auswählen|Label — can be selected on"],
         ["annotate","Annotation — nur Beiwerk für Werkzeuge|Annotation — metadata for tools only"]]},
  {k:"kind", t:"select", l:"Typ|Type", opts:K_KINDS},
  {k:"name", t:"text", l:"Name", ph:"my-app", half:true},
  {k:"selector", t:"text", l:"…oder Label-Filter|…or label filter", ph:"app=my-app", half:true},
  {k:"ns", t:"text", l:"Namespace", ph:"default", half:true},
  {k:"allNs", t:"bool", l:"über alle Namespaces|across all namespaces"},
  {k:"pairs", t:"text", l:"Schlüssel=Wert|Key=value", ph:"tier=backend",
   hint:"Mehrere durch Leerzeichen getrennt.|Several separated by spaces."},
  {k:"remove", t:"bool", structural:true, l:"entfernen statt setzen|remove instead of set"},
  {k:"overwrite", t:"bool", l:"--overwrite", when:o=>!o.remove}
 ],
 build(o){
  const verb = o.what === "annotate" ? "annotate" : "label";
  const pairs = (o.pairs || "tier=backend").trim();
  let c = "kubectl " + verb + ctxF() + " " + (o.kind || "pods");
  if (o.selector) c += " -l " + o.selector; else c += " " + (o.name || "NAME");
  c += nsF(o);
  c += " " + (o.remove
    ? pairs.split(/\s+/).map(x => x.split("=")[0] + "-").join(" ")
    : pairs);
  if (o.overwrite && !o.remove) c += " --overwrite";

  const f = [], r = [];
  if (verb === "label") f.push(["label", "Labels sind zum Auswählen da: Services finden ihre Pods darüber, kubectl filtert damit, Dashboards gruppieren danach.|Labels exist to be selected on: services find their pods through them, kubectl filters by them, dashboards group by them."]);
  else f.push(["annotate", "Annotations wählt niemand aus. Sie tragen Beiwerk für Werkzeuge — cert-manager, Ingress-Controller, Deployment-Historie — und dürfen deutlich länger sein als ein Label.|Nobody selects on annotations. They carry metadata for tools — cert-manager, ingress controllers, rollout history — and may be considerably longer than a label."]);
  if (o.remove) f.push(["-", "Das angehängte Minus entfernt den Schlüssel. Ohne Minus wird gesetzt.|The trailing minus removes the key. Without it, the key is set."]);
  else if (o.overwrite) f.push(["--overwrite", "Nötig, sobald der Schlüssel schon existiert — sonst bricht der Befehl ab, statt still etwas zu überschreiben.|Required as soon as the key already exists — otherwise the command fails instead of quietly overwriting."]);

  if (verb === "label" && (o.kind === "deploy" || o.kind === "sts" || !o.kind))
    r.push({lvl:"warn", m:t("Das beschriftet das Objekt selbst, nicht seine Pods. Die Pod-Labels stehen in spec.template und ändern sich nur über das Manifest.|This labels the object itself, not its pods. Pod labels live in spec.template and only change through the manifest.")});
  if (verb === "label" && !o.remove)
    r.push({lvl:"warn", m:t("Ändert der Schlüssel ein Label, auf das ein Service-Selector zeigt, fällt die Ressource sofort aus dem Service — ohne Fehlermeldung, nur ohne Endpoints.|If the key changes a label a service selector points at, the resource drops out of the service immediately — no error, just no endpoints.")});
  if (o.selector)
    r.push({lvl:"warn", m:t("Mit -l trifft es alles, was passt. Dieselbe Auswahl vorher mit kubectl get prüfen.|With -l this hits everything that matches. Check the same selection with kubectl get first.")});
  if (o.remove && !o.selector && !o.name)
    r.push({lvl:"warn", m:t("Ohne Namen und ohne Filter fehlt das Ziel.|Without a name and without a filter there is no target.")});
  return {c:c, f:f, r:r};
 }},

{id:"delete", l:"Löschen|Delete", d:"Vorsichtig|Carefully",
 fields:[
  {k:"mode", t:"select", l:"Wonach|By what", structural:true,
   opts:[["file","Datei — genau das, was drinsteht|file — exactly what it contains"],
         ["name","Name|name"],["selector","Label|label"]]},
  {k:"file", t:"text", l:"Datei|File", ph:"manifest.yaml", when:o=>!o.mode||o.mode==="file"},
  {k:"kind", t:"select", l:"Typ|Type", opts:K_KINDS, when:o=>o.mode==="name"||o.mode==="selector"},
  {k:"name", t:"text", l:"Name", ph:"my-app", when:o=>o.mode==="name"},
  {k:"selector", t:"text", l:"Label-Filter|Label filter", ph:"app=my-app", when:o=>o.mode==="selector"},
  {k:"ns", t:"text", l:"Namespace", ph:"default", half:true},
  {k:"force", t:"bool", l:"erzwingen (--force --grace-period=0)|force (--force --grace-period=0)"},
  {k:"wait", t:"bool", l:"nicht warten (--wait=false)|do not wait (--wait=false)"}
 ],
 build(o){
  const mode = o.mode || "file";
  let c = "kubectl delete" + ctxF();
  if (mode === "file") c += " -f " + (o.file || "manifest.yaml");
  if (mode === "name") c += " " + (o.kind || "pods") + " " + (o.name || "NAME");
  if (mode === "selector") c += " " + (o.kind || "pods") + " -l " + (o.selector || "app=my-app");
  c += nsF(o);
  const f = [], r = [];
  if (o.force){ c += " --force --grace-period=0";
    f.push(["--force --grace-period=0", "Entfernt den Eintrag sofort aus der API, ohne auf das Herunterfahren zu warten.|Removes the entry from the API at once without waiting for shutdown."]);
    r.push({lvl:"err", m:t("Der Container läuft unter Umständen weiter, während Kubernetes ihn für beendet hält. Bei StatefulSets mit Volume kann das zu zwei Schreibern auf denselben Daten führen. Nur einsetzen, wenn ein Pod wirklich hängt.|The container may keep running while Kubernetes considers it gone. With StatefulSets on a volume that can produce two writers on the same data. Use only when a pod is genuinely stuck.")});
  }
  if (o.wait) c += " --wait=false";
  if (mode === "selector") r.push({lvl:"warn", m:t("Prüfe die Auswahl vorher mit kubectl get und demselben -l. Gelöscht wird alles, was passt.|Check the selection first with kubectl get and the same -l. Everything that matches gets deleted.")});
  if (!o.ns && !o.allNs) r.push({lvl:"warn", m:t("Ohne -n gilt der Standard-Namespace des aktuellen Kontexts — nicht unbedingt der, den du meinst.|Without -n the current context's default namespace applies — not necessarily the one you mean.")});
  if (!CMD.ctx) r.push({lvl:"warn", m:t("Vor einem Löschen lohnt sich kubectl config current-context.|Before deleting, kubectl config current-context is worth a moment.")});
  return {c:c, f:f, r:r};
 }},

{id:"top", l:"Verbrauch|Usage", d:"Grundlage für requests und limits|The basis for requests and limits",
 fields:[
  {k:"what", t:"select", l:"Was|What", opts:[["pod","pod"],["node","node"]], structural:true},
  {k:"ns", t:"text", l:"Namespace", ph:"default", half:true, when:o=>o.what!=="node"},
  {k:"selector", t:"text", l:"Label-Filter|Label filter", ph:"app=my-app", when:o=>o.what!=="node"},
  {k:"containers", t:"bool", l:"je Container aufschlüsseln|break down per container", when:o=>o.what!=="node"}
 ],
 build(o){
  const what = o.what || "pod";
  let c = "kubectl top " + what + ctxF();
  if (what !== "node"){
    if (o.selector) c += " -l " + o.selector;
    if (o.containers) c += " --containers";
    c += nsF(o);
  }
  return {c:c, f:[["top", "Zeigt den tatsächlichen Verbrauch. Braucht den metrics-server im Cluster, sonst kommt nur eine Fehlermeldung.|Shows actual usage. Requires metrics-server in the cluster, otherwise you only get an error."]],
    r:[{lvl:"warn", m:t("Ein Momentwert, kein Mittel über die Zeit. Für requests und limits über mehrere Tage beobachten oder ins Monitoring schauen.|A snapshot, not an average over time. For requests and limits observe over several days or look at your monitoring.")}]};
 }},

{id:"storage", l:"Speicher|Storage", d:"PVCs, PVs und StorageClasses|PVCs, PVs and storage classes",
 fields:[
  {k:"action", t:"select", l:"Aktion|Action", structural:true,
   opts:[["pvc","PVCs auflisten|list PVCs"],
         ["describe","PVC untersuchen|inspect a PVC"],
         ["mounted","Wer benutzt welches PVC|which pod uses which PVC"],
         ["pv","PVs mit Reclaim-Policy|PVs with their reclaim policy"],
         ["sc","StorageClasses und Expansion|storage classes and expansion"],
         ["resize","PVC vergrößern|grow a PVC"]]},
  {k:"name", t:"text", l:"PVC-Name|PVC name", ph:"data", half:true,
   when:o=>o.action==="describe"||o.action==="resize"},
  {k:"size", t:"text", l:"Neue Größe|New size", ph:"50Gi", half:true, when:o=>o.action==="resize"},
  {k:"ns", t:"text", l:"Namespace", ph:"default", half:true, when:o=>o.action!=="pv"&&o.action!=="sc"},
  {k:"allNs", t:"bool", l:"über alle Namespaces|across all namespaces", when:o=>o.action==="pvc"}
 ],
 build(o){
  const a = o.action || "pvc";
  let c = "", f = [], r = [];
  if (a === "pvc"){
    c = "kubectl get pvc" + ctxF() + nsF(o) +
        " -o custom-columns=NAME:.metadata.name,STATUS:.status.phase,SIZE:.status.capacity.storage,CLASS:.spec.storageClassName,MODE:.spec.accessModes";
    f.push(["custom-columns", "Zeigt Status, tatsächliche Größe, Klasse und Zugriffsmodus in einer Zeile. Steht dort Pending, verrät describe den Grund.|Shows status, actual size, class and access mode in one row. If it says Pending, describe reveals why."]);
  }
  if (a === "describe"){
    c = "kubectl describe pvc " + (o.name || "NAME") + ctxF() + nsF(o);
    f.push(["describe", "Unten stehen Events und Used By — also welche Pods das Volume gerade halten. Bei Pending steht dort auch, warum kein PV zugewiesen wurde.|At the bottom you find Events and Used By — which pods currently hold the volume. If it is Pending, the reason no PV was bound appears there too."]);
  }
  if (a === "mounted"){
    c = "kubectl get pods" + ctxF() + nsF(o) +
        " -o custom-columns=POD:.metadata.name,NODE:.spec.nodeName,CLAIMS:.spec.volumes[*].persistentVolumeClaim.claimName";
    f.push(["NODE", "Die Node-Spalte ist der Punkt: Bei ReadWriteOnce müssen alle Pods auf demselben Volume auch auf demselben Node liegen.|The node column is the point: with ReadWriteOnce every pod on the same volume has to sit on the same node."]);
  }
  if (a === "pv"){
    c = "kubectl get pv" + ctxF() +
        " -o custom-columns=NAME:.metadata.name,CLAIM:.spec.claimRef.name,POLICY:.spec.persistentVolumeReclaimPolicy,STATUS:.status.phase";
    f.push(["POLICY", "Delete heißt: Beim Löschen des PVC verschwinden die Daten. Retain heißt: Das PV bleibt liegen und muss von Hand aufgeräumt werden.|Delete means the data disappears when the PVC goes. Retain means the PV stays behind and needs cleaning up by hand."]);
    r.push({lvl:"warn", m:t("PVs sind clusterweit, nicht auf einen Namespace beschränkt — die Liste zeigt fremde Volumes mit.|PVs are cluster-wide, not scoped to a namespace — the list includes other people's volumes.")});
  }
  if (a === "sc"){
    c = "kubectl get storageclass" + ctxF() +
        " -o custom-columns=NAME:.metadata.name,PROVISIONER:.provisioner,EXPANSION:.allowVolumeExpansion,RECLAIM:.reclaimPolicy";
    f.push(["EXPANSION", "Steht hier nicht true, lässt sich ein PVC dieser Klasse nicht vergrößern — auch nicht mit Gewalt.|If this is not true, a PVC of that class cannot be grown — not by any means."]);
  }
  if (a === "resize"){
    c = "kubectl patch pvc " + (o.name || "NAME") + ctxF() + nsF(o) +
        " -p '{\"spec\":{\"resources\":{\"requests\":{\"storage\":\"" + (o.size || "50Gi") + "\"}}}}'";
    f.push(["patch", "Ändert nur das eine Feld. Ein apply mit der alten Datei würde die Größe wieder zurücksetzen.|Changes only that one field. An apply with the old file would set the size back."]);
    r.push({lvl:"warn", m:t("Setzt allowVolumeExpansion: true auf der StorageClass voraus. Verkleinern ist grundsätzlich nicht möglich.|Requires allowVolumeExpansion: true on the storage class. Shrinking is fundamentally impossible.")});
    r.push({lvl:"warn", m:t("Bei vielen Treibern wächst das Dateisystem erst beim nächsten Pod-Neustart. Steht das PVC auf FileSystemResizePending, ist genau das der Grund.|With many drivers the filesystem only grows on the next pod restart. If the PVC sits at FileSystemResizePending, that is exactly why.")});
    r.push({lvl:"err", m:t("Bei einem StatefulSet reicht das nicht: Das volumeClaimTemplate bleibt unverändert, jedes PVC muss einzeln gepatcht und das StatefulSet mit --cascade=orphan neu angelegt werden.|With a StatefulSet this is not enough: the volumeClaimTemplate stays unchanged, every PVC has to be patched individually and the StatefulSet recreated with --cascade=orphan.")});
  }
  return {c:c, f:f, r:r};
 }},

{id:"ctx", l:"Kontext|Context", d:"In welchem Cluster bin ich eigentlich?|Which cluster am I actually in?",
 fields:[
  {k:"action", t:"select", l:"Aktion|Action", structural:true,
   opts:[["current","aktuellen Kontext zeigen|show the current context"],
         ["list","alle Kontexte auflisten|list all contexts"],
         ["use","Kontext wechseln|switch context"],
         ["ns","Standard-Namespace setzen|set the default namespace"]]},
  {k:"name", t:"text", l:"Kontext|Context", ph:"prod-cluster", when:o=>o.action==="use"},
  {k:"ns", t:"text", l:"Namespace", ph:"prod", when:o=>o.action==="ns"}
 ],
 build(o){
  const a = o.action || "current";
  let c = "kubectl config ";
  if (a === "current") c += "current-context";
  if (a === "list") c += "get-contexts";
  if (a === "use") c += "use-context " + (o.name || "NAME");
  if (a === "ns") c += "set-context --current --namespace=" + (o.ns || "default");
  return {c:c, f:[["config", "Wirkt auf deine lokale kubeconfig, nicht auf den Cluster. Der Wechsel gilt für jede weitere Sitzung, bis du ihn zurücknimmst.|Affects your local kubeconfig, not the cluster. The switch persists across sessions until you change it back."]], r:[]};
 }}
];

function cmdTask(){ return CMDTASKS.filter(x => x.id === CMD.task)[0] || CMDTASKS[0]; }

function renderCmdTasks(){
  $("cmdTasks").innerHTML = CMDTASKS.map(x =>
    '<button class="ctask" data-task="' + x.id + '" aria-pressed="' + (x.id === CMD.task) + '">' +
    esc(t(x.l)) + "</button>").join("");
}

function renderCmdFields(){
  const task = cmdTask(), o = CMD.o;
  let h = '<div class="f"><label for="cmdCtx">--context</label>' +
    '<input type="text" id="cmdCtx" value="' + esc(CMD.ctx) + '" placeholder="' +
    esc(LANG === "de" ? "leer = aktiver Cluster" : "empty = active cluster") + '">' +
    '<span class="hint">' + esc(LANG === "de"
      ? "Ausdrücklich genannt kann kein Befehl im falschen Cluster landen."
      : "Named explicitly, no command can end up in the wrong cluster.") + "</span></div>";
  task.fields.filter(f => !f.when || f.when(o)).forEach(f => {
    const v = o[f.k] === undefined ? "" : o[f.k];
    const cls = f.half ? "f f--in" : "f";
    const hint = f.hint ? '<span class="hint">' + esc(t(f.hint)) + "</span>" : "";
    if (f.t === "bool"){
      h += '<div class="f"><label class="check"><input type="checkbox" data-ck="' + f.k + '"' +
        (v ? " checked" : "") + "><span>" + esc(t(f.l)) + "</span></label>" + hint + "</div>";
    } else if (f.t === "select"){
      h += '<div class="' + cls + '"><label>' + esc(t(f.l)) + '</label><select data-ck="' + f.k + '"' +
        (f.structural ? ' data-cstruct="1"' : "") + ">";
      f.opts.forEach(op => { h += '<option value="' + esc(op[0]) + '"' +
        (String(v) === op[0] ? " selected" : "") + ">" + esc(t(op[1])) + "</option>"; });
      h += "</select>" + hint + "</div>";
    } else {
      h += '<div class="' + cls + '"><label>' + esc(t(f.l)) + '</label><input type="text" data-ck="' + f.k +
        '" value="' + esc(v) + '" placeholder="' + esc(f.ph ? t(f.ph) : "") + '">' + hint + "</div>";
    }
  });
  $("cmdFields").innerHTML = h;
}

function renderCmdOut(){
  const res = cmdTask().build(CMD.o);
  let h = '<button class="cmd cmd--big" data-cmd="' + esc(res.c) + '"><span>' +
          esc(res.c) + "</span></button>";
  if (res.r.length)
    h += '<div class="crisks">' + res.r.map(x =>
      '<p class="crisk crisk--' + x.lvl + '"><b>' + (x.lvl === "err" ? "!" : "?") + "</b>" +
      esc(x.m) + "</p>").join("") + "</div>";
  if (res.f.length)
    h += '<div class="cflags">' + res.f.map(x =>
      '<p><code>' + esc(x[0]) + "</code>" + esc(typeof x[1] === "string" ? t(x[1]) : x[1]) + "</p>").join("") + "</div>";
  $("cmdOut").innerHTML = h;
}

function renderCmdAll(){ renderCmdTasks(); renderCmdFields(); renderCmdOut(); }

$("cmdTasks").addEventListener("click", e => {
  const b = e.target.closest("button[data-task]");
  if (!b) return;
  CMD.task = b.dataset.task;
  CMD.o = defaultsForCmd();
  renderCmdAll();
});

function defaultsForCmd(){
  const docs = currentDocs();
  const app = docs.filter(x => x.kind === "Deployment")[0] || docs.filter(x => x.kind === "Pod")[0];
  const o = {
    name: app ? app.metadata.name : "",
    ns: app && app.metadata.namespace ? app.metadata.namespace : "",
    selector: "",
    tail: "100", follow: true
  };
  /* Ein einzelner Pod ist kein deploy/… — nur dort umstellen, wo die Aufgabe pod überhaupt anbietet. */
  const tf = cmdTask().fields.filter(f => f.k === "targetKind")[0];
  if (app && app.kind === "Pod" && tf && tf.opts.some(x => x[0] === "pod")) o.targetKind = "pod";
  return o;
}

$("cmdFields").addEventListener("input", e => {
  const el = e.target;
  if (el.id === "cmdCtx"){ CMD.ctx = el.value.trim(); renderCmdOut(); return; }
  if (!el.dataset.ck) return;
  CMD.o[el.dataset.ck] = el.type === "checkbox" ? el.checked : el.value;
  renderCmdOut();
});
$("cmdFields").addEventListener("change", e => {
  const el = e.target;
  if (!el.dataset.ck) return;
  CMD.o[el.dataset.ck] = el.type === "checkbox" ? el.checked : el.value;
  if (el.dataset.cstruct || el.type === "checkbox") renderCmdFields();
  renderCmdOut();
});
$("cmdOut").addEventListener("click", e => {
  const b = e.target.closest("button[data-cmd]");
  if (!b) return;
  copyText(b.dataset.cmd);
  const s = b.querySelector("span"), old = s.textContent;
  s.textContent = t(UI.copied);
  setTimeout(()=>{ s.textContent = old; }, 1000);
});

let WIKI_TAB = "ref";
const WIKI_TABS = {ref:"tabRef", build:"tabBuild", storage:"tabStorage", cheat:"tabCheat"};
function setWikiTab(tab){
  WIKI_TAB = tab;
  Object.keys(WIKI_TABS).forEach(x => $(WIKI_TABS[x]).setAttribute("aria-pressed", tab === x));
  $("wikiList").hidden = tab !== "ref";
  $("cmdBuild").hidden = tab !== "build";
  $("storageWiki").hidden = tab !== "storage";
  $("cheatWiki").hidden = tab !== "cheat";
  $("wikiFilter").hidden = tab !== "ref";
  $("cheatPrint").hidden = tab !== "cheat";
  const de = LANG === "de";
  $("wikiDesc").textContent =
    tab === "ref" ? (de ? "Namen und Namespace sind aus dem aktuellen Manifest eingesetzt. Klick kopiert den Befehl."
                        : "Names and namespace are filled in from the current manifest. Click copies the command.")
  : tab === "build" ? (de ? "Aufgabe wählen, Felder ausfüllen — der Befehl entsteht mit. Darunter steht, was jedes Flag bewirkt."
                          : "Pick a task, fill in the fields — the command assembles as you go. Below it you see what each flag does.")
  : tab === "cheat" ? (de ? "Zum Nachschlagen und zum Danebenlegen: Ports, Mengenangaben, Statusmeldungen, YAML-Fallen. Drucken legt nur diese Seite aufs Papier."
                          : "For looking up and pinning next to your screen: ports, quantities, status messages, YAML traps. Print puts this page alone on paper.")
  : (de ? "Wie dauerhafter Speicher in Kubernetes zusammenhängt — und woran er in der Praxis scheitert."
        : "How persistent storage fits together in Kubernetes — and where it fails in practice.");
  if (tab === "build"){ if (!Object.keys(CMD.o).length) CMD.o = defaultsForCmd(); renderCmdAll(); }
  else if (tab === "storage") renderStorageWiki();
  else if (tab === "cheat") renderCheatsheet();
  else renderWiki();
}
$("tabRef").addEventListener("click", () => setWikiTab("ref"));
$("tabBuild").addEventListener("click", () => setWikiTab("build"));
$("tabStorage").addEventListener("click", () => setWikiTab("storage"));
$("tabCheat").addEventListener("click", () => setWikiTab("cheat"));
$("cheatPrint").addEventListener("click", () => {
  if (WIKI_TAB !== "cheat") setWikiTab("cheat");
  window.print();
});


const STORAGE_WIKI = [
{h:"Die Kette|The chain",
 p:["Vier Dinge hängen hintereinander, und nur zwei davon schreibst du selbst. Die **StorageClass** legt der Cluster-Betreiber an; sie beschreibt eine Art Speicher — schnelle lokale SSD, Netzwerkspeicher, mit Snapshots oder ohne. Das **PersistentVolumeClaim** ist deine Anforderung: so viel Platz, dieser Zugriffsmodus, diese Klasse. Daraufhin entsteht automatisch ein **PersistentVolume**, das konkrete Stück Speicher. Der **volumeMount** im Pod hängt es an einen Pfad im Container.|Four things sit in a chain and you only write two of them yourself. The **StorageClass** is created by whoever runs the cluster; it describes a kind of storage — fast local SSD, network storage, with or without snapshots. The **PersistentVolumeClaim** is your request: this much space, this access mode, this class. A **PersistentVolume** then appears automatically, the concrete piece of storage. The **volumeMount** in the pod attaches it to a path in the container.",
     "Du schreibst also PVC und volumeMount. PV und StorageClass begegnen dir vor allem, wenn etwas nicht funktioniert.|So you write the PVC and the volumeMount. PV and StorageClass mostly show up when something is broken."],
 code:"StorageClass  →  PVC  →  PV  →  volumeMount\n(Betreiber)      (du)     (auto)   (du)"},

{h:"Zugriffsmodi|Access modes",
 p:["Der Zugriffsmodus ist die Angabe, an der die meisten Überraschungen hängen — und er beschreibt **Nodes, nicht Pods**.|The access mode is where most surprises hide — and it describes **nodes, not pods**."],
 table:[["Modus|Mode","Bedeutung|Meaning","Verfügbarkeit|Availability"],
   ["ReadWriteOnce","Ein Node darf lesen und schreiben. Mehrere Pods auf **demselben** Node dürfen es gemeinsam nutzen.|One node may read and write. Several pods on the **same** node may share it.","Überall|Everywhere"],
   ["ReadWriteOncePod","Genau ein Pod, auch wenn mehrere auf demselben Node liegen.|Exactly one pod, even if several sit on the same node.","Neuere Cluster|Newer clusters"],
   ["ReadOnlyMany","Viele Nodes lesen, keiner schreibt.|Many nodes read, none writes.","Häufig|Common"],
   ["ReadWriteMany","Viele Nodes schreiben gleichzeitig.|Many nodes write simultaneously.","Nur mit NFS, CephFS und ähnlichem|Only with NFS, CephFS and similar"]],
 p2:["ReadWriteMany klingt nach der bequemen Lösung und ist es selten: Blockspeicher — EBS, Azure Disk, GCE PD, die meisten lokalen Provisioner — kann es grundsätzlich nicht. Fordert man es dort an, bleibt das PVC für immer im Zustand Pending, ohne dass irgendwo eine deutliche Fehlermeldung erscheint.|ReadWriteMany sounds like the convenient answer and rarely is: block storage — EBS, Azure Disk, GCE PD, most local provisioners — fundamentally cannot do it. Request it there and the PVC stays Pending forever without any clear error appearing anywhere."]},

{h:"Die ReadWriteOnce-Falle|The ReadWriteOnce trap",
 p:["Ein Deployment mit einem PVC und zwei Replicas sieht völlig harmlos aus und funktioniert, solange beide Pods zufällig auf demselben Node landen. Verteilt der Scheduler sie, bleibt der zweite in ContainerCreating stehen, und im Event steht *Multi-Attach error for volume*.|A Deployment with one PVC and two replicas looks entirely harmless and works as long as both pods happen to land on the same node. Once the scheduler spreads them, the second one stays in ContainerCreating and the event reads *Multi-Attach error for volume*.",
     "Noch unangenehmer: Es kann monatelang gutgehen und dann bei einem Node-Neustart plötzlich nicht mehr. Der Wizard meldet diese Kombination deshalb als Fehler, nicht als Warnung.|Worse still: it can go fine for months and then suddenly not, after a node reboot. That is why the wizard reports this combination as an error, not a warning."]},

{h:"Deployment oder StatefulSet|Deployment or StatefulSet",
 p:["Die Entscheidung hängt an einer einzigen Frage: Sind die Pods austauschbar?|The decision hangs on a single question: are the pods interchangeable?"],
 table:[["","Deployment","StatefulSet"],
   ["Pod-Namen|Pod names","zufälliges Suffix|random suffix","name-0, name-1, name-2"],
   ["Volume","ein PVC für alle|one PVC for all","eines je Pod|one per pod"],
   ["Start und Update|Start and update","gleichzeitig|simultaneous","der Reihe nach|in order"],
   ["DNS je Pod|DNS per pod","nein|no","ja, über headless Service|yes, via headless service"],
   ["Passend für|Fits","Webanwendungen, APIs, Worker|web apps, APIs, workers","Datenbanken, Queues, Etcd|databases, queues, etcd"]],
 p2:["Beim StatefulSet ist ReadWriteOnce genau richtig, weil jeder Pod sein eigenes Volume bekommt. Der Preis: `serviceName` muss auf einen headless Service zeigen, und die `volumeClaimTemplates` sind unveränderlich. Eine andere Größe oder StorageClass bedeutet, das StatefulSet zu löschen und neu anzulegen — die PVCs überleben das.|With a StatefulSet, ReadWriteOnce is exactly right because every pod gets its own volume. The price: `serviceName` has to point at a headless service, and the `volumeClaimTemplates` are immutable. A different size or storage class means deleting and recreating the StatefulSet — the PVCs survive that."]},

{h:"Wenn es kein PVC sein muss|When it need not be a PVC",
 p:["Nicht jeder Schreibzugriff braucht dauerhaften Speicher. Ein **emptyDir** entsteht mit dem Pod und verschwindet mit ihm — für Zwischendateien, Caches oder als beschreibbares `/tmp`, wenn `readOnlyRootFilesystem` gesetzt ist. Mit `sizeLimit` verhindert man, dass es den Node volläuft.|Not every write needs durable storage. An **emptyDir** appears with the pod and vanishes with it — for scratch files, caches or as a writable `/tmp` when `readOnlyRootFilesystem` is set. A `sizeLimit` keeps it from filling the node.",
     "**ConfigMaps und Secrets** lassen sich ebenfalls als Volume einhängen. Standardmäßig wird das gesamte Verzeichnis überlagert — was im Image an dieser Stelle lag, ist danach verdeckt. Mit `subPath` hängt man stattdessen einen einzelnen Schlüssel als einzelne Datei ein. Der Unterschied: Dateien über `subPath` aktualisieren sich **nicht**, wenn sich die ConfigMap ändert.|**ConfigMaps and Secrets** can be mounted as volumes too. By default the whole directory is overlaid — whatever the image had at that path is hidden afterwards. With `subPath` you mount a single key as a single file instead. The difference: files mounted via `subPath` do **not** update when the ConfigMap changes."],
 p2:["**hostPath** greift auf das Dateisystem des Nodes zu. Es umgeht sämtliche Isolation, bindet den Pod an einen einzelnen Node und wird von Pod Security Standards zu Recht blockiert. Für Produktion praktisch nie die Antwort.|**hostPath** reaches into the node's filesystem. It bypasses all isolation, pins the pod to one node and is rightly blocked by Pod Security Standards. For production, almost never the answer."]},

{h:"Vergrößern|Growing a volume",
 p:["Ein PVC lässt sich vergrößern, wenn die StorageClass `allowVolumeExpansion: true` gesetzt hat. Verkleinern geht nie — bei keiner StorageClass, in keiner Kubernetes-Version.|A PVC can be grown if its storage class has `allowVolumeExpansion: true`. Shrinking never works — with no storage class, in no Kubernetes version."],
 code:"kubectl get sc STORAGECLASS -o jsonpath='{.allowVolumeExpansion}'\nkubectl patch pvc NAME -n NS -p '{\"spec\":{\"resources\":{\"requests\":{\"storage\":\"50Gi\"}}}}'",
 p2:["Danach steht das PVC unter Umständen auf `FileSystemResizePending`. Bei vielen Treibern wächst das Dateisystem erst, wenn der Pod neu startet. Beim StatefulSet ist es umständlicher: Das Template ist unveränderlich, du musst die PVCs einzeln patchen und das StatefulSet mit `--cascade=orphan` löschen und neu anlegen.|Afterwards the PVC may sit at `FileSystemResizePending`. With many drivers the filesystem only grows once the pod restarts. With a StatefulSet it is more awkward: the template is immutable, so you patch the PVCs individually and delete and recreate the StatefulSet with `--cascade=orphan`."]},

{h:"Was beim Löschen passiert|What happens on delete",
 p:["Ob die Daten ein `kubectl delete` überleben, entscheidet die `reclaimPolicy` des PV, und die kommt aus der StorageClass. Bei `Delete` — dem Standard der meisten Cloud-Klassen — verschwindet mit dem PVC auch das Volume und sein Inhalt. Bei `Retain` bleibt das PV liegen und muss von Hand aufgeräumt werden.|Whether the data survives a `kubectl delete` is decided by the PV's `reclaimPolicy`, which comes from the storage class. With `Delete` — the default for most cloud classes — the volume and its contents disappear along with the PVC. With `Retain` the PV stays behind and has to be cleaned up by hand.",
     "PVCs eines StatefulSet werden beim Löschen des StatefulSet **nicht** mitgelöscht. Das ist der Standard und meistens gewollt. Wer es ausdrücklich haben will, setzt `persistentVolumeClaimRetentionPolicy`.|The PVCs of a StatefulSet are **not** deleted when the StatefulSet is. That is the default and usually what you want. If you want it stated explicitly, set `persistentVolumeClaimRetentionPolicy`."],
 code:"kubectl get pv -o custom-columns=NAME:.metadata.name,CLAIM:.spec.claimRef.name,POLICY:.spec.persistentVolumeReclaimPolicy"},

{h:"Snapshot ist kein Backup|A snapshot is not a backup",
 p:["Ein VolumeSnapshot liegt beim gleichen Anbieter, oft im gleichen Rechenzentrum, und hängt an derselben StorageClass. Gegen ein versehentliches `DROP TABLE` hilft er, gegen einen Ausfall der Region oder ein gelöschtes Konto nicht.|A VolumeSnapshot lives with the same provider, often in the same data centre, and hangs off the same storage class. It helps against an accidental `DROP TABLE`, not against a region outage or a deleted account.",
     "Für Datenbanken ist ein Snapshot des Volumes ohnehin heikel, weil er den Zustand mitten im Schreibvorgang festhält. Ein `pg_dump` oder `mysqldump` in einen CronJob, der das Ergebnis irgendwo anders ablegt, ist meist die verlässlichere Antwort.|For databases a volume snapshot is dubious anyway because it captures state mid-write. A `pg_dump` or `mysqldump` in a CronJob that puts the result somewhere else entirely is usually the more reliable answer."]},

{h:"Häufige Fehlerbilder|Common failure modes",
 table:[["Symptom|Symptom","Meist die Ursache|Usually the cause"],
   ["PVC bleibt Pending|PVC stays Pending","StorageClass existiert nicht, ist nicht Standard, oder der Zugriffsmodus wird nicht unterstützt. `kubectl describe pvc` sagt es.|The storage class does not exist, is not the default, or the access mode is unsupported. `kubectl describe pvc` says so."],
   ["Multi-Attach error","Zweite Replica auf einem ReadWriteOnce-Volume.|A second replica on a ReadWriteOnce volume."],
   ["volume node affinity conflict","Das Volume liegt in einer anderen Zone als der Node, auf dem der Pod laufen soll.|The volume sits in a different zone than the node the pod should run on."],
   ["Permission denied im Container|Permission denied in the container","Das Volume gehört root, der Container läuft als anderer Benutzer. `fsGroup` im securityContext des Pods setzen.|The volume belongs to root while the container runs as another user. Set `fsGroup` in the pod's securityContext."],
   ["read-only file system","`readOnlyRootFilesystem` ist gesetzt und der Pfad hat kein beschreibbares Volume.|`readOnlyRootFilesystem` is set and the path has no writable volume."],
   ["Daten nach Neustart weg|Data gone after a restart","emptyDir statt PVC, oder der Pfad liegt neben dem mountPath.|emptyDir instead of a PVC, or the path sits beside the mountPath."]]}
];

function mdInline(x){
  return esc(x).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
               .replace(/`(.+?)`/g, "<code>$1</code>");
}

/* Gemeinsame Darstellung für Speicher-Wiki und Spickzettel. */
function sectionsHtml(list){
  let h = "";
  list.forEach(sec => {
    /* Breite Tabellen bekommen im Spickzettel die volle Spaltenbreite. */
    const wide = (sec.table && sec.table[0].length >= 3) || (sec.code && !sec.table);
    h += '<div class="swsec' + (wide ? " swsec--wide" : "") + '"><p class="hgroup">' + esc(t(sec.h)) + "</p>";
    (sec.p || []).forEach(x => { h += "<p>" + mdInline(t(x)) + "</p>"; });
    if (sec.code) h += '<pre class="swcode">' + esc(t(sec.code)) + "</pre>";
    if (sec.table){
      const rows = sec.table;
      h += '<div class="swtwrap"><table class="swtable"><thead><tr>' +
           rows[0].map(c => "<th>" + mdInline(t(c)) + "</th>").join("") +
           "</tr></thead><tbody>" +
           rows.slice(1).map(r => "<tr>" + r.map((c, i) =>
             "<td" + (i === 0 ? ' class="swkey"' : "") + ">" + mdInline(t(c)) + "</td>").join("") + "</tr>").join("") +
           "</tbody></table></div>";
    }
    (sec.p2 || []).forEach(x => { h += "<p>" + mdInline(t(x)) + "</p>"; });
    h += "</div>";
  });
  return h;
}

function renderStorageWiki(){
  $("storageWiki").innerHTML = sectionsHtml(STORAGE_WIKI);
}

/* Spickzettel: dicht, zum Nachschlagen und zum Ausdrucken. Keine Prosa. */
const CHEATSHEET = [
{h:"Welcher Port ist welcher|Which port is which",
 table:[["Feld|Field","Wo|Where","Bedeutung|Meaning"],
   ["containerPort","Pod","Reine Dokumentation. Der Prozess lauscht auch ohne diese Angabe.|Documentation only. The process listens with or without it."],
   ["port","Service","Unter diesem Port ist der Service im Cluster erreichbar.|The port the service itself is reachable on inside the cluster."],
   ["targetPort","Service","Zielport im Container. Darf eine Zahl oder ein Portname sein.|Target port in the container. May be a number or a port name."],
   ["nodePort","Service","Nur bei type NodePort. Standardbereich 30000–32767.|Only with type NodePort. Default range 30000–32767."],
   ["backend…port.number","Ingress","Der Port des **Service**, nicht der des Containers.|The **service** port, not the container port."],
   ["probe port","Pod","Muss zu einem containerPort passen, sonst prüft die Probe ins Leere.|Has to match a containerPort, otherwise the probe checks nothing."]]},

{h:"Mengenangaben|Quantities",
 table:[["Schreibweise|Notation","Wert|Value","Anmerkung|Note"],
   ["1 / 1000m","1 CPU-Kern|1 CPU core","m heißt Milli. 500m ist ein halber Kern.|m means milli. 500m is half a core."],
   ["Mi Gi Ti","1024er-Schritte|powers of 1024","Für Speicher der Normalfall.|The usual choice for memory."],
   ["M G T","1000er-Schritte|powers of 1000","512M ist kleiner als 512Mi.|512M is smaller than 512Mi."],
   ["MB GB","ungültig|invalid","Kubernetes kennt kein MB. Der Apply schlägt fehl.|Kubernetes has no MB. The apply fails."]],
 p2:["`requests` reserviert der Scheduler, `limits` ist die harte Grenze. CPU über dem Limit wird gedrosselt, Speicher über dem Limit wird **OOMKilled**.|`requests` is what the scheduler reserves, `limits` is the hard ceiling. CPU above the limit gets throttled, memory above the limit gets **OOMKilled**."]},

{h:"Status und was dahintersteckt|Status and what is behind it",
 table:[["Status|Status","Meist die Ursache|Usually the cause"],
   ["Pending","Kein Node hat genug frei, oder das PVC ist nicht gebunden, oder nodeSelector passt nirgends.|No node has enough free, or the PVC is unbound, or the nodeSelector matches nothing."],
   ["ContainerCreating","Volume hängt noch — bei `Multi-Attach` zweite Replica auf ReadWriteOnce.|Volume still attaching — with `Multi-Attach` it is a second replica on ReadWriteOnce."],
   ["ImagePullBackOff","Tag existiert nicht, oder die Registry verlangt Anmeldung: imagePullSecrets fehlt.|The tag does not exist, or the registry wants credentials: imagePullSecrets missing."],
   ["CreateContainerConfigError","Eine ConfigMap oder ein Secret aus envFrom oder volumes gibt es nicht.|A ConfigMap or Secret referenced by envFrom or volumes does not exist."],
   ["CrashLoopBackOff","Prozess endet sofort. `logs --previous` zeigt warum.|The process exits immediately. `logs --previous` says why."],
   ["OOMKilled","limits.memory überschritten. Kein Drosseln, sofortiges Ende.|limits.memory exceeded. No throttling, immediate kill."],
   ["Running 0/1","Container läuft, readinessProbe schlägt fehl — kein Traffic.|The container runs but the readiness probe fails — no traffic."],
   ["Evicted","Node ging der Speicher oder der Plattenplatz aus.|The node ran out of memory or disk."],
   ["Terminating hängt|Terminating stuck","Finalizer wartet, oder der Prozess ignoriert SIGTERM.|A finalizer is waiting, or the process ignores SIGTERM."]]},

{h:"Die drei Probes|The three probes",
 table:[["Probe","Schlägt fehl →|On failure →","Wofür|What for"],
   ["startupProbe","Erst danach greifen die anderen beiden.|The other two only start after it passes.","Langsame Starts, statt initialDelaySeconds.|Slow starts, instead of initialDelaySeconds."],
   ["readinessProbe","Pod aus dem Service genommen, kein Neustart.|Pod removed from the service, no restart.","Traffic erst, wenn wirklich bereit.|Traffic only when truly ready."],
   ["livenessProbe","Container wird neu gestartet.|The container gets restarted.","Nur gegen echte Hänger. Zu streng = Neustartschleife.|Only against genuine deadlocks. Too strict = restart loop."]],
 p2:["Der Endpunkt prüft nur den eigenen Prozess. Hängt er an der Datenbank, reißt ein Datenbankausfall sämtliche Pods mit in den Neustart.|The endpoint checks your own process only. If it depends on the database, a database outage drags every pod into a restart loop."]},

{h:"Labels und Selektoren|Labels and selectors",
 code:{de:"app: my-app                          # Selector: minimal halten\napp.kubernetes.io/name: my-app       # Konvention\napp.kubernetes.io/instance: my-app-prod\napp.kubernetes.io/version: \"1.27\"    # nie in den Selector\napp.kubernetes.io/component: backend\napp.kubernetes.io/part-of: shop",
       en:"app: my-app                          # selector: keep it minimal\napp.kubernetes.io/name: my-app       # convention\napp.kubernetes.io/instance: my-app-prod\napp.kubernetes.io/version: \"1.27\"    # never in the selector\napp.kubernetes.io/component: backend\napp.kubernetes.io/part-of: shop"},
 p2:["`spec.selector.matchLabels` ist **unveränderlich**. Eine Änderung erfordert, das Deployment zu löschen und neu anzulegen. Ein Service findet Pods ausschließlich über Labels — passt nichts, hat er keine Endpoints und meldet trotzdem keinen Fehler.|`spec.selector.matchLabels` is **immutable**. Changing it means deleting and recreating the deployment. A service finds pods purely by labels — if nothing matches it has no endpoints and still reports no error."]},

{h:"Welcher Workload|Which workload",
 table:[["Art|Kind","Wofür|What for"],
   ["Deployment","Zustandslos, austauschbare Pods, Rolling Update.|Stateless, interchangeable pods, rolling update."],
   ["StatefulSet","Feste Namen und eigenes Volume je Pod. Datenbanken, Queues.|Fixed names and one volume per pod. Databases, queues."],
   ["DaemonSet","Ein Pod je Node. Log-Shipper, Agenten, Node-Exporter.|One pod per node. Log shippers, agents, node exporters."],
   ["Job","Läuft einmal bis zum Erfolg.|Runs once until it succeeds."],
   ["CronJob","Job nach Zeitplan, in UTC ohne timeZone.|Job on a schedule, in UTC unless timeZone is set."],
   ["Pod","Einzeln, ohne Controller. Debug und Handgriffe.|On its own, no controller. Debugging and one-offs."]]},

{h:"accessModes in einer Zeile|accessModes in one line",
 table:[["Modus|Mode","Gilt für **Nodes**, nicht Pods|Applies to **nodes**, not pods"],
   ["ReadWriteOnce","Ein Node schreibt. Mehrere Pods auf demselben Node dürfen mit.|One node writes. Several pods on that same node may join."],
   ["ReadWriteOncePod","Genau ein Pod, punkt.|Exactly one pod, full stop."],
   ["ReadOnlyMany","Viele lesen, keiner schreibt.|Many read, none writes."],
   ["ReadWriteMany","Viele Nodes schreiben. Nur NFS, CephFS und Ähnliches.|Many nodes write. Only NFS, CephFS and similar."]]},

{h:"YAML-Fallen|YAML traps",
 table:[["Geschrieben|Written","Wird gelesen als|Is read as","Richtig|Correct"],
   ["no / yes / on / off","false / true","`\"no\"`"],
   ["1.27","Zahl|number","`\"1.27\"`"],
   ["*/5 * * * *","Anker-Fehler|anchor error","`\"*/5 * * * *\"`"],
   ["key: wert: mehr","Syntaxfehler|syntax error","`\"wert: mehr\"`"],
   ["Tabulator|Tab","Syntaxfehler|syntax error","Zwei Leerzeichen|Two spaces"],
   ["012","oktal oder Zeichenkette|octal or string","`\"012\"`"]],
 p2:["`data` in einem Secret ist base64, `stringData` ist Klartext — beides ist **nicht verschlüsselt**, nur kodiert.|`data` in a Secret is base64, `stringData` is plain text — neither is **encrypted**, only encoded."]},

{h:"securityContext, restricted|securityContext, restricted",
 code:"securityContext:            # Pod\n  runAsNonRoot: true\n  seccompProfile: { type: RuntimeDefault }\n\nsecurityContext:            # Container\n  allowPrivilegeEscalation: false\n  readOnlyRootFilesystem: true\n  runAsNonRoot: true\n  capabilities: { drop: [ALL] }",
 p2:["Mit `readOnlyRootFilesystem` braucht fast jedes Image ein beschreibbares `/tmp` als emptyDir. Cluster mit erzwungenem Pod Security Standard lehnen Pods ohne diese Felder ab.|With `readOnlyRootFilesystem` almost every image needs a writable `/tmp` as an emptyDir. Clusters enforcing the Pod Security Standard reject pods without these fields."]},

{h:"Cron-Syntax|Cron syntax",
 code:{de:"┌ Minute 0-59\n│ ┌ Stunde 0-23\n│ │ ┌ Tag 1-31\n│ │ │ ┌ Monat 1-12\n│ │ │ │ ┌ Wochentag 0-6 (So=0)\n│ │ │ │ │\n0 3 * * *      # täglich 03:00\n*/15 * * * *   # alle 15 Minuten\n0 2 * * 1      # montags 02:00\n0 0 1 * *      # am Ersten des Monats",
       en:"┌ minute 0-59\n│ ┌ hour 0-23\n│ │ ┌ day 1-31\n│ │ │ ┌ month 1-12\n│ │ │ │ ┌ weekday 0-6 (Sun=0)\n│ │ │ │ │\n0 3 * * *      # daily at 03:00\n*/15 * * * *   # every 15 minutes\n0 2 * * 1      # Mondays at 02:00\n0 0 1 * *      # on the first of the month"},
 p2:["Ohne `timeZone` gilt UTC — gegenüber deutscher Zeit im Winter eine, im Sommer zwei Stunden Versatz.|Without `timeZone` it is UTC — one hour off Central European time in winter, two in summer."]},

{h:"kubectl in zehn Zeilen|kubectl in ten lines",
 code:{de:"kubectl diff -f manifest.yaml            # vorher ansehen\nkubectl apply -f manifest.yaml\nkubectl get pods -o wide                 # Node und IP\nkubectl describe pod NAME                # Events unten lesen\nkubectl logs -l app=NAME -f --tail=100\nkubectl logs NAME --previous             # nach einem Absturz\nkubectl exec -it deploy/NAME -- sh\nkubectl port-forward svc/NAME 8080:80    # ohne Ingress testen\nkubectl rollout status deploy/NAME\nkubectl rollout undo deploy/NAME         # zurück",
       en:"kubectl diff -f manifest.yaml            # look before you leap\nkubectl apply -f manifest.yaml\nkubectl get pods -o wide                 # node and IP\nkubectl describe pod NAME                # read the events at the bottom\nkubectl logs -l app=NAME -f --tail=100\nkubectl logs NAME --previous             # after a crash\nkubectl exec -it deploy/NAME -- sh\nkubectl port-forward svc/NAME 8080:80    # test without ingress\nkubectl rollout status deploy/NAME\nkubectl rollout undo deploy/NAME         # back"}},

{h:"Kurznamen|Short names",
 code:"po    pods           deploy  deployments    sts   statefulsets\nsvc   services       ds      daemonsets     rs    replicasets\ncm    configmaps     ing     ingresses      netpol networkpolicies\npvc   persistentvolumeclaims               pv    persistentvolumes\nsa    serviceaccounts                      ns    namespaces\nno    nodes          cj      cronjobs       hpa   horizontalpodautoscalers",
 p2:["`kubectl api-resources` listet alle auf, samt apiVersion und ob sie an einen Namespace gebunden sind.|`kubectl api-resources` lists them all, with apiVersion and whether they are namespaced."]}
];

function renderCheatsheet(){
  $("cheatWiki").innerHTML = sectionsHtml(CHEATSHEET);
}

function runSelfTests(){
  const out = [];
  const ok = (name, cond, got) => out.push({name:name, pass:!!cond, got:cond ? "" : String(got)});
  const has = (y, needle) => y.indexOf(needle) !== -1;

  /* --- Emitter --- */
  ok("Quoting: Argument -c", toYaml({a:["-c"]}) === 'a:\n  - "-c"', toYaml({a:["-c"]}));
  ok("Quoting: Doppelpunkt im Wert", has(toYaml({a:"hallo: welt"}), '"hallo: welt"'), toYaml({a:"hallo: welt"}));
  ok("Quoting: Cron mit führendem *", has(toYaml({s:"*/5 * * * *"}), '"*/5'), toYaml({s:"*/5 * * * *"}));
  ok("Quoting: Cron ohne führendes *", toYaml({s:"0 3 * * *"}) === "s: 0 3 * * *", toYaml({s:"0 3 * * *"}));
  ok("Quoting: Zahl als Zeichenkette", has(toYaml({v:"1.27"}), '"1.27"'), toYaml({v:"1.27"}));
  ok("Quoting: true als Zeichenkette", has(toYaml({v:"true"}), '"true"'), toYaml({v:"true"}));
  ok("Leere Map bleibt erhalten", has(toYaml({e:EMPTY_MAP}), "e: {}"), toYaml({e:EMPTY_MAP}));
  ok("Leere Zeichenkette in Liste", has(toYaml({g:[EMPTY_STR]}), '- ""'), toYaml({g:[EMPTY_STR]}));
  ok("false wird nicht weggekürzt", has(toYaml({a:false}), "a: false"), toYaml({a:false}));
  ok("null wird weggekürzt", toYaml({a:null, b:1}) === "b: 1", toYaml({a:null, b:1}));
  ok("Verschachtelte Objektlisten", toYaml({l:[{a:1, b:2}]}) === "l:\n  - a: 1\n    b: 2", toYaml({l:[{a:1, b:2}]}));
  ok("Mehrzeiliges als Blockskalar", has(toYaml({f:"a\nb\n"}), "f: |\n  a\n  b"), toYaml({f:"a\nb\n"}));

  ok("qty 100m", qty("100m") === 0.1, qty("100m"));
  ok("qty 512Mi", qty("512Mi") === 536870912, qty("512Mi"));
  ok("qty 512MB ungültig", qty("512MB") === null, qty("512MB"));
  ok("imageTag mit Registry", imageTag("harbor.x/y/z:2.4.1") === "2.4.1", imageTag("harbor.x/y/z:2.4.1"));
  ok("imageTag bei Digest leer", imageTag("nginx@sha256:abc") === "", imageTag("nginx@sha256:abc"));
  ok("imageTag ohne Tag leer", imageTag("nginx") === "", imageTag("nginx"));

  const dep = RES.Deployment.build({name:"api", namespace:"prod", image:"nginx:1.27",
    replicas:3, stdLabels:true, ports:[{containerPort:8080}], hardened:true,
    cpuReq:"100m", cpuLim:"500m", memReq:"128Mi", memLim:"512Mi", probe:"http", probePort:8080});
  ok("Selector bleibt minimal",
    Object.keys(dep.spec.selector.matchLabels).join() === "app", JSON.stringify(dep.spec.selector));
  ok("Version nicht im Selector",
    !dep.spec.selector.matchLabels["app.kubernetes.io/version"], JSON.stringify(dep.spec.selector));
  ok("Version in den Metadaten",
    dep.metadata.labels["app.kubernetes.io/version"] === "1.27", JSON.stringify(dep.metadata.labels));
  ok("Härtung: readOnlyRootFilesystem",
    dep.spec.template.spec.containers[0].securityContext.readOnlyRootFilesystem === true, "");
  ok("Härtung: beschreibbares /tmp",
    dep.spec.template.spec.volumes.some(v => v.name === "tmp" && v.emptyDir === EMPTY_MAP), "");

  const val = ds => validate(ds).map(x => x.lvl + ":" + (x.field||"") + ":" + x.m);
  const pvc = RES.PersistentVolumeClaim.build({name:"data", namespace:"prod", size:"10Gi"});
  const depPvc = RES.Deployment.build({name:"api", namespace:"prod", image:"nginx:1.27", replicas:3,
    pvc:"data", pvcPath:"/data", cpuLim:"1", memLim:"1Gi", probe:"http", probePort:80, ports:[{containerPort:80}]});
  ok("RWO mit 3 Replicas ist ein Fehler",
    val([pvc, depPvc]).some(x => x.indexOf("err:replicas") === 0), val([pvc, depPvc]).join(" | "));

  const sts = RES.StatefulSet.build({name:"db", namespace:"prod", image:"postgres:16", replicas:3,
    serviceName:"db", vct:[{name:"data", path:"/data", size:"10Gi"}],
    cpuLim:"1", memLim:"1Gi", probe:"tcp", probePort:5432, ports:[{containerPort:5432}]});
  ok("StatefulSet mit RWO ist kein Fehler",
    !val([sts]).some(x => x.indexOf("err:replicas") === 0), val([sts]).join(" | "));
  ok("StatefulSet ohne serviceName ist ein Fehler",
    val([{apiVersion:"apps/v1", kind:"StatefulSet", metadata:{name:"db"},
      spec:{replicas:1, template:{spec:{containers:[{name:"db", image:"x:1",
        resources:{limits:{cpu:"1", memory:"1Gi"}}, readinessProbe:{tcpSocket:{port:5432}}}]}}}}])
      .some(x => x.indexOf("err:serviceName") === 0), "");

  ok("limits unter requests ist ein Fehler",
    val([RES.Deployment.build({name:"a", image:"x:1", cpuReq:"200m", cpuLim:"100m"})])
      .some(x => x.indexOf("err:cpuLim") === 0), "");
  ok("Probe auf undeklariertem Port warnt",
    val([RES.Deployment.build({name:"a", image:"x:1", ports:[{containerPort:80}],
      probe:"http", probePort:3000, cpuLim:"1", memLim:"1Gi"})]).some(x => x.indexOf("warn:probePort") === 0), "");
  ok("Volume ohne Definition ist ein Fehler",
    val([{apiVersion:"apps/v1", kind:"Deployment", metadata:{name:"a"}, spec:{replicas:1, template:{spec:{
      containers:[{name:"a", image:"x:1", volumeMounts:[{name:"weg", mountPath:"/x"}],
        resources:{limits:{cpu:"1", memory:"1Gi"}}, readinessProbe:{httpGet:{path:"/", port:80}}}]}}}}])
      .some(x => x.indexOf("err:volumes") === 0), "");

  /* --- Pod --- */
  const bare = RES.Pod.build({name:"probe", namespace:"prod", image:"nginx:1.27",
    ports:[{containerPort:8080}], restartPolicy:"Never", hardened:true, stdLabels:true,
    cpuReq:"100m", cpuLim:"500m", memReq:"128Mi", memLim:"512Mi", probe:"http", probePort:8080});
  ok("Pod: apiVersion v1, kind Pod",
    bare.apiVersion === "v1" && bare.kind === "Pod", bare.apiVersion + "/" + bare.kind);
  ok("Pod: kein template, keine Replicas, kein Selector",
    !bare.spec.template && bare.spec.replicas === undefined && !bare.spec.selector &&
    bare.spec.containers.length === 1, toYaml(bare));
  ok("Pod: restartPolicy wird übernommen", bare.spec.restartPolicy === "Never", String(bare.spec.restartPolicy));
  ok("Pod trägt das app-Label", (bare.metadata.labels||{}).app === "probe", JSON.stringify(bare.metadata.labels));
  ok("Pod: Härtung greift genauso",
    bare.spec.containers[0].securityContext.readOnlyRootFilesystem === true &&
    bare.spec.volumes.some(v => v.name === "tmp" && v.emptyDir === EMPTY_MAP), toYaml(bare));
  ok("Pod: einziger Hinweis ist der fehlende Controller",
    val([bare]).length === 1 && val([bare])[0].indexOf("warn:") === 0, val([bare]).join(" | "));
  ok("Pod ohne limits wird geprüft wie ein Deployment",
    val([RES.Pod.build({name:"p", image:"x:1"})]).some(x => x.indexOf("warn:cpuLim") === 0),
    val([RES.Pod.build({name:"p", image:"x:1"})]).join(" | "));
  ok("Service findet einen einzelnen Pod",
    !val([bare, RES.Service.build({name:"probe", namespace:"prod",
      selector:[{k:"app", v:"probe"}], ports:[{port:80, targetPort:8080}]})])
      .some(x => x.indexOf("warn:selector") === 0), "");

  /* --- RBAC --- */
  const rbac = RES.RBAC.build({name:"r", namespace:"prod", createSA:true, source:"own",
    rules:[{group:"", resources:"pods", verbs:"read"}]});
  ok("RBAC: Core-apiGroup bleibt leer erhalten",
    has(toYaml(rbac[1]), 'apiGroups:\n      - ""'), toYaml(rbac[1]));
  ok("RBAC: RoleBinding zeigt auf die Role",
    rbac[2].roleRef.kind === "Role" && rbac[2].roleRef.name === "r", JSON.stringify(rbac[2].roleRef));
  ok("RBAC: cluster-admin ist ein Fehler",
    val(RES.RBAC.build({name:"c", createSA:true, scope:"cluster", builtin:"cluster-admin"}))
      .some(x => x.indexOf("err:") === 0), "");

  /* --- HPA --- */
  ok("HPA ohne requests.cpu ist ein Fehler",
    val([RES.Deployment.build({name:"a", image:"x:1", cpuLim:"1", memLim:"1Gi"}),
         RES.HorizontalPodAutoscaler.build({name:"a", targetName:"a", cpu:70})])
      .some(x => x.indexOf("err:cpuReq") === 0), "");

  /* --- Geheimnisse ohne Klartext --- */
  const sealed = RES.Secret.build({name:"app-secrets", namespace:"prod", backend:"sealed",
    data:[{k:"DB_PASSWORD", v:"streng-geheim"}]});
  const sealedY = toYaml(sealed);
  ok("SealedSecret enthält keinen Klartext", sealedY.indexOf("streng-geheim") === -1, sealedY);
  ok("SealedSecret behält den Schlüsselnamen", has(sealedY, "DB_PASSWORD: " + SEAL_TODO), sealedY);
  ok("SealedSecret warnt vor dem Platzhalter",
    val([sealed]).some(x => x.indexOf("warn:data") === 0), val([sealed]).join(" | "));
  ok("kubeseal bindet strict an Name und Namespace",
    has(sealCommands({name:"app-secrets", namespace:"prod", data:[{k:"A", v:"b"}]})[0].cmd,
        "--namespace prod --name app-secrets"), "");
  ok("kubeseal übergibt den Wert nicht",
    sealCommands({name:"a", namespace:"p", data:[{k:"A", v:"streng-geheim"}]})[0].cmd.indexOf("streng-geheim") === -1, "");
  ok("cluster-wide wird gewarnt",
    val([RES.Secret.build({name:"s", namespace:"p", backend:"sealed", sealedScope:"cluster",
      data:[{k:"A", v:"b"}]})]).some(x => x.indexOf("warn:sealedScope") === 0), "");

  const ext = RES.Secret.build({name:"app-secrets", namespace:"prod", backend:"external",
    store:"vault-backend", extPath:"secret/data/shop/db", data:[{k:"DB_PASSWORD", v:"streng-geheim"}]});
  const extY = toYaml(ext);
  ok("ExternalSecret enthält kein Geheimnis", extY.indexOf("streng-geheim") === -1, extY);
  ok("ExternalSecret verweist auf den Store", has(extY, "name: vault-backend"), extY);
  ok("ExternalSecret ohne Store ist ein Fehler",
    val([RES.Secret.build({name:"s", backend:"external", extPath:"x"})]).some(x => x.indexOf("err:store") === 0), "");
  ok("ExternalSecret löst die Klartext-Warnung nicht aus",
    !val([ext]).some(x => x.indexOf("data") !== -1 && x.indexOf("Klartext") !== -1), "");

  /* --- Komplett-Modus --- */
  const stack = RES._stack.build({name:"s", namespace:"prod", image:"nginx:1.27", port:8080,
    replicas:2, svcType:"", svcPort:80, ingress:true, host:"h.example.com",
    cpuReq:"100m", cpuLim:"500m", memReq:"128Mi", memLim:"512Mi", probe:"http", probePath:"/z",
    hardened:true, stdLabels:true});
  const sSvc = stack.filter(x => x.kind === "Service")[0];
  const sDep = stack.filter(x => x.kind === "Deployment")[0];
  const sIng = stack.filter(x => x.kind === "Ingress")[0];
  ok("Komplett: Service-Selector trifft die Pod-Labels",
    Object.keys(sSvc.spec.selector).every(k => sDep.spec.template.metadata.labels[k] === sSvc.spec.selector[k]), "");
  ok("Komplett: Ingress trifft den Service-Port",
    sIng.spec.rules[0].http.paths[0].backend.service.port.number === sSvc.spec.ports[0].port, "");
  ok("Komplett: keine Beanstandungen", validate(stack).filter(x => x.lvl === "err").length === 0,
    validate(stack).map(x => x.m).join(" | "));

  /* --- Secret und Export --- */
  const sec = RES.Secret.build({name:"r", type:"kubernetes.io/dockerconfigjson",
    regServer:"h.de", regUser:"u", regPass:"p"});
  ok("Secret: auth ist base64 von user:pass",
    has(sec.stringData[".dockerconfigjson"], b64("u:p")), sec.stringData[".dockerconfigjson"]);

  /* --- Befehls-Assistent: Nodes und Taints --- */
  const nodeTask = CMDTASKS.filter(x => x.id === "node")[0];
  const keepCtx = CMD.ctx;
  CMD.ctx = "";
  const nodeCmd = o => nodeTask.build(o).c;
  ok("taint: key=value:Effect",
    nodeCmd({action:"taint", name:"worker-01", key:"dedicated", value:"gpu", effect:"NoSchedule"}) ===
    "kubectl taint nodes worker-01 dedicated=gpu:NoSchedule",
    nodeCmd({action:"taint", name:"worker-01", key:"dedicated", value:"gpu", effect:"NoSchedule"}));
  ok("taint ohne Wert lässt das Gleichheitszeichen weg",
    nodeCmd({action:"taint", name:"n1", key:"gpu", effect:"NoSchedule"}) === "kubectl taint nodes n1 gpu:NoSchedule",
    nodeCmd({action:"taint", name:"n1", key:"gpu", effect:"NoSchedule"}));
  ok("taint über Label-Filter statt Namen",
    nodeCmd({action:"taint", name:"n1", selector:"disktype=ssd", key:"gpu", effect:"NoSchedule"})
      .indexOf(" -l disktype=ssd ") !== -1, "");
  ok("NoExecute ist ein Fehlerhinweis",
    nodeTask.build({action:"taint", name:"n1", key:"gpu", effect:"NoExecute"}).r.some(x => x.lvl === "err"), "");
  ok("untaint hängt das Minus an",
    nodeCmd({action:"untaint", name:"n1", key:"dedicated", effect:"NoSchedule"}) ===
    "kubectl taint nodes n1 dedicated:NoSchedule-",
    nodeCmd({action:"untaint", name:"n1", key:"dedicated", effect:"NoSchedule"}));
  ok("untaint ohne Effekt entfernt den ganzen Schlüssel",
    nodeCmd({action:"untaint", name:"n1", key:"dedicated", effect:""}) === "kubectl taint nodes n1 dedicated-",
    nodeCmd({action:"untaint", name:"n1", key:"dedicated", effect:""}));
  ok("drain ohne --ignore-daemonsets wird gewarnt",
    nodeTask.build({action:"drain", name:"n1"}).r.some(x => x.lvl === "warn"), "");
  ok("drain --force ist ein Fehlerhinweis",
    nodeTask.build({action:"drain", name:"n1", ignoreDS:true, force:true}).r.some(x => x.lvl === "err"), "");
  ok("Node-Befehle tragen kein -n",
    ["taint","untaint","show","cordon","drain","label"]
      .every(a => nodeCmd({action:a, name:"n1", ns:"prod", key:"k"}).indexOf(" -n ") === -1), "");
  ok("Voreinstellung ohne Auswahl ist ein gültiger taint",
    nodeCmd({}) === "kubectl taint nodes NODE dedicated:NoSchedule", nodeCmd({}));
  CMD.ctx = keepCtx;

  /* --- Tolerations --- */
  const tolSpec = t2 => RES.Deployment.build({name:"a", image:"x:1", cpuLim:"1", memLim:"1Gi",
    probe:"http", probePort:80, tolerations:t2}).spec.template.spec;
  const tol1 = tolSpec([{key:"dedicated", value:"gpu", effect:"NoSchedule"}]).tolerations;
  ok("Toleration: operator Equal steht ausdrücklich da",
    tol1[0].operator === "Equal" && tol1[0].value === "gpu" && tol1[0].effect === "NoSchedule",
    JSON.stringify(tol1));
  ok("Toleration: Exists trägt keinen Wert",
    tolSpec([{key:"gpu", op:"Exists", value:"wird-verworfen"}]).tolerations[0].value === undefined,
    JSON.stringify(tolSpec([{key:"gpu", op:"Exists", value:"x"}]).tolerations));
  ok("Toleration: tolerationSeconds wird übernommen",
    tolSpec([{key:"k", op:"Exists", effect:"NoExecute", seconds:300}]).tolerations[0].tolerationSeconds === 300, "");
  ok("Leere Einträge fallen weg",
    tolSpec([{key:"", op:"", value:""}]).tolerations === undefined, "");
  ok("Toleration ohne key und ohne Exists ist ein Fehler",
    val([{apiVersion:"apps/v1", kind:"Deployment", metadata:{name:"a"}, spec:{template:{spec:{
      tolerations:[{operator:"Equal", value:"x"}],
      containers:[{name:"a", image:"x:1", resources:{limits:{cpu:"1", memory:"1Gi"}},
        readinessProbe:{httpGet:{path:"/", port:80}}}]}}}}])
      .some(x => x.indexOf("err:tolerations") === 0), "");
  ok("Exists mit value ist ein Fehler",
    val([{apiVersion:"apps/v1", kind:"Deployment", metadata:{name:"a"}, spec:{template:{spec:{
      tolerations:[{key:"k", operator:"Exists", value:"x"}],
      containers:[{name:"a", image:"x:1", resources:{limits:{cpu:"1", memory:"1Gi"}},
        readinessProbe:{httpGet:{path:"/", port:80}}}]}}}}])
      .some(x => x.indexOf("err:tolerations") === 0), "");
  ok("Toleration für alles wird gewarnt",
    val([RES.Deployment.build({name:"a", image:"x:1", cpuLim:"1", memLim:"1Gi",
      probe:"http", probePort:80, tolerations:[{op:"Exists"}]})])
      .some(x => x.indexOf("warn:tolerations") === 0), "");
  ok("tolerationSeconds ohne NoExecute wird gewarnt",
    val([RES.Deployment.build({name:"a", image:"x:1", cpuLim:"1", memLim:"1Gi", probe:"http", probePort:80,
      tolerations:[{key:"k", op:"Exists", effect:"NoSchedule", seconds:30}]})])
      .some(x => x.indexOf("warn:tolerations") === 0), "");
  ok("Pod und StatefulSet kennen Tolerations auch",
    stepOf("Pod", "tolerations") >= 0 && stepOf("StatefulSet", "tolerations") >= 0, "");

  /* --- Befehls-Assistent: Beschriften --- */
  const labelTask = CMDTASKS.filter(x => x.id === "label")[0];
  const keepCtx2 = CMD.ctx;
  CMD.ctx = "";
  ok("label setzt Schlüssel und Wert",
    labelTask.build({kind:"deploy", name:"api", ns:"prod", pairs:"tier=backend"}).c ===
    "kubectl label deploy api -n prod tier=backend",
    labelTask.build({kind:"deploy", name:"api", ns:"prod", pairs:"tier=backend"}).c);
  ok("label entfernt mit angehängtem Minus",
    labelTask.build({kind:"deploy", name:"api", pairs:"tier=backend", remove:true}).c ===
    "kubectl label deploy api tier-",
    labelTask.build({kind:"deploy", name:"api", pairs:"tier=backend", remove:true}).c);
  ok("mehrere Schlüssel werden einzeln entfernt",
    labelTask.build({kind:"pods", name:"p", pairs:"a=1 b=2", remove:true}).c === "kubectl label pods p a- b-",
    labelTask.build({kind:"pods", name:"p", pairs:"a=1 b=2", remove:true}).c);
  ok("annotate nutzt dasselbe Muster",
    labelTask.build({what:"annotate", kind:"deploy", name:"api", pairs:"team=plattform"}).c ===
    "kubectl annotate deploy api team=plattform",
    labelTask.build({what:"annotate", kind:"deploy", name:"api", pairs:"team=plattform"}).c);
  ok("label über Label-Filter warnt",
    labelTask.build({kind:"pods", selector:"app=api", pairs:"tier=backend"}).r.some(x => x.lvl === "warn"), "");
  ok("label am Deployment weist auf die Pods hin",
    labelTask.build({kind:"deploy", name:"api", pairs:"tier=backend"}).r.length >= 2, "");
  CMD.ctx = keepCtx2;

  /* --- Init-Container und Sidecars --- */
  const withInit = RES.Deployment.build({name:"api", image:"nginx:1.27", cpuLim:"1", memLim:"1Gi",
    volumes:[{type:"", cm:"app-config", path:"/etc/app"}],
    initContainers:[
      {name:"migrate", image:"migrate:2.1", command:"migrate\nup", mounts:true},
      {name:"proxy", image:"envoy:1.31", mode:"sidecar"},
      {name:"", image:"wird-verworfen:1"}
    ]});
  const initList = withInit.spec.template.spec.initContainers;
  ok("Init: unvollständige Einträge fallen weg", initList.length === 2, JSON.stringify(initList));
  ok("Init: gewöhnlicher Init-Container ohne restartPolicy",
    initList[0].restartPolicy === undefined, JSON.stringify(initList[0]));
  ok("Sidecar: restartPolicy Always",
    initList[1].restartPolicy === "Always", JSON.stringify(initList[1]));
  ok("Init: command wird zeilenweise übernommen",
    initList[0].command.join(" ") === "migrate up", JSON.stringify(initList[0].command));
  ok("Init: Volumes des Hauptcontainers werden mitgenommen",
    initList[0].volumeMounts[0].mountPath === "/etc/app" && initList[1].volumeMounts === undefined,
    JSON.stringify(initList[0].volumeMounts));
  ok("initContainers stehen vor containers im YAML",
    toYaml(withInit).indexOf("initContainers:") < toYaml(withInit).indexOf("containers:"), "");
  ok("Init-Container mit eigenem Volume-Mount ist kein Fehler",
    !val([withInit]).some(x => x.indexOf("err:volumes") === 0), val([withInit]).join(" | "));

  const hardInit = RES.Deployment.build({name:"a", image:"x:1", hardened:true,
    initContainers:[{name:"prep", image:"busybox:1.36"}]}).spec.template.spec.initContainers[0];
  ok("Init: Härtung gilt auch hier",
    hardInit.securityContext.allowPrivilegeEscalation === false &&
    hardInit.securityContext.capabilities.drop[0] === "ALL", JSON.stringify(hardInit.securityContext));
  ok("Init: readOnlyRootFilesystem bleibt aus",
    hardInit.securityContext.readOnlyRootFilesystem === undefined, JSON.stringify(hardInit.securityContext));

  ok("Doppelter Containername ist ein Fehler",
    val([RES.Deployment.build({name:"api", image:"x:1", cpuLim:"1", memLim:"1Gi",
      probe:"http", probePort:80, initContainers:[{name:"api", image:"y:1"}]})])
      .some(x => x.indexOf("err:initContainers") === 0), "");

  ok("Init-Container ohne Tag wird gewarnt",
    val([RES.Deployment.build({name:"a", image:"x:1", cpuLim:"1", memLim:"1Gi",
      probe:"http", probePort:80, initContainers:[{name:"prep", image:"busybox"}]})])
      .some(x => x.indexOf("warn:image") === 0), "");

  ok("Pod und StatefulSet kennen den Schritt ebenfalls",
    stepOf("Pod", "initContainers") >= 0 && stepOf("StatefulSet", "initContainers") >= 0 &&
    stepOf("Pod", "hardened") >= 0 && stepOf("StatefulSet", "strategy") >= 0, "");

  /* --- Probes --- */
  const cOf = d => RES.Deployment.build(Object.assign({name:"a", image:"x:1",
    ports:[{containerPort:8080}], cpuLim:"1", memLim:"1Gi"}, d)).spec.template.spec.containers[0];

  const pOld = cOf({probe:"http", probePath:"/healthz", probePort:8080});
  ok("Probes: alte Daten ohne Schalter bleiben bei readiness und liveness",
    !!pOld.readinessProbe && !!pOld.livenessProbe && !pOld.startupProbe &&
    pOld.livenessProbe.initialDelaySeconds === 15 && pOld.livenessProbe.periodSeconds === 20,
    JSON.stringify(pOld.livenessProbe));

  const pStart = cOf({probe:"http", probePath:"/healthz", probePort:8080, probeStartup:true});
  ok("startupProbe wird erzeugt, mit Budget",
    pStart.startupProbe.periodSeconds === 10 && pStart.startupProbe.failureThreshold === 30,
    JSON.stringify(pStart.startupProbe));
  ok("Mit startupProbe entfällt der Vorlauf der livenessProbe",
    pStart.livenessProbe.initialDelaySeconds === undefined, JSON.stringify(pStart.livenessProbe));
  ok("startupProbe prüft denselben Endpunkt",
    pStart.startupProbe.httpGet.path === "/healthz" && pStart.startupProbe.httpGet.port === 8080,
    JSON.stringify(pStart.startupProbe));

  ok("readinessProbe lässt sich abschalten",
    !cOf({probe:"http", probePort:8080, probeReadiness:false}).readinessProbe, "");
  ok("livenessProbe lässt sich abschalten",
    !cOf({probe:"http", probePort:8080, probeLiveness:false}).livenessProbe, "");
  ok("livenessProbe ohne readinessProbe wird gewarnt",
    val([RES.Deployment.build({name:"a", image:"x:1", cpuLim:"1", memLim:"1Gi",
      ports:[{containerPort:8080}], probe:"http", probePort:8080, probeReadiness:false})])
      .some(x => x.indexOf("warn:probeReadiness") === 0), "");

  const pExec = cOf({probe:"exec", probeCmd:"pg_isready\n-U\npostgres"});
  ok("exec-Probe übernimmt den Befehl zeilenweise",
    pExec.readinessProbe.exec.command.length === 3 &&
    pExec.readinessProbe.exec.command[0] === "pg_isready", JSON.stringify(pExec.readinessProbe));

  const pSplit = cOf({probe:"http", probePath:"/readyz", livenessPath:"/healthz", probePort:8080});
  ok("livenessProbe darf einen eigenen Pfad haben",
    pSplit.readinessProbe.httpGet.path === "/readyz" &&
    pSplit.livenessProbe.httpGet.path === "/healthz", JSON.stringify(pSplit.livenessProbe));

  const pTime = cOf({probe:"tcp", probePort:5432, probeDelay:5, probePeriod:15,
    probeTimeout:3, probeFailures:6});
  ok("Zeiten landen in beiden Probes",
    pTime.readinessProbe.periodSeconds === 15 && pTime.readinessProbe.timeoutSeconds === 3 &&
    pTime.readinessProbe.failureThreshold === 6 && pTime.livenessProbe.initialDelaySeconds === 5,
    JSON.stringify(pTime.readinessProbe));

  ok("startupProbe auf undeklariertem Port warnt",
    val([RES.Deployment.build({name:"a", image:"x:1", cpuLim:"1", memLim:"1Gi",
      ports:[{containerPort:8080}], probe:"http", probePort:3000,
      probeReadiness:false, probeLiveness:false, probeStartup:true})])
      .some(x => x.indexOf("warn:probePort") === 0), "");

  ok("Komplett-Modus reicht die startupProbe durch",
    !!RES._stack.build({name:"s", image:"nginx:1.27", port:8080, probe:"http", probePath:"/z",
      probeStartup:true, cpuReq:"100m", cpuLim:"500m", memReq:"128Mi", memLim:"512Mi"})
      .filter(x => x.kind === "Deployment")[0].spec.template.spec.containers[0].startupProbe, "");

  /* --- PersistentVolume und statische Bindung --- */
  const pvLocal = RES.PersistentVolume.build({name:"data-pv-01", size:"10Gi", class:"manual",
    src:"local", path:"/mnt/disks/data", node:"worker-01"});
  ok("PV: clusterweit, ohne Namespace",
    pvLocal.metadata.namespace === undefined && pvLocal.kind === "PersistentVolume", toYaml(pvLocal));
  ok("PV: Retain ist gesetzt, nicht nur gemeint",
    pvLocal.spec.persistentVolumeReclaimPolicy === "Retain", toYaml(pvLocal));
  ok("PV local: nodeAffinity zeigt auf den Node",
    pvLocal.spec.nodeAffinity.required.nodeSelectorTerms[0].matchExpressions[0].values[0] === "worker-01",
    toYaml(pvLocal));
  ok("PV local ohne Node ist ein Fehler",
    val([RES.PersistentVolume.build({name:"p", size:"1Gi", src:"local", path:"/mnt/x"})])
      .some(x => x.indexOf("err:node") === 0), "");
  ok("PV ohne Quelle ist ein Fehler",
    val([{apiVersion:"v1", kind:"PersistentVolume", metadata:{name:"p"}, spec:{capacity:{storage:"1Gi"}}}])
      .some(x => x.indexOf("err:src") === 0), "");
  ok("PV hostPath wird gewarnt",
    val([RES.PersistentVolume.build({name:"p", size:"1Gi", src:"hostPath", path:"/data"})])
      .some(x => x.indexOf("warn:src") === 0), "");
  const pvNfs = RES.PersistentVolume.build({name:"nfs-pv", size:"50Gi", access:"ReadWriteMany",
    src:"nfs", server:"nfs.intern", path:"/export/data", mountOptions:"hard\nnfsvers=4.1"});
  ok("PV nfs: Server, Pfad und mountOptions",
    pvNfs.spec.nfs.server === "nfs.intern" && pvNfs.spec.mountOptions.length === 2, toYaml(pvNfs));

  const claimStatic = RES.PersistentVolumeClaim.build({name:"data", namespace:"prod", size:"10Gi",
    class:"manual", bindMode:"static", volumeName:"data-pv-01"});
  ok("PVC statisch: volumeName wird gesetzt",
    claimStatic.spec.volumeName === "data-pv-01", toYaml(claimStatic));
  ok("PVC statisch: passende Bindung meldet nichts",
    val([pvLocal, claimStatic]).length === 0, val([pvLocal, claimStatic]).join(" | "));
  ok("PVC: leere storageClassName landet als \"\" im YAML",
    has(toYaml(RES.PersistentVolumeClaim.build({name:"d", size:"1Gi",
      bindMode:"static", volumeName:"p", emptyClass:true})), 'storageClassName: ""'),
    toYaml(RES.PersistentVolumeClaim.build({name:"d", size:"1Gi", bindMode:"static", volumeName:"p", emptyClass:true})));
  ok("PVC: unpassende Klasse ist ein Fehler",
    val([pvLocal, RES.PersistentVolumeClaim.build({name:"data", size:"10Gi",
      bindMode:"static", volumeName:"data-pv-01", emptyClass:true})])
      .some(x => x.indexOf("err:class") === 0), "");
  ok("PVC: mehr fordern als das PV hergibt ist ein Fehler",
    val([pvLocal, RES.PersistentVolumeClaim.build({name:"data", size:"20Gi", class:"manual",
      bindMode:"static", volumeName:"data-pv-01"})]).some(x => x.indexOf("err:size") === 0), "");
  ok("PVC: accessMode, den das PV nicht anbietet, ist ein Fehler",
    val([pvLocal, RES.PersistentVolumeClaim.build({name:"data", size:"10Gi", class:"manual",
      access:"ReadWriteMany", bindMode:"static", volumeName:"data-pv-01"})])
      .some(x => x.indexOf("err:access") === 0), "");
  ok("PVC: unbekanntes PV wird nur gewarnt",
    val([RES.PersistentVolumeClaim.build({name:"data", size:"1Gi",
      bindMode:"static", volumeName:"woanders", emptyClass:true})])
      .some(x => x.indexOf("warn:volumeName") === 0), "");
  ok("PVC dynamisch bleibt unverändert",
    RES.PersistentVolumeClaim.build({name:"d", size:"1Gi", class:"fast"}).spec.volumeName === undefined &&
    RES.PersistentVolumeClaim.build({name:"d", size:"1Gi", class:"fast"}).spec.storageClassName === "fast", "");

  /* --- Cluster-Anleitung --- */
  const guideOf = x => clusterGuide(x);
  const allCmds = x => guideOf(x).map(s => s.items.map(i => i.c).join("\n")).join("\n");
  const roles = x => guideOf(x).map(s => s.role).join(",");
  const g1 = guideOf({});
  ok("Anleitung trennt nach Rolle",
    roles({}).indexOf("all") === 0 && roles({}).indexOf("worker") !== -1 && roles({}).indexOf("cp") !== -1,
    roles({}));
  ok("Jeder Abschnitt hat Überschrift, Rolle und Befehle",
    g1.every(s => s.h && CLUSTER_ROLE[s.role] && s.items.length), "");
  ok("init trägt das Pod-Netz des gewählten CNI",
    allCmds({cni:"calico"}).indexOf("--pod-network-cidr=192.168.0.0/16") !== -1 &&
    allCmds({cni:"flannel"}).indexOf("--pod-network-cidr=10.244.0.0/16") !== -1, "");
  ok("Eigenes Pod-Netz sticht die Voreinstellung",
    allCmds({cni:"calico", podCidr:"172.20.0.0/16"}).indexOf("172.20.0.0/16") !== -1, "");
  ok("control-plane-endpoint nur mit Adresse",
    allCmds({}).indexOf("--control-plane-endpoint") === -1 &&
    allCmds({endpoint:"api.firma.de"}).indexOf("--control-plane-endpoint=api.firma.de:6443") !== -1, "");
  ok("upload-certs nur bei Hochverfügbarkeit",
    allCmds({}).indexOf("--upload-certs") === -1 && allCmds({ha:true}).indexOf("--upload-certs") !== -1, "");
  ok("Hochverfügbarkeit ergänzt die Abschnitte für weitere Hauptserver",
    guideOf({ha:true}).length > guideOf({}).length &&
    allCmds({ha:true}).indexOf("--control-plane --certificate-key") !== -1 &&
    allCmds({}).indexOf("--control-plane --certificate-key") === -1, "");
  ok("Ohne Hochverfügbarkeit wird gewarnt",
    guideOf({}).some(s => (s.r||[]).some(x => x.lvl === "warn")) , "");
  ok("Hochverfügbarkeit ohne Adresse ist ein Fehler, kein stiller Verzicht",
    guideOf({ha:true}).some(s => (s.r||[]).some(x => x.lvl === "err" && x.m.indexOf("controlPlaneEndpoint") !== -1)) &&
    !guideOf({ha:true, endpoint:"api.firma.de"}).some(s => (s.r||[]).some(x => x.lvl === "err" && x.m.indexOf("controlPlaneEndpoint") !== -1)), "");
  ok("Der init-Befehl lässt den Endpoint bei Hochverfügbarkeit nie weg",
    allCmds({ha:true}).indexOf("--control-plane-endpoint=STABILE-ADRESSE:6443") !== -1 &&
    allCmds({ha:true, endpoint:"api.firma.de"}).indexOf("--control-plane-endpoint=api.firma.de:6443") !== -1, "");
  ok("Ohne Hochverfügbarkeit bleibt der Endpoint optional",
    allCmds({}).indexOf("--control-plane-endpoint") === -1, "");
  ok("Beitrittsbefehle nennen bei Hochverfügbarkeit keine Node-IP",
    allCmds({ha:true}).indexOf("IP-DES-HAUPTSERVERS") === -1, "");
  ok("Ein Abschnitt hilft aus dem fehlenden Endpoint heraus",
    guideOf({ha:true}).some(s => s.items.some(i => i.c.indexOf("kubeadm reset -f") !== -1) &&
      s.items.some(i => i.c.indexOf("controlPlaneEndpoint") !== -1)) &&
    !guideOf({}).some(s => s.items.some(i => i.c.indexOf("kubeadm reset -f") !== -1)), "");
  ok("Ein Abschnitt erklärt die Platzhalter",
    guideOf({}).some(s => s.items.some(i => i.c.indexOf("--print-join-command") !== -1) &&
      s.items.some(i => i.c.indexOf("kubeadm token list") !== -1) &&
      s.items.some(i => i.c.indexOf("/etc/kubernetes/pki/ca.crt") !== -1)), "");
  ok("Der Platzhalter-Abschnitt steht vor den Beitrittsbefehlen",
    guideOf({}).findIndex(s => s.items.some(i => i.c.indexOf("--print-join-command") !== -1)) <
    guideOf({}).findIndex(s => s.role === "worker"), "");
  ok("Der Zertifikatsschlüssel wird nur bei Hochverfügbarkeit erklärt",
    allCmds({ha:true}).indexOf("upload-certs") !== -1 &&
    guideOf({}).every(s => s.p.every(x => x.indexOf("<KEY>") === -1)), "");
  ok("Jeder Platzhalter kommt mit einem Weg, ihn zu beschaffen",
    ["<TOKEN>","<HASH>"].every(ph => {
      const uses = guideOf({}).some(s => s.items.some(i => i.c.indexOf(ph) !== -1));
      const explains = guideOf({}).some(s => s.p.some(x => t(x).indexOf(ph) !== -1));
      return uses && explains;
    }), "");
  ok("Vor dem Überspringen der Hash-Prüfung wird gewarnt",
    guideOf({}).some(s => (s.r||[]).some(x => x.m.indexOf("skip-ca-verification") !== -1)), "");
  ok("Worker treten ohne --control-plane bei",
    guideOf({}).filter(s => s.role === "worker")[0].items[0].c.indexOf("--control-plane") === -1, "");
  ok("Paketquelle folgt der Version",
    allCmds({version:"1.33"}).indexOf("stable:/v1.33/") !== -1 &&
    allCmds({version:"v1.33"}).indexOf("stable:/v1.33/") !== -1, "");
  ok("Betriebssystem schaltet zwischen apt und dnf um",
    allCmds({os:"apt"}).indexOf("apt-mark hold") !== -1 && allCmds({os:"apt"}).indexOf("yum.repos.d") === -1 &&
    allCmds({os:"dnf"}).indexOf("yum.repos.d") !== -1 && allCmds({os:"dnf"}).indexOf("apt-mark hold") === -1, "");
  ok("containerd bekommt SystemdCgroup, CRI-O nicht",
    allCmds({runtime:"containerd"}).indexOf("SystemdCgroup = true") !== -1 &&
    allCmds({runtime:"crio"}).indexOf("SystemdCgroup") === -1, "");
  ok("Einzelknoten entfernt den Taint des Hauptservers",
    allCmds({singleNode:true}).indexOf("node-role.kubernetes.io/control-plane-") !== -1 &&
    allCmds({}).indexOf("node-role.kubernetes.io/control-plane-") === -1, "");
  ok("Firewall-Abschnitt nur auf Wunsch",
    guideOf({firewall:true}).length === guideOf({}).length + 1, "");
  ok("Anleitungstexte überstehen den Sprachwechsel",
    g1.every(s => [s.h].concat(s.p||[]).every(x => x.split("|").length === 2) &&
      s.items.every(i => i.d.split("|").length === 2)), "");
  const guideMd = clusterMarkdown();
  ok("Markdown enthält alle Abschnitte und Befehle",
    g1.every(s => guideMd.indexOf(t(s.h)) !== -1) && guideMd.indexOf("```sh") !== -1 && guideMd.length > 2000,
    String(guideMd.length));

  /* --- Best Practices --- */
  const withBest = Object.keys(RES).filter(k => RES[k].best && RES[k].best.length);
  ok("Jede Ressource hat Empfehlungen",
    withBest.length === Object.keys(RES).length,
    Object.keys(RES).filter(k => !RES[k].best).join(", "));
  ok("Empfehlungen sind zweisprachig und nie leer",
    withBest.every(k => RES[k].best.every(x => {
      const keep = LANG; let good = true;
      ["de","en"].forEach(l => { LANG = l; if (!String(t(x)).trim()) good = false; });
      LANG = keep; return good;
    })), "");
  ok("Kein Eintrag hat mehr als einen Trenner",
    withBest.every(k => RES[k].best.every(x => x.split("|").length === 2)),
    withBest.filter(k => RES[k].best.some(x => x.split("|").length !== 2)).join(", "));
  ok("Empfehlungen stehen in der Suche",
    searchIndex().filter(x => x.g === "best").length === withBest.length, "");
  ok("Der Block wird auf dem ersten Schritt gebaut",
    bestHtml("Deployment").indexOf("<li>") !== -1 && bestHtml("Deployment").indexOf("<details") === 0,
    bestHtml("Deployment").slice(0, 60));
  ok("Unbekannte Ressource liefert leeren Block", bestHtml("GibtEsNicht") === "", "");
  ok("Auszeichnungen werden umgesetzt, nicht ausgegeben",
    bestHtml("Deployment").indexOf("<code>") !== -1 &&
    bestHtml("Deployment").indexOf("`") === -1, "");

  /* --- Spickzettel --- */
  const cheatStrings = [];
  CHEATSHEET.forEach(sec => {
    cheatStrings.push(sec.h);
    (sec.p||[]).concat(sec.p2||[]).forEach(x => cheatStrings.push(x));
    (sec.table||[]).forEach(r => r.forEach(c => cheatStrings.push(c)));
    if (sec.code) cheatStrings.push(sec.code);
  });
  ok("Spickzettel: jeder Abschnitt hat eine Überschrift",
    CHEATSHEET.every(s => s.h && (s.table || s.code || s.p || s.p2)), "");
  ok("Spickzettel: keine leeren Zeichenketten in DE oder EN",
    cheatStrings.every(s => {
      const keep = LANG; let good = true;
      ["de","en"].forEach(l => { LANG = l; if (!String(t(s)).trim()) good = false; });
      LANG = keep; return good;
    }), "");
  /* Mehrzeilige Codeblöcke müssen die Objektform nutzen — t() zerlegt Zeichenketten am | */
  ok("Spickzettel: Codeblöcke überleben den Sprachwechsel",
    CHEATSHEET.filter(s => s.code).every(s => {
      const keep = LANG; let good = true;
      ["de","en"].forEach(l => {
        LANG = l;
        const c = t(s.code);
        if (typeof s.code === "string" && s.code.indexOf("|") !== -1) good = false;
        if (c.split("\n").length !== (typeof s.code === "string" ? s.code : s.code.de).split("\n").length) good = false;
      });
      LANG = keep; return good;
    }), "");
  ok("Spickzettel steht in der Suche",
    searchIndex().filter(x => x.g === "cheat").length === CHEATSHEET.length, "");

  if (typeof getComputedStyle === "function" && document.body){
    ["stepnav","toast","wikipanel"].forEach(cn => {
      const probe = document.createElement("div");
      probe.className = cn; probe.hidden = true;
      document.body.appendChild(probe);
      const disp = getComputedStyle(probe).display;
      document.body.removeChild(probe);
      ok("hidden blendet ." + cn + " wirklich aus", disp === "none", "display:" + disp);
    });
  }

  const keep = {docs:S.docs, current:S.current, editIndex:S.editIndex};
  S.docs = [{kind:"Secret", data:{name:"s", type:"", data:[{k:"PW", v:"streng-geheim"}]}}];
  S.current = null; S.editIndex = null;
  const md = toMarkdown().split("## manifest.yaml")[0];
  S.docs = keep.docs; S.current = keep.current; S.editIndex = keep.editIndex;
  ok("Doku-Export maskiert Geheimnisse", md.indexOf("streng-geheim") === -1, "Klartext gefunden");

  return out;
}

function renderTests(){
  const res = runSelfTests();
  const bad = res.filter(x => !x.pass);
  const de = LANG === "de";
  let h = '<div class="testhead ' + (bad.length ? "testhead--bad" : "testhead--ok") + '">' +
    (bad.length
      ? bad.length + (de ? " von " : " of ") + res.length + (de ? " fehlgeschlagen" : " failed")
      : res.length + (de ? " Zusicherungen, alle erfüllt" : " assertions, all passing")) + "</div>";
  h += res.map(x => '<div class="testrow ' + (x.pass ? "" : "testrow--bad") + '"><b>' +
    (x.pass ? "ok" : "fail") + "</b><span>" + esc(x.name) + "</span>" +
    (x.pass ? "" : '<code>' + esc(x.got.slice(0, 200)) + "</code>") + "</div>").join("");
  $("testList").innerHTML = h;
}

$("testBtn").addEventListener("click", () => {
  if (togglePanel("testPanel")) renderTests();
});
$("testClose").addEventListener("click", () => { $("testPanel").hidden = true; });


/* ---------- Cluster aufsetzen ---------- */

const CLUSTER_FIELDS = [
  {k:"version", t:"text", l:"Kubernetes-Version|Kubernetes version", ph:"1.34", half:true,
   hint:"Nur Major.Minor — daraus entsteht die Paketquelle.|Major.minor only — the package repository is derived from it."},
  {k:"os", t:"select", l:"Betriebssystem|Operating system", half:true, structural:true,
   opts:[["apt","Debian / Ubuntu"],["dnf","RHEL / Rocky / AlmaLinux"]]},
  {k:"runtime", t:"select", l:"Container-Runtime|Container runtime", half:true, structural:true,
   opts:[["containerd","containerd"],["crio","CRI-O"]]},
  {k:"cni", t:"select", l:"Netzwerk (CNI)|Networking (CNI)", half:true, structural:true,
   opts:[["cilium","Cilium — eBPF, ohne kube-proxy möglich|Cilium — eBPF, can replace kube-proxy"],
         ["calico","Calico — verbreitet, NetworkPolicy inklusive|Calico — widespread, network policy included"],
         ["flannel","Flannel — einfach, ohne NetworkPolicy|Flannel — simple, no network policy"]]},
  {k:"endpoint", t:"text", l:"API-Adresse|API address", ph:"k8s-api.firma.de",
   hint:"Name oder VIP, unter dem der API-Server erreichbar ist. Leer lassen heißt: die IP des ersten Hauptservers — die lässt sich später nicht mehr ändern. Für mehrere Hauptserver ist die Angabe zwingend.|Name or VIP the API server answers on. Empty means the first control-plane node's IP — which cannot be changed later. With several control-plane nodes it is mandatory."},
  {k:"ha", t:"bool", structural:true, l:"Mehrere Hauptserver (Hochverfügbarkeit)|Several control-plane nodes (high availability)",
   hint:"Drei Hauptserver sind das Minimum, damit etcd eine Mehrheit bilden kann. Braucht einen Lastverteiler vor den API-Servern.|Three control-plane nodes are the minimum for etcd to form a majority. Requires a load balancer in front of the API servers."},
  {k:"workers", t:"number", l:"Anzahl Worker|Number of workers", ph:"3", half:true},
  {k:"podCidr", t:"text", l:"Pod-Netz|Pod network", ph:"10.244.0.0/16", half:true,
   hint:"Darf sich mit keinem Netz überschneiden, das die Knoten sonst benutzen.|Must not overlap with any network the nodes already use."},
  {k:"svcCidr", t:"text", adv:true, l:"Service-Netz|Service network", ph:"10.96.0.0/12", half:true},
  {k:"singleNode", t:"bool", l:"Auch auf dem Hauptserver Pods zulassen|Run pods on the control plane too",
   hint:"Für Testcluster ohne eigene Worker. Entfernt den Taint, den kubeadm setzt.|For test clusters without separate workers. Removes the taint kubeadm sets."},
  {k:"firewall", t:"bool", l:"Firewall-Regeln mit ausgeben|Include firewall rules"}
];

const CNI_CIDR = {flannel:"10.244.0.0/16", calico:"192.168.0.0/16", cilium:"10.244.0.0/16"};

function clusterOpts(o){
  const cni = o.cni || "cilium";
  return {
    version: (o.version || "1.34").replace(/^v/, ""),
    os: o.os || "apt",
    runtime: o.runtime || "containerd",
    cni: cni,
    endpoint: (o.endpoint || "").trim(),
    ha: !!o.ha,
    workers: num(o.workers) === undefined ? 3 : num(o.workers),
    podCidr: (o.podCidr || "").trim() || CNI_CIDR[cni],
    svcCidr: (o.svcCidr || "").trim(),
    singleNode: !!o.singleNode,
    firewall: !!o.firewall
  };
}

/* Die Anleitung. Jeder Abschnitt sagt zuerst, auf welchem Rechner er auszuführen ist. */
function clusterGuide(raw){
  const o = clusterOpts(raw);
  const apt = o.os === "apt";
  /* Bei Hochverfuegbarkeit ist die Node-IP keine gueltige Antwort. */
  const noEndpoint = o.ha && !o.endpoint;
  const api = o.endpoint || (o.ha ? "STABILE-ADRESSE" : "IP-DES-HAUPTSERVERS");
  const out = [];
  const sec = (h, role, x) => { out.push(Object.assign({h:h, role:role, items:[], p:[], r:[]}, x)); };

  /* --- alle Knoten --- */
  const prep = [];
  prep.push({c:"sudo swapoff -a\nsudo sed -i '/ swap / s/^/#/' /etc/fstab",
    d:"Der kubelet startet nicht, solange Swap aktiv ist. Die zweite Zeile sorgt dafür, dass es auch nach einem Neustart aus bleibt.|The kubelet refuses to start while swap is on. The second line keeps it off across reboots."});
  prep.push({c:"cat <<'EOF' | sudo tee /etc/modules-load.d/k8s.conf\noverlay\nbr_netfilter\nEOF\nsudo modprobe overlay\nsudo modprobe br_netfilter",
    d:"Ohne br_netfilter sieht der Node den Verkehr zwischen Pods nicht, und keine NetworkPolicy greift.|Without br_netfilter the node cannot see traffic between pods and no network policy takes effect."});
  prep.push({c:"cat <<'EOF' | sudo tee /etc/sysctl.d/k8s.conf\nnet.bridge.bridge-nf-call-iptables  = 1\nnet.bridge.bridge-nf-call-ip6tables = 1\nnet.ipv4.ip_forward                 = 1\nEOF\nsudo sysctl --system",
    d:"Weiterleitung und Bridge-Filter dauerhaft einschalten.|Turns forwarding and bridge filtering on for good."});
  if (o.os === "dnf") prep.push({c:"sudo setenforce 0\nsudo sed -i 's/^SELINUX=enforcing$/SELINUX=permissive/' /etc/selinux/config",
    d:"SELinux auf permissive, sonst kommt der kubelet nicht an die Container-Verzeichnisse. Wer SELinux behalten will, braucht passende Policies statt dieses Schritts.|SELinux to permissive, otherwise the kubelet cannot reach the container directories. Keeping SELinux means writing matching policies instead of this step."});

  if (o.runtime === "containerd"){
    prep.push({c: apt
      ? "sudo apt-get update && sudo apt-get install -y containerd"
      : "sudo dnf install -y containerd",
      d:"Die Runtime, in der die Container tatsächlich laufen.|The runtime the containers actually run in."});
    prep.push({c:"sudo mkdir -p /etc/containerd\ncontainerd config default | sudo tee /etc/containerd/config.toml >/dev/null\nsudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml\nsudo systemctl restart containerd && sudo systemctl enable containerd",
      d:"Der wichtigste Schritt der ganzen Vorbereitung: containerd und kubelet müssen denselben cgroup-Treiber verwenden. Stimmt das nicht überein, startet kubeadm init scheinbar grundlos nicht durch.|The most important step of the whole preparation: containerd and the kubelet must use the same cgroup driver. If they disagree, kubeadm init stalls for no apparent reason."});
  } else {
    prep.push({c: apt
      ? "sudo apt-get update && sudo apt-get install -y cri-o\nsudo systemctl enable --now crio"
      : "sudo dnf install -y cri-o\nsudo systemctl enable --now crio",
      d:"CRI-O bringt den systemd-cgroup-Treiber bereits richtig eingestellt mit.|CRI-O ships with the systemd cgroup driver already set correctly."});
  }

  prep.push(apt
    ? {c:"sudo apt-get install -y apt-transport-https ca-certificates curl gpg\nsudo mkdir -p -m 755 /etc/apt/keyrings\ncurl -fsSL https://pkgs.k8s.io/core:/stable:/v" + o.version + "/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg\necho 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v" + o.version + "/deb/ /' | sudo tee /etc/apt/sources.list.d/kubernetes.list\nsudo apt-get update\nsudo apt-get install -y kubelet kubeadm kubectl\nsudo apt-mark hold kubelet kubeadm kubectl",
       d:"Die Paketquelle ist an die Minor-Version gebunden — für ein späteres Upgrade auf " + o.version + "+1 muss sie umgeschrieben werden. apt-mark hold verhindert, dass ein beiläufiges apt upgrade den Cluster mitreißt.|The repository is tied to the minor version — a later upgrade past " + o.version + " means rewriting it. apt-mark hold stops a casual apt upgrade from dragging the cluster along."}
    : {c:"cat <<'EOF' | sudo tee /etc/yum.repos.d/kubernetes.repo\n[kubernetes]\nname=Kubernetes\nbaseurl=https://pkgs.k8s.io/core:/stable:/v" + o.version + "/rpm/\nenabled=1\ngpgcheck=1\ngpgkey=https://pkgs.k8s.io/core:/stable:/v" + o.version + "/rpm/repodata/repomd.xml.key\nexclude=kubelet kubeadm kubectl cri-tools kubernetes-cni\nEOF\nsudo dnf install -y kubelet kubeadm kubectl --disableexcludes=kubernetes\nsudo systemctl enable --now kubelet",
       d:"exclude in der Repo-Datei hält die Pakete von einem beiläufigen dnf update fern.|The exclude line in the repo file keeps the packages away from a casual dnf update."});

  sec("Vorbereitung|Preparation", "all", {
    p:["Diese Schritte laufen unverändert auf **jedem** Rechner — Hauptserver wie Worker. Am schnellsten geht es, wenn du sie parallel auf allen Knoten ausführst.|These steps run identically on **every** machine — control plane and workers alike. Fastest is to run them on all nodes in parallel."],
    items:prep,
    r:[{lvl:"warn", m:t("Alle Knoten brauchen unterschiedliche Hostnamen, MAC-Adressen und product_uuid. Geklonte VMs teilen sich diese Werte oft — dann treten Knoten dem Cluster bei und verdrängen sich gegenseitig.|Every node needs a distinct hostname, MAC address and product_uuid. Cloned VMs often share these — then nodes join and displace each other.")}]
  });

  if (o.firewall) sec("Firewall|Firewall", "all", {
    p:["Nur nötig, wenn auf den Knoten eine Firewall läuft.|Only needed when a firewall runs on the nodes."],
    items:[
      {c:"# Hauptserver\nsudo firewall-cmd --permanent --add-port={6443,2379-2380,10250,10257,10259}/tcp",
       d:"API-Server, etcd, kubelet, Controller-Manager und Scheduler.|API server, etcd, kubelet, controller manager and scheduler."},
      {c:"# Worker\nsudo firewall-cmd --permanent --add-port={10250,30000-32767}/tcp",
       d:"kubelet und der NodePort-Bereich.|The kubelet and the NodePort range."},
      {c:"# " + (o.cni === "calico" ? "Calico" : o.cni === "flannel" ? "Flannel" : "Cilium") + "\nsudo firewall-cmd --permanent --add-port=" +
         (o.cni === "calico" ? "179/tcp --permanent --add-port=4789/udp" : o.cni === "cilium" ? "8472/udp --permanent --add-port=4240/tcp" : "8472/udp") +
         "\nsudo firewall-cmd --reload",
       d:"Das Overlay-Netz des CNI. Fehlen diese Ports, sind Pods auf demselben Node erreichbar und über Node-Grenzen hinweg nicht — ein Fehlerbild, das lange in die Irre führt.|The CNI's overlay network. Without these ports pods reach each other on the same node but not across nodes — a symptom that misleads for a long time."}
    ]
  });

  /* --- erster Hauptserver --- */
  const initCmd = ["sudo kubeadm init",
    "  --pod-network-cidr=" + o.podCidr,
    o.svcCidr ? "  --service-cidr=" + o.svcCidr : "",
    (o.endpoint || o.ha) ? "  --control-plane-endpoint=" + api + ":6443" : "",
    o.ha ? "  --upload-certs" : "",
    "  --kubernetes-version=v" + o.version + ".0"
  ].filter(Boolean).join(" \\\n");

  const cp = [{c:initCmd,
    d:"Legt etcd, API-Server, Controller-Manager und Scheduler an. Am Ende gibt der Befehl die Beitrittsbefehle aus — **diese Ausgabe aufheben**, sie enthält Token und Prüfsumme.|Creates etcd, the API server, the controller manager and the scheduler. At the end it prints the join commands — **keep that output**, it contains the token and the checksum."}];
  cp.push({c:"mkdir -p $HOME/.kube\nsudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config\nsudo chown $(id -u):$(id -g) $HOME/.kube/config",
    d:"Erst danach funktioniert kubectl als normaler Benutzer.|Only after this does kubectl work as an ordinary user."});

  if (o.cni === "cilium") cp.push({c:"CILIUM_CLI=v0.16.16   # aktuelle Version aus den Release Notes\ncurl -sL --fail --remote-name-all https://github.com/cilium/cilium-cli/releases/download/${CILIUM_CLI}/cilium-linux-amd64.tar.gz\nsudo tar xzvfC cilium-linux-amd64.tar.gz /usr/local/bin\ncilium install\ncilium status --wait",
    d:"Ohne CNI bleiben alle Knoten NotReady und die CoreDNS-Pods hängen in Pending. Das ist kein Fehler, sondern der normale Zwischenstand.|Without a CNI every node stays NotReady and the CoreDNS pods sit in Pending. That is not a fault, it is the normal intermediate state."});
  if (o.cni === "calico") cp.push({c:"CALICO=v3.29.1   # aktuelle Version aus den Release Notes\nkubectl apply -f https://raw.githubusercontent.com/projectcalico/calico/${CALICO}/manifests/calico.yaml",
    d:"Calico übernimmt das Pod-Netz und bringt NetworkPolicy gleich mit. Das Pod-Netz muss zu dem passen, das oben bei kubeadm init steht.|Calico takes over the pod network and brings network policy with it. The pod network has to match the one given to kubeadm init above."});
  if (o.cni === "flannel") cp.push({c:"kubectl apply -f https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml",
    d:"Flannel erwartet zwingend 10.244.0.0/16 als Pod-Netz. Flannel kennt keine NetworkPolicy — dafür braucht es später zusätzlich Calico oder Cilium.|Flannel insists on 10.244.0.0/16 as the pod network. Flannel has no network policy — that needs Calico or Cilium alongside it later."});

  if (o.singleNode) cp.push({c:"kubectl taint nodes --all node-role.kubernetes.io/control-plane-",
    d:"Nimmt den Taint weg, mit dem kubeadm normale Arbeitslast vom Hauptserver fernhält. Für einen Testcluster richtig, für Produktion nicht.|Removes the taint with which kubeadm keeps ordinary workloads off the control plane. Right for a test cluster, not for production."});

  sec("Erster Hauptserver|First control-plane node", "cp", {
    p:["Ab hier unterscheiden sich die Rechner. Diese Schritte laufen **nur auf dem ersten Hauptserver**.|From here the machines differ. These steps run **only on the first control-plane node**."],
    items:cp,
    r:(noEndpoint ? [{lvl:"err", m:t("Fuer mehrere Hauptserver ist --control-plane-endpoint zwingend. Ohne ihn schreibt kubeadm keinen controlPlaneEndpoint in die Cluster-Konfiguration, und jeder weitere Hauptserver scheitert an der Meldung unable to add a new control plane instance to a cluster that doesn't have a stable controlPlaneEndpoint address. Nachtraeglich aendern heisst im Zweifel: Cluster zuruecksetzen und neu aufsetzen. Trag die Adresse oben ein, bevor du anfaengst.|For several control-plane nodes, --control-plane-endpoint is mandatory. Without it kubeadm writes no controlPlaneEndpoint into the cluster configuration, and every further control-plane node fails with unable to add a new control plane instance to a cluster that doesn't have a stable controlPlaneEndpoint address. Changing it afterwards usually means resetting the cluster and starting over. Enter the address above before you begin.")}] : [])
      .concat(o.endpoint ? [{lvl:"warn", m:t("Die Adresse muss auf allen Knoten aufloesen, bevor du anfaengst — notfalls ueber /etc/hosts. Nimm einen Namen statt einer IP: Der Name wandert spaeter auf einen Lastverteiler oder eine VIP, ohne dass Zertifikate neu ausgestellt werden muessen.|The address has to resolve on every node before you begin — an entry in /etc/hosts will do. Use a name rather than an IP: the name can later move to a load balancer or a VIP without reissuing certificates.")}] : [])
      .concat(o.ha ? [] : [{lvl:"warn", m:t("Ein einzelner Hauptserver ist keine Hochverfügbarkeit: Fällt er aus, ist die API weg und nichts lässt sich mehr ändern. Bereits laufende Pods laufen weiter, aber niemand ersetzt sie.|A single control-plane node is not high availability: if it fails the API is gone and nothing can be changed. Pods already running keep running, but nobody replaces them.")}])
  });

  /* --- woher die Platzhalter kommen --- */
  const join = [
    {c:"kubeadm token create --print-join-command",
     d:"Der bequemste Weg: Dieser Befehl erzeugt ein frisches Token und gibt den vollständigen Beitrittsbefehl aus — Token und Hash schon eingesetzt. Ausgabe auf dem Worker einfügen, fertig. Für einen weiteren Hauptserver hängst du an diese Zeile noch --control-plane --certificate-key an.|The most convenient way: this creates a fresh token and prints the complete join command — token and hash already filled in. Paste the output on the worker and you are done. For another control-plane node, append --control-plane --certificate-key to that line."},
    {c:"kubeadm token list",
     d:"Zeigt die vorhandenen Token mit ihrer Restlaufzeit in der Spalte TTL. Ist die Liste leer, ist das Token aus der Installation abgelaufen — dann hilft nur der Befehl darüber.|Lists the existing tokens with their remaining lifetime in the TTL column. An empty list means the token from the installation has expired — then only the command above helps."},
    {c:"openssl x509 -pubkey -in /etc/kubernetes/pki/ca.crt \\\n  | openssl rsa -pubin -outform der 2>/dev/null \\\n  | openssl dgst -sha256 -hex | sed 's/^.* //'",
     d:"Nur den Hash nachschlagen, falls das Token noch gilt. Er ist der Fingerabdruck der Cluster-CA und ändert sich nie, solange der Cluster derselbe bleibt — du kannst ihn dir also einmal aufschreiben.|Look up just the hash, in case the token is still valid. It is the fingerprint of the cluster CA and never changes as long as the cluster stays the same — so you can write it down once."}
  ];
  if (o.ha) join.push({c:"sudo kubeadm init phase upload-certs --upload-certs",
    d:"Lädt die Zertifikate erneut in das Secret kubeadm-certs im Namespace kube-system und gibt einen neuen certificate-key aus. Nötig für jeden weiteren Hauptserver, der später als zwei Stunden nach der Installation dazukommt.|Uploads the certificates into the kubeadm-certs secret in namespace kube-system again and prints a new certificate key. Needed for every additional control-plane node joining later than two hours after the installation."});

  sec("Beitrittsdaten besorgen|Getting the join values", "cp", {
    p:["Die Platzhalter in den folgenden Befehlen stammen alle aus der Ausgabe von `kubeadm init`. Ist die verloren, holst du sie hier — **auf dem ersten Hauptserver**, nicht auf dem Rechner, der beitreten soll.|The placeholders in the commands below all come from the output of `kubeadm init`. If that is lost, this is where you get them — **on the first control-plane node**, not on the machine that wants to join.",
       "`<TOKEN>` ist ein Einmalkennwort und gilt 24 Stunden. `<HASH>` ist der Fingerabdruck der Cluster-CA und ändert sich nie." +
       (o.ha ? " `<KEY>` entschlüsselt die hochgeladenen Zertifikate und gilt nur zwei Stunden." : "") +
       "|`<TOKEN>` is a one-time password and lasts 24 hours. `<HASH>` is the fingerprint of the cluster CA and never changes." +
       (o.ha ? " `<KEY>` decrypts the uploaded certificates and lasts only two hours." : "")],
    items:join,
    r:[{lvl:"err", m:t("Der Hash ist keine Formsache: Ohne ihn — etwa mit --discovery-token-unsafe-skip-ca-verification — glaubt der beitretende Knoten jedem, der auf der Adresse antwortet, und übergibt sein Vertrauen an einen möglicherweise fremden API-Server.|The hash is not a formality: without it — for instance with --discovery-token-unsafe-skip-ca-verification — the joining node believes whoever answers on that address and hands its trust to a potentially foreign API server.")}]
  });

  /* --- weitere Hauptserver --- */
  if (o.ha) sec("Weitere Hauptserver|Further control-plane nodes", "cp", {
    p:["Auf dem zweiten und dritten Hauptserver — nicht auf den Workern.|On the second and third control-plane node — not on the workers.",
       "`<TOKEN>` und `<HASH>` wie beim Worker, dazu `<KEY>` aus dem Abschnitt **Beitrittsdaten besorgen**. Der Schlüssel ist der Grund, warum ein Hauptserver mehr braucht als ein Worker: Mit ihm holt sich der neue Knoten die Zertifikate der bestehenden CA, statt eine eigene anzulegen.|`<TOKEN>` and `<HASH>` as for a worker, plus `<KEY>` from the section **Getting the join values**. That key is why a control-plane node needs more than a worker: with it the new node fetches the certificates of the existing CA instead of creating its own."],
    items:[
      {c:"sudo kubeadm join " + api + ":6443 \\\n  --token <TOKEN> \\\n  --discovery-token-ca-cert-hash sha256:<HASH> \\\n  --control-plane --certificate-key <KEY>",
       d:"Genau der Befehl, den kubeadm init ausgegeben hat — mit --control-plane und dem Zertifikatsschlüssel. Fehlt dir die Ausgabe, setzt du ihn aus kubeadm token create --print-join-command und einem frischen certificate-key selbst zusammen.|Exactly the command kubeadm init printed — with --control-plane and the certificate key. If you no longer have that output, assemble it yourself from kubeadm token create --print-join-command plus a fresh certificate key."},
      {c:"sudo kubeadm init phase upload-certs --upload-certs",
       d:"Der Zertifikatsschlüssel läuft nach zwei Stunden ab. Dieser Befehl auf dem **ersten** Hauptserver erzeugt einen neuen und gibt ihn als letzte Zeile aus.|The certificate key expires after two hours. Run this on the **first** control-plane node to create a new one; it prints it as the last line."}
    ],
    r:[{lvl:"warn", m:t("Drei Hauptserver, nicht zwei: etcd braucht eine Mehrheit. Mit zwei Knoten steht der Cluster, sobald einer ausfällt — schlechter als mit einem einzelnen.|Three control-plane nodes, not two: etcd needs a majority. With two nodes the cluster stops as soon as one fails — worse than with a single one.")}]
  });

  /* --- Notausgang, wenn der Endpoint fehlt --- */
  if (o.ha) sec("Wenn der Endpoint fehlt|If the endpoint is missing", "cp", {
    p:["Steht der Cluster bereits und `kubeadm init` lief ohne `--control-plane-endpoint`, scheitert jeder weitere Hauptserver mit *unable to add a new control plane instance to a cluster that doesn't have a stable controlPlaneEndpoint address*. Nachrüsten hiesse: ConfigMap kubeadm-config ändern, das API-Server-Zertifikat mit neuem SAN ausstellen und alle vier kubeconfig-Dateien umschreiben. Bei einem frischen Cluster ist Zurücksetzen schneller und sicherer.|If the cluster is already up and `kubeadm init` ran without `--control-plane-endpoint`, every further control-plane node fails with *unable to add a new control plane instance to a cluster that doesn't have a stable controlPlaneEndpoint address*. Retrofitting means editing the kubeadm-config ConfigMap, reissuing the API server certificate with a new SAN and rewriting all four kubeconfig files. On a fresh cluster, resetting is faster and safer."],
    items:[
      {c:"kubectl -n kube-system get cm kubeadm-config -o yaml | grep -i controlPlaneEndpoint",
       d:"Zuerst nachsehen. Kommt keine Zeile zurück, fehlt der Endpoint — dann gilt der Rest dieses Abschnitts.|Check first. If no line comes back, the endpoint is missing and the rest of this section applies."},
      {c:"sudo kubeadm reset -f\nsudo rm -rf /etc/cni/net.d $HOME/.kube/config",
       d:"Auf **jedem** Knoten, der schon beigetreten ist, und zuletzt auf dem ersten Hauptserver. Bei einem Cluster, in dem noch nichts läuft, ist das der ehrlichste Weg zurück auf Anfang.|On **every** node that has already joined, and last on the first control-plane node. For a cluster with nothing running on it yet, this is the honest way back to the start."},
      {c:"echo '" + (o.endpoint ? "192.168.0.10 " + o.endpoint : "192.168.0.10 k8s-api.firma.de") + "' | sudo tee -a /etc/hosts",
       d:"Auf allen Knoten, solange es keinen DNS-Eintrag gibt: Die IP ist vorerst der erste Hauptserver. Später zeigt derselbe Name auf den Lastverteiler oder eine VIP — und weil sich nur die Auflösung ändert, bleiben die Zertifikate gültig.|On every node as long as there is no DNS record: the IP is the first control-plane node for now. Later the same name points at the load balancer or a VIP — and because only the resolution changes, the certificates stay valid."},
      {c:initCmd,
       d:"Neu aufsetzen, diesmal mit Endpoint. Danach greifen die Beitrittsbefehle wie beschrieben.|Set up again, this time with the endpoint. After that the join commands work as described."}
    ],
    r:[{lvl:"warn", m:t("Zeigt der Endpoint auf die IP eines einzelnen Hauptservers, laesst kubeadm zwar weitere Master zu — hochverfuegbar ist der Cluster damit trotzdem nicht, weil die Adresse mit genau dieser Maschine steht und faellt.|If the endpoint points at a single control-plane node's IP, kubeadm does allow further masters — but the cluster is still not highly available, because the address lives and dies with that one machine.")}]
  });

  /* --- Worker --- */
  sec("Auf jedem Worker|On every worker", "worker", {
    p:[(o.workers ? "Auf allen " + o.workers + " Workern" : "Auf jedem Worker") + " — nach der Vorbereitung ganz oben, aber ohne die Schritte des Hauptservers.|" +
       (o.workers ? "On all " + o.workers + " workers" : "On every worker") + " — after the preparation above, but without any of the control-plane steps."],
    items:[
      {c:"sudo kubeadm join " + api + ":6443 \\\n  --token <TOKEN> \\\n  --discovery-token-ca-cert-hash sha256:<HASH>",
       d:"Der Befehl aus der Ausgabe von kubeadm init, ohne --control-plane. `<TOKEN>` und `<HASH>` kommen aus dem Abschnitt **Beitrittsdaten besorgen** — dort steht auch, wie du sie neu erzeugst.|The command from the kubeadm init output, without --control-plane. `<TOKEN>` and `<HASH>` come from the section **Getting the join values**, which also shows how to create them anew."}
    ],
    r:[{lvl:"err", m:t("kubectl gehört nicht auf die Worker und die admin.conf schon gar nicht. Wer sie dorthin kopiert, gibt jedem mit Zugang zum Worker die volle Kontrolle über den Cluster.|kubectl does not belong on the workers and admin.conf certainly does not. Copying it there hands anyone with access to that worker full control of the cluster.")}]
  });

  /* --- Prüfen --- */
  sec("Prüfen|Checking", "cp", {
    p:["Auf dem Hauptserver, sobald alle Knoten beigetreten sind.|On the control-plane node, once every node has joined."],
    items:[
      {c:"kubectl get nodes -o wide",
       d:"Alle Knoten müssen Ready sein. NotReady direkt nach dem Beitritt ist normal, solange das CNI seine Pods noch verteilt.|Every node has to be Ready. NotReady right after joining is normal while the CNI is still distributing its pods."},
      {c:"kubectl get pods -A",
       d:"CoreDNS ist der beste Anzeiger: Läuft es, funktioniert das Pod-Netz.|CoreDNS is the best indicator: if it runs, the pod network works."},
      {c:"kubectl run probe --image=nginx:1.27-alpine --restart=Never --rm -it -- sh",
       d:"Ein Pod von Hand, um den Weg von der Registry bis in den Container einmal zu gehen.|A pod by hand, to walk the path from the registry into the container once."}
    ]
  });

  sec("Danach|Afterwards", "cp", {
    p:["Ein frischer Cluster kann noch nichts von außen annehmen und keinen Speicher bereitstellen. Diese drei Dinge fehlen praktisch immer.|A fresh cluster can neither accept anything from outside nor provide storage. These three are missing practically every time."],
    items:[
      {c:"kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/baremetal/deploy.yaml",
       d:"Ein Ingress-Controller, sonst bleibt jeder Ingress wirkungslos. Auf eigener Hardware ist zusätzlich MetalLB nötig, damit ein Service vom Typ LoadBalancer eine Adresse bekommt.|An ingress controller, otherwise every Ingress stays inert. On your own hardware you also need MetalLB so a LoadBalancer service gets an address."},
      {c:"kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml",
       d:"Ohne metrics-server liefert kubectl top nichts und ein HorizontalPodAutoscaler skaliert nie.|Without metrics-server, kubectl top returns nothing and a HorizontalPodAutoscaler never scales."},
      {c:"# StorageClass: auf eigener Hardware etwa Longhorn oder der local-path-provisioner",
       d:"Ohne StorageClass bleibt jedes PersistentVolumeClaim für immer Pending.|Without a storage class every PersistentVolumeClaim stays Pending forever."}
    ],
    r:[{lvl:"warn", m:t("Beim Upgrade immer nur eine Minor-Version auf einmal, und kubeadm zuerst. kubelet darf höchstens eine Minor-Version hinter dem API-Server liegen, niemals davor.|When upgrading, only one minor version at a time, and kubeadm first. The kubelet may trail the API server by at most one minor version, and must never lead it.")}]
  });

  return out;
}

let CLUSTER = {};

const CLUSTER_ROLE = {
  all:  "auf allen Knoten|on every node",
  cp:   "nur Hauptserver|control plane only",
  worker:"nur Worker|workers only"
};

function renderClusterFields(){
  let h = "";
  CLUSTER_FIELDS.filter(f => !SHORT || !f.adv).forEach(f => {
    const v = CLUSTER[f.k] === undefined ? "" : CLUSTER[f.k];
    const cls = f.half ? "f f--in" : "f";
    const hint = f.hint ? '<span class="hint">' + esc(t(f.hint)) + "</span>" : "";
    if (f.t === "bool"){
      h += '<div class="f"><label class="check"><input type="checkbox" data-cl="' + f.k + '"' +
        (f.structural ? ' data-clstruct="1"' : "") + (v ? " checked" : "") + "><span>" + esc(t(f.l)) + "</span></label>" + hint + "</div>";
    } else if (f.t === "select"){
      h += '<div class="' + cls + '"><label>' + esc(t(f.l)) + '</label><select data-cl="' + f.k + '"' +
        (f.structural ? ' data-clstruct="1"' : "") + ">";
      f.opts.forEach(op => { h += '<option value="' + esc(op[0]) + '"' +
        (String(v) === op[0] ? " selected" : "") + ">" + esc(t(op[1])) + "</option>"; });
      h += "</select>" + hint + "</div>";
    } else {
      /* Das Pod-Netz hängt am CNI — der Platzhalter muss mitziehen. */
      const ph = f.k === "podCidr" ? CNI_CIDR[CLUSTER.cni || "cilium"] : (f.ph ? t(f.ph) : "");
      h += '<div class="' + cls + '"><label>' + esc(t(f.l)) + '</label><input type="' +
        (f.t === "number" ? "number" : "text") + '" data-cl="' + f.k + '" value="' + esc(v) +
        '" placeholder="' + esc(ph) + '">' + hint + "</div>";
    }
  });
  $("clusterFields").innerHTML = h;
}

function renderClusterOut(){
  let h = "";
  clusterGuide(CLUSTER).forEach((s, i) => {
    h += '<div class="cstep"><p class="hgroup">' + String(i+1).padStart(2,"0") + " · " + esc(t(s.h)) +
         '<span class="crole crole--' + s.role + '">' + esc(t(CLUSTER_ROLE[s.role])) + "</span></p>";
    (s.p||[]).forEach(x => { h += "<p>" + mdInline(t(x)) + "</p>"; });
    if ((s.r||[]).length)
      h += '<div class="crisks">' + s.r.map(x =>
        '<p class="crisk crisk--' + x.lvl + '"><b>' + (x.lvl === "err" ? "!" : "?") + "</b>" + esc(x.m) + "</p>").join("") + "</div>";
    h += '<div class="wikiitems">' + (s.items||[]).map(it =>
      '<div class="wikiitem"><button class="cmd cmd--big" data-cmd="' + esc(it.c) + '"><span>' +
      esc(it.c) + "</span></button><p>" + mdInline(t(it.d)) + "</p></div>").join("") + "</div></div>";
  });
  $("clusterOut").innerHTML = h;
}

function clusterMarkdown(){
  const o = clusterOpts(CLUSTER), de = LANG === "de";
  let m = "# " + (de ? "Kubernetes-Cluster aufsetzen" : "Setting up a Kubernetes cluster") + "\n\n";
  m += "| " + (de ? "Angabe" : "Setting") + " | " + (de ? "Wert" : "Value") + " |\n|---|---|\n";
  [[de?"Version":"Version", "v" + o.version],
   [de?"Betriebssystem":"Operating system", o.os === "apt" ? "Debian / Ubuntu" : "RHEL / Rocky"],
   ["Runtime", o.runtime === "crio" ? "CRI-O" : "containerd"],
   ["CNI", o.cni],
   [de?"API-Adresse":"API address", o.endpoint || (de?"IP des ersten Hauptservers":"first control-plane node's IP")],
   [de?"Hauptserver":"Control-plane nodes", o.ha ? "3" : "1"],
   ["Worker", String(o.workers)],
   [de?"Pod-Netz":"Pod network", o.podCidr]
  ].forEach(r => { m += "| " + r[0] + " | `" + r[1] + "` |\n"; });
  m += "\n";
  clusterGuide(CLUSTER).forEach((s, i) => {
    m += "## " + (i+1) + ". " + t(s.h) + " — " + t(CLUSTER_ROLE[s.role]) + "\n\n";
    (s.p||[]).forEach(x => { m += t(x) + "\n\n"; });
    (s.r||[]).forEach(x => { m += "> **" + (x.lvl === "err" ? "Achtung" : "Hinweis") + "** — " + x.m + "\n\n"; });
    (s.items||[]).forEach(it => { m += "```sh\n" + it.c + "\n```\n\n" + t(it.d) + "\n\n"; });
  });
  return m;
}

function renderCluster(){ renderClusterFields(); renderClusterOut(); }

$("clusterBtn").addEventListener("click", () => {
  if (togglePanel("clusterPanel")) renderCluster();
});
$("clusterClose").addEventListener("click", () => { $("clusterPanel").hidden = true; });
$("clusterFields").addEventListener("input", e => {
  if (!e.target.dataset.cl) return;
  CLUSTER[e.target.dataset.cl] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
  renderClusterOut();
});
$("clusterFields").addEventListener("change", e => {
  if (!e.target.dataset.cl) return;
  CLUSTER[e.target.dataset.cl] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
  if (e.target.dataset.clstruct) renderClusterFields();
  renderClusterOut();
});
$("clusterOut").addEventListener("click", e => {
  const b = e.target.closest("button[data-cmd]");
  if (!b) return;
  copyText(b.dataset.cmd);
  const s = b.querySelector("span"), old = s.textContent;
  s.textContent = t(UI.copied);
  setTimeout(()=>{ s.textContent = old; }, 1000);
});
$("clusterMd").addEventListener("click", () => {
  download(clusterMarkdown(), "cluster-installation.md", "text/markdown");
});

function searchIndex(){
  const idx = [];
  Object.keys(RES).forEach(kind => {
    const r = RES[kind];
    const label = r.label ? t(r.label) : kind;
    idx.push({g:"res", title:label, sub:t(r.desc), text:label + " " + kind + " " + t(r.desc),
      act:{type:"res", kind:kind}});
    if (r.best) idx.push({g:"best", title:label, sub:t(UI.best),
      text:label + " " + kind + " " + r.best.map(t).join(" "),
      body:r.best.map(x => t(x).replace(/[`*]/g, "")).join(" · "),
      act:{type:"res", kind:kind}});
    r.steps.forEach((st, si) => {
      st.fields.forEach(f => {
        const w = f.why || WHY[kind + "." + f.k] || WHY[f.k];
        const hint = f.hint ? t(f.hint) : "";
        idx.push({g:"field", title:t(f.l), sub:label + " › " + t(st.title),
          text:[t(f.l), f.k, hint, w ? t(w) : ""].join(" "),
          body:w ? t(w) : hint,
          act:{type:"field", kind:kind, step:si, field:f.k}});
      });
    });
  });
  KUBECTL.forEach(sec => sec.items.forEach(it => {
    idx.push({g:"cmd", title:it.c, sub:t(sec.g), text:it.c + " " + t(it.d), body:t(it.d),
      act:{type:"cmd", q:it.c.split(" ").slice(0,3).join(" ")}});
  }));
  CMDTASKS.forEach(x => {
    idx.push({g:"task", title:t(x.l), sub:t(x.d), text:t(x.l) + " " + t(x.d) + " " + x.id,
      act:{type:"task", id:x.id}});
  });
  STORAGE_WIKI.forEach((sec, i) => {
    const body = (sec.p||[]).concat(sec.p2||[]).map(t).join(" ");
    const tbl = (sec.table||[]).map(r => r.map(t).join(" ")).join(" ");
    idx.push({g:"wiki", title:t(sec.h), sub:LANG === "de" ? "Speicher" : "Storage",
      text:t(sec.h) + " " + body + " " + tbl, body:body.slice(0, 220),
      act:{type:"wiki", i:i}});
  });
  CHEATSHEET.forEach((sec, i) => {
    const body = (sec.p||[]).concat(sec.p2||[]).map(t).join(" ");
    const tbl = (sec.table||[]).map(r => r.map(t).join(" ")).join(" ");
    idx.push({g:"cheat", title:t(sec.h), sub:LANG === "de" ? "Spickzettel" : "Cheat sheet",
      text:[t(sec.h), body, tbl, sec.code ? t(sec.code) : ""].join(" "),
      body:(body || tbl).slice(0, 220),
      act:{type:"cheat", i:i}});
  });
  return idx;
}

const SEARCH_GROUPS = {
  res:"Ressourcen|Resources", field:"Felder und Erklärungen|Fields and explanations",
  cmd:"kubectl-Befehle|kubectl commands", task:"Befehls-Assistent|Command builder",
  wiki:"Speicher-Wiki|Storage wiki", cheat:"Spickzettel|Cheat sheet",
  best:"Best Practices|Best practices"
};

let SEARCH_HITS = [];
function renderSearch(){
  const q = $("searchInput").value.trim().toLowerCase();
  if (q.length < 2){ $("searchResults").innerHTML = ""; SEARCH_HITS = []; return; }
  const terms = q.split(/\s+/);
  SEARCH_HITS = searchIndex()
    .map(x => {
      const hay = x.text.toLowerCase();
      if (!terms.every(tm => hay.indexOf(tm) !== -1)) return null;
      let score = 0;
      terms.forEach(tm => { if (x.title.toLowerCase().indexOf(tm) !== -1) score += 3; });
      return {x:x, score:score};
    })
    .filter(Boolean).sort((a,b) => b.score - a.score).slice(0, 40).map(h => h.x);

  if (!SEARCH_HITS.length){
    $("searchResults").innerHTML = '<p class="empty">' + (LANG === "de" ? "Nichts gefunden." : "Nothing found.") + "</p>";
    return;
  }
  let h = "";
  Object.keys(SEARCH_GROUPS).forEach(g => {
    const rows = SEARCH_HITS.filter(x => x.g === g);
    if (!rows.length) return;
    h += '<p class="hgroup">' + esc(t(SEARCH_GROUPS[g])) + "</p><div class=\"sresults\">";
    rows.forEach(x => {
      const n = SEARCH_HITS.indexOf(x);
      h += '<button class="sresult" data-hit="' + n + '"><b>' + esc(x.title) + "</b>" +
           '<i>' + esc(x.sub || "") + "</i>" +
           (x.body ? "<p>" + esc(x.body.slice(0, 190)) + (x.body.length > 190 ? "…" : "") + "</p>" : "") +
           "</button>";
    });
    h += "</div>";
  });
  $("searchResults").innerHTML = h;
}

function goSearchHit(hit){
  const a = hit.act;
  $("searchPanel").hidden = true;
  if (a.type === "res"){ startRes(a.kind); return; }
  if (a.type === "field"){
    const at = S.docs.map((e, i) => e.kind === a.kind ? i : -1).filter(i => i >= 0);
    if (at.length){ startEdit(at[0], a.field); return; }
    startRes(a.kind);
    if (!fieldVisible((RES[a.kind].steps[a.step].fields.filter(f => f.k === a.field)[0]||{}), S.current.data)) SHORT = false;
    S.step = a.step; renderForm(); refreshYaml();
    const el = $("form").querySelector('[data-k="' + a.field + '"], [data-kv="' + a.field + '"], [data-list="' + a.field + '"]');
    if (el) el.focus();
    return;
  }
  if (a.type === "cmd"){
    $("wikiPanel").hidden = false; setWikiTab("ref");
    $("wikiFilter").value = a.q; renderWiki(); $("wikiFilter").focus(); return;
  }
  if (a.type === "task"){
    $("wikiPanel").hidden = false; setWikiTab("build");
    CMD.task = a.id; CMD.o = defaultsForCmd(); renderCmdAll(); return;
  }
  if (a.type === "wiki"){
    $("wikiPanel").hidden = false; setWikiTab("storage");
    const sec = $("storageWiki").children[a.i];
    if (sec) sec.scrollIntoView({behavior:"smooth", block:"start"});
    return;
  }
  if (a.type === "cheat"){
    $("wikiPanel").hidden = false; setWikiTab("cheat");
    const sec = $("cheatWiki").children[a.i];
    if (sec) sec.scrollIntoView({behavior:"smooth", block:"start"});
  }
}

$("searchResults").addEventListener("click", e => {
  const b = e.target.closest("button[data-hit]");
  if (b) goSearchHit(SEARCH_HITS[+b.dataset.hit]);
});
$("searchInput").addEventListener("input", renderSearch);
function openSearch(){
  closePanels("searchPanel");
  $("searchPanel").hidden = false;
  $("searchInput").select();
  $("searchInput").focus();
}
$("searchBtn").addEventListener("click", () => {
  if ($("searchPanel").hidden) openSearch(); else $("searchPanel").hidden = true;
});
$("searchClose").addEventListener("click", () => { $("searchPanel").hidden = true; });

let THEME = null;
function systemDark(){
  return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
}
function applyTheme(){
  const dark = THEME === null ? systemDark() : THEME === "dark";
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  $("themeBtn").textContent = dark ? "☾" : "☀";
  $("themeBtn").setAttribute("aria-label", dark ? "Helles Design" : "Dunkles Design");
}
$("themeBtn").addEventListener("click", () => {
  const dark = THEME === null ? systemDark() : THEME === "dark";
  THEME = dark ? "light" : "dark";
  applyTheme();
});
if (window.matchMedia){
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => { if (THEME === null) applyTheme(); };
  if (mq.addEventListener) mq.addEventListener("change", onChange);
  else if (mq.addListener) mq.addListener(onChange);
}
applyTheme();

function setLang(l){
  LANG = l;
  document.documentElement.lang = l;
  $("langDe").setAttribute("aria-pressed", l === "de");
  $("langEn").setAttribute("aria-pressed", l === "en");
  $("offlineNote").textContent = l === "de" ? "offline · kein serverkontakt" : "offline · no server calls";
  $("resetAll").textContent = l === "de" ? "Zurücksetzen" : "Reset";
  $("saveBtn").textContent = l === "de" ? "Speichern" : "Save";
  $("loadBtn").textContent = l === "de" ? "Laden" : "Load";
  $("explainBtn").textContent = l === "de" ? "Erklärungen" : "Explain";
  $("wikiBtn").textContent = "kubectl";
  $("tabRef").textContent = l === "de" ? "Nachschlagen" : "Reference";
  $("tabBuild").textContent = l === "de" ? "Zusammenbauen" : "Builder";
  $("tabStorage").textContent = l === "de" ? "Speicher" : "Storage";
  $("tabCheat").textContent = l === "de" ? "Spickzettel" : "Cheat sheet";
  $("cheatPrint").textContent = l === "de" ? "drucken" : "print";
  $("testBtn").textContent = l === "de" ? "tests" : "tests";
  $("testEyebrow").textContent = l === "de" ? "Selbsttests" : "Self-tests";
  $("searchBtn").textContent = l === "de" ? "Suche" : "Search";
  $("searchEyebrow").textContent = l === "de" ? "Suche" : "Search";
  $("searchDesc").textContent = l === "de"
    ? "Durchsucht Ressourcen, Feldnamen, Erklärungen, kubectl-Befehle und das Speicher-Wiki. Strg+K öffnet dieses Feld."
    : "Searches resources, field names, explanations, kubectl commands and the storage wiki. Ctrl+K opens this field.";
  $("testDesc").textContent = l === "de"
    ? "Zusicherungen gegen Emitter, Ressourcen und Prüfungen. Nach eigenen Änderungen an dieser Datei ausführen — was hier rot wird, ist beim Bearbeiten kaputtgegangen."
    : "Assertions against the emitter, the resources and the checks. Run after editing this file yourself — whatever turns red here broke while you were changing it.";
  $("docBtn").textContent = l === "de" ? "doku" : "docs";
  $("clusterBtn").textContent = l === "de" ? "Cluster" : "Cluster";
  $("clusterEyebrow").textContent = l === "de" ? "Cluster aufsetzen" : "Set up a cluster";
  $("clusterMd").textContent = l === "de" ? "Anleitung herunterladen" : "Download the guide";
  $("clusterDesc").textContent = l === "de"
    ? "Erzeugt eine Anleitung mit kubeadm, getrennt danach, was auf jedem Knoten, was nur auf dem Hauptserver und was nur auf den Workern zu tun ist. Klick kopiert den Befehl."
    : "Builds a kubeadm guide, separated into what runs on every node, what only on the control plane and what only on the workers. Click copies the command.";
  if (!$("clusterPanel").hidden) renderCluster();
  profileTexts();
  setWikiTab(WIKI_TAB);
  render();
}
$("langDe").addEventListener("click", ()=>setLang("de"));
$("langEn").addEventListener("click", ()=>setLang("en"));

setLang("de");