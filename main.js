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
  : (de ? "Wie dauerhafter Speicher zusammenhängt, woran er in der Praxis scheitert — und wie du NFS, ZFS oder S3 konkret anbindest."
        : "How persistent storage fits together, where it fails in practice — and how to wire up NFS, ZFS or S3 concretely.");
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
   ["Daten nach Neustart weg|Data gone after a restart","emptyDir statt PVC, oder der Pfad liegt neben dem mountPath.|emptyDir instead of a PVC, or the path sits beside the mountPath."]]},

{h:"Welcher Speicher wofür|Which storage for what",
 p:["Die Frage ist nicht, welcher Speicher der beste ist, sondern was die Anwendung mit den Daten tut. Schreibt nur ein Pod, oder alle? Sind es viele kleine Änderungen oder wenige große Dateien? Braucht es Dateisystem-Semantik — Umbenennen, Anhängen, Sperren — oder reicht ablegen und wieder holen?|The question is not which storage is best but what the application does with the data. Does one pod write, or all of them? Many small changes or few large files? Does it need filesystem semantics — rename, append, lock — or is put-and-get enough?"],
 table:[["Art|Kind","Modus|Mode","Passt zu|Fits","Der Haken|The catch"],
   ["Lokale Platte, ZFS am Node|Local disk, ZFS on the node","ReadWriteOnce","Datenbanken, Etcd, alles mit eigener Replikation|Databases, etcd, anything that replicates itself","Der Pod klebt für immer an diesem einen Node.|The pod is pinned to that one node forever."],
   ["NFS","ReadWriteMany","Geteilte Verzeichnisse, Uploads, CI-Caches|Shared directories, uploads, CI caches","Ein Server für alle. Fällt er aus, hängen alle Pods. Sperren ist unzuverlässig.|One server for everyone. If it fails, every pod hangs. Locking is unreliable."],
   ["iSCSI, Blockspeicher|iSCSI, block storage","ReadWriteOnce","Datenbanken mit Anspruch an Latenz|Databases that care about latency","Braucht open-iscsi auf jedem Node und einen Treiber.|Needs open-iscsi on every node plus a driver."],
   ["S3, Objektspeicher|S3, object storage","kein PVC|no PVC","Bilder, Backups, Artefakte, Logs — groß und unveränderlich|Images, backups, artifacts, logs — large and immutable","Kein Dateisystem. Kein Umbenennen, kein Anhängen, kein Sperren.|Not a filesystem. No rename, no append, no locking."]],
 p2:["Die häufigste Fehlentscheidung ist, S3 als Verzeichnis einzuhängen, damit die Anwendung nicht angefasst werden muss. Das geht technisch und rächt sich später — siehe unten. Die zweithäufigste ist eine Datenbank auf NFS.|The most common wrong turn is mounting S3 as a directory so the application need not be touched. It works technically and bites later — see below. The second most common is a database on NFS."]},

{h:"NFS anbinden|Wiring up NFS",
 p:["NFS ist der kürzeste Weg zu ReadWriteMany, und für Heimlabore und kleine Cluster oft der richtige. Es gibt zwei Wege: ein PersistentVolume von Hand je Freigabe, oder einen Treiber, der für jedes PVC ein Unterverzeichnis anlegt.|NFS is the shortest route to ReadWriteMany and, for home labs and small clusters, often the right one. There are two routes: a hand-written PersistentVolume per share, or a driver that creates a subdirectory for every PVC."],
 table:[["Meldung|Message","Die Ursache|The cause"],
   ["bad option; … helper program","`nfs-common` fehlt auf dem Node, auf dem der Pod gerade landen soll.|`nfs-common` is missing on the node the pod happens to land on."],
   ["access denied by server","Die Node-IP steht nicht in /etc/exports, oder `exportfs -ra` fehlt.|The node IP is not in /etc/exports, or `exportfs -ra` was not run."],
   ["Permission denied im Container|Permission denied in the container","root_squash trifft auf einen Container, der als root schreiben will — oder falscher Besitzer.|root_squash meets a container that wants to write as root — or the wrong owner."],
   ["Pod bleibt Terminating, Node-Last steigt|Pod stays Terminating, node load climbs","NFS-Server weg. Ein `hard`-Mount wartet ewig, und genau das ist gewollt.|NFS server gone. A `hard` mount waits forever, and that is the point."],
   ["PVC bleibt Pending|PVC stays Pending","Beim Treiberweg: die Controller-Pods laufen nicht. `kubectl -n kube-system logs` ansehen.|On the driver route: the controller pods are not running. Read `kubectl -n kube-system logs`."]],
 steps:[
   {h:"Zuerst: die Nodes|First: the nodes", p:["Ohne den NFS-Client auf dem Node kann der kubelet nicht einhängen — und die Fehlermeldung sagt das nicht deutlich. Das gehört auf **jeden** Node, auch auf jeden, der später dazukommt.|Without the NFS client on the node the kubelet cannot mount — and the error message does not say so clearly. This belongs on **every** node, including every one added later."], code:{de:"# Debian / Ubuntu\nsudo apt-get install -y nfs-common\n# RHEL / Rocky / Alma\nsudo dnf install -y nfs-utils\n\n# von Hand prüfen, bevor Kubernetes ins Spiel kommt:\nshowmount -e 172.18.42.5\nsudo mount -t nfs4 172.18.42.5:/tank/k8s /mnt && sudo umount /mnt", en:"# Debian / Ubuntu\nsudo apt-get install -y nfs-common\n# RHEL / Rocky / Alma\nsudo dnf install -y nfs-utils\n\n# check by hand before Kubernetes gets involved:\nshowmount -e 172.18.42.5\nsudo mount -t nfs4 172.18.42.5:/tank/k8s /mnt && sudo umount /mnt"}},

   {h:"Auf dem NFS-Server|On the NFS server", p:["Die Freigabe muss das Knoten-Netz erlauben, nicht das Pod-Netz — es hängt der Node ein, nicht der Pod.|The export has to allow the node network, not the pod network — the node does the mounting, not the pod."], code:{de:"# /etc/exports\n/tank/k8s  172.18.42.0/24(rw,sync,no_subtree_check,no_root_squash)\n\nsudo exportfs -ra\nsudo exportfs -v          # zeigt, was wirklich freigegeben ist", en:"# /etc/exports\n/tank/k8s  172.18.42.0/24(rw,sync,no_subtree_check,no_root_squash)\n\nsudo exportfs -ra\nsudo exportfs -v          # shows what is actually exported"}},

   {h:"Weg 1 · ein PV von Hand|Route 1 · a PV by hand", p:["Kein Treiber, keine Installation. Du beschreibst die Freigabe einmal als PV und bindest ein PVC fest daran. `storageClassName: \"\"` muss in **beiden** stehen, sonst springt die Standard-Klasse ein und legt etwas ganz anderes an.|No driver, no installation. You describe the share once as a PV and bind a PVC to it. `storageClassName: \"\"` has to appear in **both**, otherwise the default class steps in and provisions something else entirely.",
      "Der Wizard baut dir das: Ressource **PersistentVolume**, Typ *nfs*. Das passende PVC entsteht gleich mit.|The wizard builds this for you: resource **PersistentVolume**, type *nfs*. The matching PVC comes with it."], code:{de:"apiVersion: v1\nkind: PersistentVolume\nmetadata:\n  name: pv-nfs-daten\nspec:\n  capacity:\n    storage: 50Gi          # bei NFS reine Buchhaltung, niemand erzwingt es\n  accessModes:\n    - ReadWriteMany\n  persistentVolumeReclaimPolicy: Retain\n  storageClassName: \"\"\n  mountOptions:\n    - hard\n    - nfsvers=4.1\n  nfs:\n    server: 172.18.42.5\n    path: /tank/k8s/daten\n---\napiVersion: v1\nkind: PersistentVolumeClaim\nmetadata:\n  name: daten\nspec:\n  accessModes:\n    - ReadWriteMany\n  storageClassName: \"\"\n  volumeName: pv-nfs-daten   # bindet genau dieses PV\n  resources:\n    requests:\n      storage: 50Gi", en:"apiVersion: v1\nkind: PersistentVolume\nmetadata:\n  name: pv-nfs-data\nspec:\n  capacity:\n    storage: 50Gi          # with NFS this is bookkeeping, nobody enforces it\n  accessModes:\n    - ReadWriteMany\n  persistentVolumeReclaimPolicy: Retain\n  storageClassName: \"\"\n  mountOptions:\n    - hard\n    - nfsvers=4.1\n  nfs:\n    server: 172.18.42.5\n    path: /tank/k8s/data\n---\napiVersion: v1\nkind: PersistentVolumeClaim\nmetadata:\n  name: data\nspec:\n  accessModes:\n    - ReadWriteMany\n  storageClassName: \"\"\n  volumeName: pv-nfs-data    # binds exactly this PV\n  resources:\n    requests:\n      storage: 50Gi"}},

   {h:"Weg 2 · ein Treiber, der Verzeichnisse anlegt|Route 2 · a driver that creates directories", p:["Ab dem dritten Volume lohnt sich der Treiber. Danach ist ein PVC einfach ein PVC — der Treiber legt für jedes ein Unterverzeichnis auf der Freigabe an, ohne dass du ein PV schreibst.|From the third volume on, the driver pays off. After that a PVC is just a PVC — the driver creates a subdirectory on the share for each one without you writing a PV."], code:{de:"helm repo add csi-driver-nfs https://raw.githubusercontent.com/kubernetes-csi/csi-driver-nfs/master/charts\nhelm repo update\nhelm install csi-driver-nfs csi-driver-nfs/csi-driver-nfs -n kube-system\n\nkubectl -n kube-system get pods -l app.kubernetes.io/name=csi-driver-nfs\nkubectl get csidrivers            # nfs.csi.k8s.io muss auftauchen", en:"helm repo add csi-driver-nfs https://raw.githubusercontent.com/kubernetes-csi/csi-driver-nfs/master/charts\nhelm repo update\nhelm install csi-driver-nfs csi-driver-nfs/csi-driver-nfs -n kube-system\n\nkubectl -n kube-system get pods -l app.kubernetes.io/name=csi-driver-nfs\nkubectl get csidrivers            # nfs.csi.k8s.io has to show up"}},

   {h:"Die StorageClass dazu|The storage class for it", p:["Danach reicht ein PVC mit `storageClassName: nfs` — Größe, Zugriffsmodus, fertig.|After this a PVC with `storageClassName: nfs` is enough — size, access mode, done."], code:{de:"apiVersion: storage.k8s.io/v1\nkind: StorageClass\nmetadata:\n  name: nfs\nprovisioner: nfs.csi.k8s.io\nparameters:\n  server: 172.18.42.5\n  share: /tank/k8s\nreclaimPolicy: Delete      # Retain, wenn die Daten ein delete überleben sollen\nvolumeBindingMode: Immediate\nallowVolumeExpansion: true\nmountOptions:\n  - hard\n  - nfsvers=4.1", en:"apiVersion: storage.k8s.io/v1\nkind: StorageClass\nmetadata:\n  name: nfs\nprovisioner: nfs.csi.k8s.io\nparameters:\n  server: 172.18.42.5\n  share: /tank/k8s\nreclaimPolicy: Delete      # Retain if the data should survive a delete\nvolumeBindingMode: Immediate\nallowVolumeExpansion: true\nmountOptions:\n  - hard\n  - nfsvers=4.1"}},

   {h:"Rechte — der Punkt, an dem es klemmt|Permissions — where it gets stuck", p:["Auf NFS entscheidet der Server über die Besitzverhältnisse, nicht der Cluster. `fsGroup` im securityContext greift deshalb nur eingeschränkt: der kubelet darf die Dateien gar nicht umschreiben. Läuft der Container als UID 1000 und gehören die Dateien root, kommt *Permission denied* — und `chown` aus dem Container heraus scheitert an `root_squash`.|On NFS the server decides ownership, not the cluster. `fsGroup` in the securityContext therefore only helps so far: the kubelet is not allowed to rewrite the files at all. If the container runs as UID 1000 and the files belong to root you get *Permission denied* — and `chown` from inside the container fails on `root_squash`."], code:{de:"# auf dem Server, einmal richtig setzen:\nsudo chown -R 1000:1000 /tank/k8s/daten\n\n# oder alle Zugriffe auf einen Benutzer abbilden — /etc/exports:\n/tank/k8s  172.18.42.0/24(rw,sync,all_squash,anonuid=1000,anongid=1000,no_subtree_check)", en:"# on the server, set it right once:\nsudo chown -R 1000:1000 /tank/k8s/data\n\n# or map every access onto one user — /etc/exports:\n/tank/k8s  172.18.42.0/24(rw,sync,all_squash,anonuid=1000,anongid=1000,no_subtree_check)"}}],
 p2:["`hard` gegen `soft`: Bei `soft` bricht ein Schreibvorgang nach einem Timeout ab — die Anwendung bekommt einen Fehler und schreibt womöglich stillschweigend nichts. Bei `hard` wartet sie, bis der Server zurück ist. Für Daten, die zählen, immer `hard`.|`hard` versus `soft`: with `soft` a write aborts after a timeout — the application gets an error and may silently write nothing. With `hard` it waits until the server is back. For data that matters, always `hard`.",
      "Und die unbequeme Wahrheit: Ein NFS-Server ist ein einzelner Ausfallpunkt für den halben Cluster. Eine Datenbank gehört nicht darauf — POSIX-Sperren über NFS sind genau so verlässlich, wie sie klingen.|And the uncomfortable truth: an NFS server is a single point of failure for half the cluster. A database does not belong on it — POSIX locking over NFS is exactly as dependable as it sounds."]},

{h:"ZFS anbinden|Wiring up ZFS",
 p:["Bei ZFS werden zwei völlig verschiedene Situationen ständig verwechselt. Entweder liegt der Pool **auf den Kubernetes-Nodes selbst** — dann ist es lokaler Speicher mit sehr guten Eigenschaften. Oder er liegt **auf einer eigenen Maschine**, einer TrueNAS- oder Proxmox-Kiste — dann ist es Netzwerkspeicher, und ZFS ist nur das, was dahinter läuft. Die Anbindung ist in beiden Fällen eine andere.|With ZFS two entirely different situations get confused constantly. Either the pool sits **on the Kubernetes nodes themselves** — then it is local storage with very good properties. Or it sits **on a machine of its own**, a TrueNAS or Proxmox box — then it is network storage and ZFS is merely what runs behind it. The wiring differs in each case."],
 steps:[
   {h:"Fall A · ZFS liegt auf den Nodes|Case A · ZFS lives on the nodes", p:["Pool anlegen, Werkzeuge installieren — auf jedem Node, der Speicher stellen soll.|Create the pool, install the tools — on every node that is meant to provide storage."], code:{de:"sudo apt-get install -y zfsutils-linux\nsudo zpool create tank /dev/sdb          # oder ein bestehender Pool\nzpool status\nzfs list", en:"sudo apt-get install -y zfsutils-linux\nsudo zpool create tank /dev/sdb          # or an existing pool\nzpool status\nzfs list"}},

   {h:"Der Treiber dazu: zfs-localpv|The driver for it: zfs-localpv", p:["OpenEBS bringt einen CSI-Treiber mit, der ZFS-Datasets als PersistentVolumes anlegt. Die replizierte Engine braucht man dafür nicht und sollte sie im Heimlabor ausschalten.|OpenEBS ships a CSI driver that provisions ZFS datasets as PersistentVolumes. The replicated engine is not needed for this and should be switched off in a home lab."], code:{de:"helm repo add openebs https://openebs.github.io/openebs\nhelm repo update\nhelm install openebs openebs/openebs -n openebs --create-namespace \\\n  --set engines.replicated.mayastor.enabled=false\n\nkubectl -n openebs get pods\nkubectl get csidrivers            # zfs.csi.openebs.io muss auftauchen", en:"helm repo add openebs https://openebs.github.io/openebs\nhelm repo update\nhelm install openebs openebs/openebs -n openebs --create-namespace \\\n  --set engines.replicated.mayastor.enabled=false\n\nkubectl -n openebs get pods\nkubectl get csidrivers            # zfs.csi.openebs.io has to show up"}},

   {h:"Die StorageClass|The storage class", p:["`volumeBindingMode: WaitForFirstConsumer` ist hier nicht optional. Ohne diese Zeile entsteht das Dataset auf irgendeinem Node, der Scheduler stellt den Pod woanders hin, und du siehst *volume node affinity conflict* — bei einem Volume, das eben noch da war.|`volumeBindingMode: WaitForFirstConsumer` is not optional here. Without that line the dataset appears on some node, the scheduler puts the pod elsewhere, and you get *volume node affinity conflict* — on a volume that was right there a moment ago."], code:{de:"apiVersion: storage.k8s.io/v1\nkind: StorageClass\nmetadata:\n  name: zfs-local\nprovisioner: zfs.csi.openebs.io\nparameters:\n  poolname: tank\n  fstype: zfs            # zfs = Dataset, ext4/xfs = ZVOL mit Dateisystem\n  compression: \"on\"\n  recordsize: \"128k\"     # bei Postgres eher 16k, bei Videos 1M\nallowVolumeExpansion: true\nvolumeBindingMode: WaitForFirstConsumer\nreclaimPolicy: Delete", en:"apiVersion: storage.k8s.io/v1\nkind: StorageClass\nmetadata:\n  name: zfs-local\nprovisioner: zfs.csi.openebs.io\nparameters:\n  poolname: tank\n  fstype: zfs            # zfs = dataset, ext4/xfs = ZVOL with a filesystem\n  compression: \"on\"\n  recordsize: \"128k\"     # 16k for Postgres, 1M for video\nallowVolumeExpansion: true\nvolumeBindingMode: WaitForFirstConsumer\nreclaimPolicy: Delete"}},

   {h:"Was du damit bekommst — und was nicht|What you get — and what you do not", p:["Du bekommst Kompression, Prüfsummen und Snapshots je Volume, und Latenzen, die kein Netzwerkspeicher erreicht. Du bekommst **kein** ReadWriteMany und keine Ausfallsicherheit: Das Volume liegt auf genau einem Node, der Pod wird dorthin festgenagelt, und wenn diese Maschine stirbt, sind die Daten nicht anderswo. Richtig für Postgres mit eigener Replikation oder ein MongoDB-ReplicaSet. Falsch für ein geteiltes Upload-Verzeichnis.|You get compression, checksums and per-volume snapshots, and latency no network storage matches. You do **not** get ReadWriteMany or fault tolerance: the volume sits on exactly one node, the pod is nailed to it, and if that machine dies the data is not somewhere else. Right for Postgres with its own replication or a MongoDB replica set. Wrong for a shared upload directory."], code:{de:"kubectl get pv -o custom-columns=NAME:.metadata.name,NODE:'.spec.nodeAffinity.required.nodeSelectorTerms[0].matchExpressions[0].values[0]'\nzfs list -t all                   # auf dem Node: Datasets und Snapshots", en:"kubectl get pv -o custom-columns=NAME:.metadata.name,NODE:'.spec.nodeAffinity.required.nodeSelectorTerms[0].matchExpressions[0].values[0]'\nzfs list -t all                   # on the node: datasets and snapshots"}},

   {h:"Fall B · ein eigener ZFS-Server|Case B · a ZFS box of its own", p:["Steht TrueNAS oder ein ZFS-Server daneben, redet **democratic-csi** über dessen API mit ihm: es legt je PVC ein Dataset an, gibt es per NFS oder iSCSI frei und räumt es wieder ab. NFS gibt dir ReadWriteMany, iSCSI die bessere Latenz und ReadWriteOnce.|If TrueNAS or a ZFS server sits next to the cluster, **democratic-csi** talks to its API: it creates a dataset per PVC, exports it over NFS or iSCSI, and cleans it up again. NFS gives you ReadWriteMany, iSCSI gives better latency and ReadWriteOnce."], code:{de:"helm repo add democratic-csi https://democratic-csi.github.io/charts/\nhelm install zfs-nfs democratic-csi/democratic-csi \\\n  -n democratic-csi --create-namespace -f werte.yaml\n\n# werte.yaml, gekürzt:\ncsiDriver:\n  name: org.democratic-csi.nfs\nstorageClasses:\n  - name: zfs-nfs\n    defaultClass: false\n    reclaimPolicy: Delete\n    volumeBindingMode: Immediate\n    allowVolumeExpansion: true\ndriver:\n  config:\n    driver: freenas-api-nfs\n    httpConnection:\n      protocol: https\n      host: 172.18.42.5\n      port: 443\n      apiKey: HIER-DER-API-SCHLUESSEL\n      allowInsecure: true\n    zfs:\n      datasetParentName: tank/k8s/vols\n      detachedSnapshotsDatasetParentName: tank/k8s/snaps\n    nfs:\n      shareHost: 172.18.42.5", en:"helm repo add democratic-csi https://democratic-csi.github.io/charts/\nhelm install zfs-nfs democratic-csi/democratic-csi \\\n  -n democratic-csi --create-namespace -f values.yaml\n\n# values.yaml, abbreviated:\ncsiDriver:\n  name: org.democratic-csi.nfs\nstorageClasses:\n  - name: zfs-nfs\n    defaultClass: false\n    reclaimPolicy: Delete\n    volumeBindingMode: Immediate\n    allowVolumeExpansion: true\ndriver:\n  config:\n    driver: freenas-api-nfs\n    httpConnection:\n      protocol: https\n      host: 172.18.42.5\n      port: 443\n      apiKey: YOUR-API-KEY-HERE\n      allowInsecure: true\n    zfs:\n      datasetParentName: tank/k8s/vols\n      detachedSnapshotsDatasetParentName: tank/k8s/snaps\n    nfs:\n      shareHost: 172.18.42.5"}},

   {h:"Die einfache Variante von Fall B|The plain version of case B", p:["Wenn dir der API-Schlüssel und die Konfigurationsdatei zu viel sind: Gib das Dataset schlicht per NFS frei und nimm den `csi-driver-nfs` aus dem Abschnitt darüber. Du verlierst Snapshots und Quoten je Volume — dafür gibt es ein Stück weniger, das kaputtgehen kann. Im Heimlabor ist das meistens der bessere Tausch.|If the API key and the values file are more than you want: simply export the dataset over NFS and use `csi-driver-nfs` from the section above. You lose per-volume snapshots and quotas — in exchange there is one less thing to break. In a home lab that is usually the better trade."]},

   {h:"Was ZFS im Cluster schiefgehen lässt|What ZFS gets wrong in a cluster", p:["Der ARC — der Lesecache von ZFS — liegt außerhalb dessen, was der kubelet als belegt sieht. Der Node meldet freien Speicher, den ZFS längst hält; dann verdrängt der kubelet Pods oder der OOM-Killer greift zu. Begrenze den ARC, bevor es passiert.|The ARC — ZFS's read cache — sits outside what the kubelet counts as used. The node reports free memory that ZFS is already holding; then the kubelet evicts pods or the OOM killer steps in. Cap the ARC before that happens."], code:{de:"# 4 GiB Obergrenze für den ARC\necho \"options zfs zfs_arc_max=4294967296\" | sudo tee /etc/modprobe.d/zfs.conf\nsudo update-initramfs -u\n# danach neu starten\n\ncat /proc/spl/kstat/zfs/arcstats | grep -E '^(size|c_max)'", en:"# 4 GiB ceiling for the ARC\necho \"options zfs zfs_arc_max=4294967296\" | sudo tee /etc/modprobe.d/zfs.conf\nsudo update-initramfs -u\n# reboot afterwards\n\ncat /proc/spl/kstat/zfs/arcstats | grep -E '^(size|c_max)'"}}],
 p2:["Zwei weitere Stolpersteine: Der Pool muss beim Start **vor** dem kubelet importiert sein, sonst starten Pods in leere Verzeichnisse hinein und schreiben munter auf die Systemplatte. Und ein voller Pool legt jeden Pod lahm, der darauf schreibt — nicht nur den, der ihn vollgemacht hat. `zpool list` gehört in die Überwachung.|Two more stumbling blocks: the pool has to be imported **before** the kubelet at boot, otherwise pods start into empty directories and happily write onto the system disk. And a full pool stalls every pod writing to it — not just the one that filled it. `zpool list` belongs in your monitoring."]},

{h:"S3 anbinden|Wiring up S3",
 p:["Der wichtigste Satz zuerst: **Für S3 gibt es kein PVC**, und das ist Absicht. Objektspeicher hat keine Verzeichnisse, kein Umbenennen, kein Anhängen an eine bestehende Datei und keine Sperren. Jeder Zugriff ist eine HTTP-Anfrage. Wer das als Laufwerk einhängt, baut sich ein Dateisystem, das an genau diesen Stellen lügt.|The most important sentence first: **there is no PVC for S3**, and that is deliberate. Object storage has no directories, no rename, no append to an existing file and no locking. Every access is an HTTP request. Mounting it as a drive builds you a filesystem that lies in exactly those places."],
 table:[["Erwartung|Expectation","Was S3 per FUSE daraus macht|What S3 over FUSE makes of it"],
   ["Datei umbenennen|Rename a file","Kopieren und löschen. Bei 2 GB dauert das entsprechend.|Copy and delete. On 2 GB it takes accordingly."],
   ["An eine Datei anhängen|Append to a file","Geht nicht. Das Objekt wird komplett neu geschrieben — oder der Treiber lehnt ab.|Not possible. The object is rewritten whole — or the driver refuses."],
   ["Sperrdatei, flock|Lock file, flock","Wirkungslos. Zwei Pods überschreiben sich gegenseitig, ohne es zu merken.|Ineffective. Two pods overwrite each other without noticing."],
   ["ls im großen Verzeichnis|ls in a large directory","Eine API-Anfrage je 1000 Objekte. Sichtbar langsam, in der Cloud auch abgerechnet.|One API request per 1000 objects. Visibly slow, and billed in the cloud."],
   ["Zeitstempel, Rechte|Timestamps, permissions","Erfunden. Was `stat` zeigt, kommt aus den Mount-Optionen.|Invented. What `stat` shows comes from the mount options."]],
 steps:[
   {h:"Weg 1 · die Anwendung spricht S3|Route 1 · the application speaks S3", p:["Der richtige Weg, und meist weniger Arbeit als gedacht: Zugangsdaten in ein Secret, Bucket und Endpunkt als Umgebungsvariablen. Jedes SDK — boto3, aws-sdk, minio-go — findet die Standardnamen von allein.|The right route, and usually less work than expected: credentials into a Secret, bucket and endpoint as environment variables. Every SDK — boto3, aws-sdk, minio-go — picks up the standard names on its own."], code:{de:"apiVersion: v1\nkind: Secret\nmetadata:\n  name: s3-zugang\ntype: Opaque\nstringData:\n  AWS_ACCESS_KEY_ID: AKIAIOSFODNN7EXAMPLE\n  AWS_SECRET_ACCESS_KEY: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\n---\n# im Container:\n    envFrom:\n      - secretRef:\n          name: s3-zugang\n    env:\n      - name: AWS_REGION\n        value: eu-central-1\n      - name: S3_BUCKET\n        value: meine-uploads\n      - name: AWS_ENDPOINT_URL          # nur bei MinIO, Ceph, Garage\n        value: http://minio.minio.svc.cluster.local:9000", en:"apiVersion: v1\nkind: Secret\nmetadata:\n  name: s3-access\ntype: Opaque\nstringData:\n  AWS_ACCESS_KEY_ID: AKIAIOSFODNN7EXAMPLE\n  AWS_SECRET_ACCESS_KEY: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\n---\n# in the container:\n    envFrom:\n      - secretRef:\n          name: s3-access\n    env:\n      - name: AWS_REGION\n        value: eu-central-1\n      - name: S3_BUCKET\n        value: my-uploads\n      - name: AWS_ENDPOINT_URL          # only for MinIO, Ceph, Garage\n        value: http://minio.minio.svc.cluster.local:9000"}},

   {h:"In der Cloud: keine Schlüssel|In the cloud: no keys", p:["Bei AWS, Google und Azure gehören statische Schlüssel nicht in den Cluster. Der Pod bekommt über seinen ServiceAccount ein kurzlebiges Token, der Anbieter tauscht es gegen Rechte — bei AWS heißt das IRSA oder Pod Identity, bei Google Workload Identity. Es gibt dann schlicht nichts zu stehlen.|On AWS, Google and Azure static keys do not belong in the cluster. The pod gets a short-lived token through its ServiceAccount and the provider exchanges it for permissions — AWS calls it IRSA or Pod Identity, Google calls it Workload Identity. There is then simply nothing to steal."], code:{de:"apiVersion: v1\nkind: ServiceAccount\nmetadata:\n  name: uploader\n  annotations:\n    eks.amazonaws.com/role-arn: arn:aws:iam::111122223333:role/uploads-schreiben\n---\n# im Pod:\n    spec:\n      serviceAccountName: uploader", en:"apiVersion: v1\nkind: ServiceAccount\nmetadata:\n  name: uploader\n  annotations:\n    eks.amazonaws.com/role-arn: arn:aws:iam::111122223333:role/write-uploads\n---\n# in the pod:\n    spec:\n      serviceAccountName: uploader"}},

   {h:"Weg 2 · S3 trotzdem als Verzeichnis|Route 2 · S3 as a directory anyway", p:["Manchmal ist die Anwendung nicht änderbar. Dann hängen Mountpoint for Amazon S3, s3fs, GeeseFS, rclone oder JuiceFS den Bucket per FUSE ein. Dynamisches Provisioning gibt es dabei nicht — du beschreibst den Bucket als statisches PV.|Sometimes the application cannot be changed. Then Mountpoint for Amazon S3, s3fs, GeeseFS, rclone or JuiceFS mount the bucket over FUSE. There is no dynamic provisioning — you describe the bucket as a static PV."], code:{de:"apiVersion: v1\nkind: PersistentVolume\nmetadata:\n  name: pv-s3-bilder\nspec:\n  capacity:\n    storage: 1200Gi        # wird nicht ausgewertet, muss aber dastehen\n  accessModes:\n    - ReadWriteMany\n  persistentVolumeReclaimPolicy: Retain\n  storageClassName: \"\"\n  mountOptions:\n    - allow-delete\n    - uid=1000\n    - gid=1000\n  csi:\n    driver: s3.csi.aws.com\n    volumeHandle: s3-bilder     # frei wählbar, muss clusterweit eindeutig sein\n    volumeAttributes:\n      bucketName: meine-bilder", en:"apiVersion: v1\nkind: PersistentVolume\nmetadata:\n  name: pv-s3-images\nspec:\n  capacity:\n    storage: 1200Gi        # not evaluated, but has to be there\n  accessModes:\n    - ReadWriteMany\n  persistentVolumeReclaimPolicy: Retain\n  storageClassName: \"\"\n  mountOptions:\n    - allow-delete\n    - uid=1000\n    - gid=1000\n  csi:\n    driver: s3.csi.aws.com\n    volumeHandle: s3-images     # free to choose, must be unique cluster-wide\n    volumeAttributes:\n      bucketName: my-images"}},

   {h:"Weg 3 · S3 selbst betreiben|Route 3 · run S3 yourself", p:["Im eigenen Cluster liefert MinIO einen S3-Endpunkt auf deinen PVCs — also auf ZFS, NFS oder was du sonst eingerichtet hast. Damit bleibst du zu jedem S3-SDK kompatibel, ohne einen Anbieter zu brauchen. Alternativen mit demselben Zweck: Ceph RGW über Rook, SeaweedFS, Garage.|Inside your own cluster MinIO provides an S3 endpoint on top of your PVCs — that is, on ZFS, NFS or whatever else you set up. That keeps you compatible with every S3 SDK without needing a provider. Alternatives with the same purpose: Ceph RGW via Rook, SeaweedFS, Garage."], code:{de:"helm repo add minio https://charts.min.io/\nhelm install minio minio/minio -n minio --create-namespace \\\n  --set mode=distributed --set replicas=4 \\\n  --set persistence.storageClass=zfs-local \\\n  --set persistence.size=100Gi\n\n# Endpunkt im Cluster:\n#   http://minio.minio.svc.cluster.local:9000", en:"helm repo add minio https://charts.min.io/\nhelm install minio minio/minio -n minio --create-namespace \\\n  --set mode=distributed --set replicas=4 \\\n  --set persistence.storageClass=zfs-local \\\n  --set persistence.size=100Gi\n\n# endpoint inside the cluster:\n#   http://minio.minio.svc.cluster.local:9000"}},

   {h:"Wofür S3 im Cluster wirklich taugt|What S3 is genuinely good for", p:["Sicherungen. Velero legt Cluster-Zustand und Volume-Snapshots dort ab, ein CronJob mit `pg_dump` genauso. Dazu Artefakte, Container-Images über eine Registry, Logs über Loki, Modelldateien. Alles groß, alles selten geändert — genau das, wofür Objektspeicher gebaut ist.|Backups. Velero puts cluster state and volume snapshots there, and so does a CronJob running `pg_dump`. Plus artifacts, container images via a registry, logs via Loki, model files. All large, all rarely changed — exactly what object storage was built for."], code:{de:"velero install --provider aws --plugins velero/velero-plugin-for-aws:v1.10.0 \\\n  --bucket k8s-backup --secret-file ./velero-zugang \\\n  --backup-location-config region=eu-central-1,s3ForcePathStyle=true,s3Url=http://minio.minio.svc:9000\n\nvelero backup create nacht --include-namespaces prod\nvelero backup describe nacht", en:"velero install --provider aws --plugins velero/velero-plugin-for-aws:v1.10.0 \\\n  --bucket k8s-backup --secret-file ./velero-access \\\n  --backup-location-config region=eu-central-1,s3ForcePathStyle=true,s3Url=http://minio.minio.svc:9000\n\nvelero backup create nightly --include-namespaces prod\nvelero backup describe nightly"}}],
 p2:["Daraus folgt die Grenze: keine Datenbank, kein SQLite, kein Git-Repository, kein Verzeichnis mit Sperrdateien auf einem FUSE-Mount. Gut geeignet ist der umgekehrte Fall — viel lesen, selten schreiben: Medien, die ein nginx ausliefert, Modellgewichte, statische Dateien.|The limit follows from that: no database, no SQLite, no git repository, no directory with lock files on a FUSE mount. What suits it is the opposite case — read a lot, write rarely: media served by an nginx, model weights, static files."]},

{h:"Was die Nodes mitbringen müssen|What the nodes have to bring",
 p:["Fast jeder Speicherfehler, der wie ein Kubernetes-Problem aussieht, ist ein fehlendes Paket auf einem Node. Der kubelet hängt ein, nicht der Pod — also braucht die Maschine das Werkzeug dafür.|Almost every storage error that looks like a Kubernetes problem is a missing package on a node. The kubelet does the mounting, not the pod — so the machine needs the tooling."],
 table:[["Speicherart|Storage kind","Auf jedem Node|On every node","Prüfen mit|Check with"],
   ["NFS","nfs-common (Debian), nfs-utils (RHEL)","showmount -e SERVER"],
   ["iSCSI","open-iscsi, Dienst iscsid läuft|open-iscsi, iscsid running","systemctl status iscsid"],
   ["ZFS lokal|ZFS local","zfsutils-linux, Pool importiert|zfsutils-linux, pool imported","zpool status"],
   ["S3 per FUSE|S3 over FUSE","nichts, aber /dev/fuse muss da sein|nothing, but /dev/fuse has to exist","ls -l /dev/fuse"],
   ["CSI allgemein|CSI in general","kubelet-Pfad muss zum Treiber passen|kubelet path has to match the driver","kubectl get csidrivers"]],
 p2:["Nach `kubeadm reset` oder auf einer neu aufgesetzten Maschine ist all das wieder weg. Es gehört in die Node-Einrichtung — Ansible, cloud-init, ein Skript — und nicht in den Kopf.|After `kubeadm reset` or on a freshly installed machine all of it is gone again. It belongs in your node setup — Ansible, cloud-init, a script — not in your head."]},

{h:"Prüfen, ob der Speicher wirklich hält|Checking that storage really holds",
 p:["Ein PVC im Zustand `Bound` heißt nur, dass Kubernetes ein Volume gefunden hat. Ob geschrieben werden darf, ob es einen Pod-Neustart überlebt und ob wirklich mehrere Nodes darauf dürfen, sagt erst der Versuch.|A PVC in state `Bound` only means Kubernetes found a volume. Whether writing is allowed, whether it survives a pod restart, and whether several nodes really may use it, only the attempt tells you."],
 steps:[
   {h:"Schreiben, Pod wegwerfen, nachsehen|Write, throw the pod away, look again", p:["Der Test dauert eine Minute und beantwortet die einzige Frage, die zählt.|The test takes a minute and answers the only question that matters."], code:{de:"apiVersion: v1\nkind: Pod\nmetadata:\n  name: speichertest\nspec:\n  restartPolicy: Never\n  containers:\n    - name: shell\n      image: busybox:1.36\n      command: [\"sh\",\"-c\",\"date >> /daten/probe.txt; cat /daten/probe.txt; sleep 3600\"]\n      volumeMounts:\n        - name: d\n          mountPath: /daten\n  volumes:\n    - name: d\n      persistentVolumeClaim:\n        claimName: daten", en:"apiVersion: v1\nkind: Pod\nmetadata:\n  name: storage-test\nspec:\n  restartPolicy: Never\n  containers:\n    - name: shell\n      image: busybox:1.36\n      command: [\"sh\",\"-c\",\"date >> /data/probe.txt; cat /data/probe.txt; sleep 3600\"]\n      volumeMounts:\n        - name: d\n          mountPath: /data\n  volumes:\n    - name: d\n      persistentVolumeClaim:\n        claimName: data"}},

   {h:"Der eigentliche Beweis|The actual proof", p:["Nach dem zweiten Start müssen **zwei** Zeilen dastehen. Steht nur eine da, war es kein dauerhafter Speicher — dann hängt der Pfad neben dem mountPath oder es ist ein emptyDir.|After the second start there have to be **two** lines. If there is only one it was not persistent storage — then the path sits beside the mountPath, or it is an emptyDir."], code:{de:"kubectl logs speichertest\nkubectl delete pod speichertest\nkubectl apply -f speichertest.yaml\nkubectl logs speichertest          # zwei Zeilen = der Speicher hält\n\nkubectl exec speichertest -- df -h /daten    # zeigt die echte Quelle", en:"kubectl logs storage-test\nkubectl delete pod storage-test\nkubectl apply -f storage-test.yaml\nkubectl logs storage-test          # two lines = the storage holds\n\nkubectl exec storage-test -- df -h /data     # shows the real source"}},

   {h:"Hält ReadWriteMany, was draufsteht|Does ReadWriteMany do what it says", p:["Denselben Pod ein zweites Mal starten, aber mit `nodeSelector` auf einen anderen Node. Bleibt der zweite in ContainerCreating stehen und meldet *Multi-Attach*, ist es kein RWX — egal, was im PVC steht.|Start the same pod a second time but with a `nodeSelector` pointing at a different node. If the second one sticks in ContainerCreating and reports *Multi-Attach*, it is not RWX — whatever the PVC says."], code:{de:"kubectl get pvc daten -o jsonpath='{.spec.accessModes}{\"\\n\"}'\nkubectl get pods -o wide           # auf welchem Node liegen sie?\nkubectl describe pod speichertest-2 | tail -20", en:"kubectl get pvc data -o jsonpath='{.spec.accessModes}{\"\\n\"}'\nkubectl get pods -o wide           # which nodes are they on?\nkubectl describe pod storage-test-2 | tail -20"}},

   {h:"Wie schnell ist es|How fast is it", p:["`conv=fsync` ist der entscheidende Teil. Ohne diesen Zusatz misst du den Seitencache des Nodes und bekommst Zahlen, die mit dem Speicher nichts zu tun haben.|`conv=fsync` is the part that matters. Without it you measure the node's page cache and get numbers that have nothing to do with the storage."], code:{de:"kubectl exec speichertest -- sh -c \\\n  'dd if=/dev/zero of=/daten/t bs=1M count=512 conv=fsync; rm /daten/t'", en:"kubectl exec storage-test -- sh -c \\\n  'dd if=/dev/zero of=/data/t bs=1M count=512 conv=fsync; rm /data/t'"}}],
 p2:["Und danach aufräumen: `kubectl delete pod speichertest`. Ein vergessener Testpod hält bei ReadWriteOnce das Volume fest und blockiert genau die Anwendung, für die du es angelegt hast.|And clean up afterwards: `kubectl delete pod storage-test`. A forgotten test pod holds a ReadWriteOnce volume and blocks the very application you created it for."]}
];

function mdInline(x){
  return esc(x).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
               .replace(/\*(.+?)\*/g, "<em>$1</em>")
               .replace(/`(.+?)`/g, "<code>$1</code>");
}

/* Gemeinsame Darstellung für Speicher-Wiki und Spickzettel. */
function sectionsHtml(list){
  let h = "";
  list.forEach((sec, si) => {
    /* Breite Tabellen bekommen im Spickzettel die volle Spaltenbreite. */
    const wide = (sec.table && sec.table[0].length >= 3) || (sec.code && !sec.table);
    h += '<div class="swsec' + (wide ? " swsec--wide" : "") + '" data-sec="' + si + '">' +
         '<p class="hgroup">' + esc(t(sec.h)) + "</p>";
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
    /* Rezepte: Zwischenschritt mit eigener Überschrift und eigenem Codeblock. */
    (sec.steps || []).forEach(st => {
      h += '<div class="swpart"><p class="swph">' + mdInline(t(st.h)) + "</p>";
      (st.p || []).forEach(x => { h += "<p>" + mdInline(t(x)) + "</p>"; });
      if (st.code) h += '<pre class="swcode">' + esc(t(st.code)) + "</pre>";
      h += "</div>";
    });
    (sec.p2 || []).forEach(x => { h += "<p>" + mdInline(t(x)) + "</p>"; });
    h += "</div>";
  });
  return h;
}

function renderStorageWiki(){
  const nav = '<div class="swnav">' + STORAGE_WIKI.map((s, i) =>
    '<button class="swchip' + (s.steps ? " swchip--go" : "") + '" data-jump="' + i + '">' +
    esc(t(s.h)) + "</button>").join("") + "</div>";
  $("storageWiki").innerHTML = nav + sectionsHtml(STORAGE_WIKI);
}
$("storageWiki").addEventListener("click", e => {
  const b = e.target.closest("button[data-jump]");
  if (!b) return;
  const sec = $("storageWiki").querySelector('[data-sec="' + b.dataset.jump + '"]');
  if (sec) sec.scrollIntoView({behavior:"smooth", block:"start"});
});

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

{h:"Die drei Netze|The three networks",
 table:[["Netz|Network","Beispiel|Example","Wo es existiert|Where it exists","Wer vergibt|Who assigns"],
   ["Knoten-Netz|Node network","192.168.178.0/24","Echt, im LAN. Die Adressen der Maschinen.|Real, in the LAN. The machines' addresses.","Router oder Netzwerkteam|Router or network team"],
   ["Pod-Netz|Pod network","10.244.0.0/16","Nur im Cluster. Jeder Pod bekommt eine Adresse daraus.|Cluster-internal only. Every pod gets an address from it.","CNI, je Knoten ein /24|The CNI, a /24 per node"],
   ["Service-Netz|Service network","10.96.0.0/12","Nirgends — es sind reine Regeln auf jedem Knoten.|Nowhere — it is just rules on every node.","kube-proxy"]],
 p2:["Nur das Knoten-Netz ist ein echtes Netz. Pod- und Service-Netz sind frei gewaehlte Bereiche, die **ausschliesslich innerhalb des Clusters** gelten: Im Router ist dafuer nichts einzutragen, und kein Geraet ausserhalb muss sie kennen. Die einzige Bedingung ist, dass sich die drei nicht ueberschneiden — und auch nicht mit etwas, das die Knoten sonst erreichen muessen, etwa einem VPN oder einem NAS.|Only the node network is a real network. The pod and service networks are freely chosen ranges that apply **inside the cluster only**: there is nothing to configure in your router, and no device outside needs to know them. The single condition is that the three must not overlap — nor collide with anything the nodes otherwise need to reach, such as a VPN or a NAS.",
     "Nach **aussen** kommen Pods trotzdem: Der Knoten schreibt die Absenderadresse auf seine eigene um. Nach **innen** fuehrt kein Weg ueber die Pod-Adresse — dafuer gibt es NodePort, LoadBalancer und Ingress, und die sitzen alle auf echten Adressen aus dem Knoten-Netz.|Pods still reach **out**: the node rewrites the source address to its own. There is no way **in** via a pod address — that is what NodePort, LoadBalancer and Ingress are for, and those all sit on real addresses from the node network."]},

{h:"Wege ins Cluster|Ways into the cluster",
 table:[["Weg|Way","Adresse|Address","Braucht|Needs","Wofuer|What for"],
   ["port-forward","localhost der eigenen Maschine|localhost of your own machine","nichts|nothing","Nur zum Nachsehen. Kein Betrieb.|For looking only. Not for operation."],
   ["NodePort","Knoten-IP, Port 30000-32767|node IP, port 30000-32767","nichts|nothing","Der einfachste echte Zugang. Haessliche Ports.|The simplest real way in. Ugly ports."],
   ["LoadBalancer","eigene Adresse im Netz|its own address on the network","Cloud-Anbieter oder MetalLB|a cloud provider or MetalLB","Ein Dienst, eine Adresse, beliebiges Protokoll.|One service, one address, any protocol."],
   ["Ingress","Adresse des Controllers|the controller's address","Controller plus einen der beiden Wege darueber|a controller plus one of the two ways above","HTTP und HTTPS nach Hostname und Pfad.|HTTP and HTTPS by hostname and path."],
   ["hostNetwork","Knoten-IP, Port 80 und 443|node IP, ports 80 and 443","nichts|nothing","Ingress-Controller auf kleinen Clustern ohne MetalLB.|An ingress controller on small clusters without MetalLB."]],
 p2:["**MetalLB ist nicht der Weg hinein, sondern der, der die Adresse vergibt.** In der Cloud erledigt das der Anbieter; auf eigener Hardware macht es sonst niemand, und ein Service vom Typ LoadBalancer bliebe fuer immer auf Pending stehen. Sobald die Adresse steht, uebernehmen kube-proxy und das CNI — MetalLB liegt im L2-Modus gar nicht im Datenpfad.|**MetalLB is not the way in, it is what hands out the address.** In the cloud the provider does that; on your own hardware nobody else does, and a LoadBalancer service would sit at Pending forever. Once the address exists, kube-proxy and the CNI take over — in L2 mode MetalLB is not in the data path at all.",
     "Wichtig beim L2-Modus: Zu jedem Zeitpunkt haelt **ein** Knoten die Adresse und beantwortet die ARP-Anfragen dafuer. Das ist Ausfallsicherung, keine Lastverteilung — faellt der Knoten aus, uebernimmt ein anderer. Echte Verteilung ueber mehrere Knoten gibt es nur im BGP-Modus.|Important about L2 mode: at any moment **one** node holds the address and answers the ARP requests for it. That is failover, not load balancing — if the node fails, another takes over. Real distribution across nodes exists only in BGP mode."]},

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
  ok("init trägt ein Pod-Netz, das nicht mit Heimnetzen kollidiert",
    ["cilium","calico","flannel"].every(c =>
      allCmds({cni:c}).indexOf("--pod-network-cidr=10.244.0.0/16") !== -1), "");
  ok("Eigenes Pod-Netz sticht die Voreinstellung",
    allCmds({cni:"calico", podCidr:"172.20.0.0/16"}).indexOf("172.20.0.0/16") !== -1, "");
  ok("control-plane-endpoint nur mit Adresse",
    allCmds({}).indexOf("--control-plane-endpoint") === -1 &&
    allCmds({endpoint:"api.firma.de"}).indexOf("--control-plane-endpoint=api.firma.de:6443") !== -1, "");
  ok("upload-certs nur bei Hochverfügbarkeit",
    allCmds({}).indexOf("--upload-certs") === -1 && allCmds({ha:true}).indexOf("--upload-certs") !== -1, "");
  ok("Bei Hochverfügbarkeit wird geprüft, wohin die API-Adresse zeigt",
    allCmds({ha:true}).indexOf("getent hosts") !== -1 &&
    guideOf({ha:true}).some(s => s.items.some(i => i.d.indexOf("kube-vip") !== -1)), "");
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
    guideOf({ha:true}).some(s => s.items.some(i => i.c.indexOf("controlPlaneEndpoint") !== -1)) &&
    !guideOf({}).some(s => s.items.some(i => i.c.indexOf("controlPlaneEndpoint") !== -1)), "");
  ok("Zertifikatsschlüssel und Token stehen zusammen in einem Block",
    guideOf({ha:true}).some(s => s.items.some(i =>
      i.c.indexOf("upload-certs") !== -1 && i.c.indexOf("--print-join-command") !== -1)), "");
  ok("Die zusammengesetzte Zeile ergibt einen vollstaendigen Beitrittsbefehl",
    guideOf({ha:true}).some(s => s.items.some(i =>
      i.c.indexOf("--control-plane --certificate-key $KEY") !== -1 &&
      i.c.indexOf("tail -1") !== -1)), "");
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
      const explains = guideOf({}).some(s =>
        s.p.some(x => t(x).indexOf(ph) !== -1) ||
        (s.table||[]).some(r => r.some(c => t(c).indexOf(ph) !== -1)));
      return uses && explains;
    }), "");
  ok("Vor dem Überspringen der Hash-Prüfung wird gewarnt",
    guideOf({}).some(s => (s.r||[]).some(x => x.m.indexOf("skip-ca-verification") !== -1)), "");
  ok("Worker treten ohne --control-plane bei",
    guideOf({}).filter(s => s.role === "worker")[0].items[0].c.indexOf("--control-plane") === -1, "");
  ok("Es gibt einen Funktionstest von innen nach aussen",
    guideOf({}).some(s => t(s.h).indexOf("Funktionstest") !== -1 || t(s.h).indexOf("Smoke test") !== -1), "");
  ok("Die DNS-Probe fragt den vollständigen Namen ab",
    allCmds({}).indexOf("nslookup kubernetes.default.svc.cluster.local") !== -1 &&
    !/nslookup kubernetes\.default(?!\.svc)/.test(allCmds({})), "");
  ok("Der Funktionstest deckt DNS, Service, LoadBalancer und Ingress ab",
    ["nslookup kubernetes.default","kubectl expose deployment","metallb","LoadBalancer","kubectl create ingress"]
      .every(x => allCmds({}).toLowerCase().indexOf(x.toLowerCase()) !== -1), "");
  ok("Eine einzelne MetalLB-Adresse wird zu /32 ergänzt",
    allCmds({lbRange:"172.18.42.240"}).indexOf("172.18.42.240/32") !== -1 &&
    allCmds({lbRange:"172.18.42.240-172.18.42.250"}).indexOf("/32") === -1 &&
    allCmds({lbRange:"172.18.42.0/24"}).indexOf("172.18.42.0/24") !== -1, "");
  ok("Der MetalLB-Bereich wird übernommen",
    allCmds({lbRange:"10.0.0.50-10.0.0.60"}).indexOf("10.0.0.50-10.0.0.60") !== -1 &&
    allCmds({}).indexOf("192.168.178.240-192.168.178.250") !== -1, "");
  ok("Die Anleitung zeigt den Weg auf die eigene Arbeitsstation",
    allCmds({}).indexOf("/etc/kubernetes/admin.conf' > ~/.kube/config") !== -1 &&
    guideOf({}).some(s => (s.r||[]).some(x => x.lvl === "err" && x.m.indexOf("admin.conf") !== -1)), "");
  ok("Der metrics-server bekommt den Hinweis auf 0/1 mit",
    allCmds({}).indexOf("--kubelet-insecure-tls") !== -1, "");
  ok("Der Prüfschritt nennt den Grund für NotReady",
    allCmds({}).indexOf('.status.conditions[?(@.type=="Ready")]') !== -1 &&
    allCmds({}).indexOf(".spec.podCIDR") !== -1, "");
  ok("Es gibt einen Abschnitt zum Neuaufsetzen, mit Reihenfolge",
    guideOf({}).some(s => s.items.some(i => i.c.indexOf("kubeadm reset -f") !== -1) &&
      s.p.some(x => t(x).indexOf("von aussen nach innen") !== -1 || t(x).indexOf("outside in") !== -1)), "");
  ok("Der Neuaufbau warnt vor dem Verlust von etcd",
    guideOf({}).some(s => (s.r||[]).some(x => x.lvl === "err" && x.m.indexOf("etcd") !== -1)), "");
  ok("Die Netzwerkreste werden erwähnt, die reset liegen lässt",
    allCmds({}).indexOf("ip link delete cni0") !== -1, "");
  ok("Der Funktionstest hat eine Sprosse ohne MetalLB",
    allCmds({}).indexOf('"type":"NodePort"') !== -1, "");
  ok("Für eine vergebene, aber stumme Adresse gibt es eine Diagnose",
    allCmds({}).indexOf("component=speaker") !== -1 && allCmds({}).indexOf("ip neigh") !== -1, "");
  ok("Der Ingress-Controller wird vor der Regel geprüft",
    allCmds({}).indexOf("kubectl get ingressclass") !== -1 &&
    allCmds({}).indexOf("curl -I http://ADRESSE-DES-INGRESS") !== -1, "");
  ok("Die Controller-Logs stehen als letzte Instanz dabei",
    allCmds({}).indexOf("app.kubernetes.io/component=controller") !== -1, "");
  ok("Der Funktionstest räumt hinter sich auf",
    allCmds({}).indexOf("kubectl delete deployment web") !== -1, "");
  ok("Der init-Befehl nagelt die Version nicht fest",
    allCmds({}).indexOf("--kubernetes-version") === -1, "");
  ok("Vor dem init werden die installierten Versionen geprüft",
    guideOf({}).some(s => s.role === "all" && s.items.some(i =>
      i.c.indexOf("kubeadm version") !== -1 && i.c.indexOf("kubelet --version") !== -1)), "");
  ok("Ein zu kleines Pod-Netz ist ein Fehler",
    guideOf({podCidr:"192.168.178.0/24"}).some(s => (s.r||[]).some(x =>
      x.lvl === "err" && x.m.indexOf("/24") !== -1)) &&
    !guideOf({podCidr:"10.244.0.0/16"}).some(s => (s.r||[]).some(x =>
      x.lvl === "err" && x.m.indexOf("zu klein") !== -1)), "");
  ok("Vor 192.168 als Pod-Netz wird gewarnt",
    guideOf({podCidr:"192.168.0.0/16"}).some(s => (s.r||[]).some(x => x.m.indexOf("192.168") !== -1)) &&
    !guideOf({}).some(s => (s.r||[]).some(x => x.m.indexOf("192.168") !== -1)), "");
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
  const swStrings = [];
  STORAGE_WIKI.forEach(sec => {
    swStrings.push(sec.h);
    (sec.p||[]).concat(sec.p2||[]).forEach(x => swStrings.push(x));
    (sec.table||[]).forEach(r => r.forEach(c => { if (String(c).trim()) swStrings.push(c); }));
    (sec.steps||[]).forEach(st => { swStrings.push(st.h); (st.p||[]).forEach(x => swStrings.push(x)); });
  });
  const tenStrings = [];
  [{}, {level:"admin", identity:"sa", linux:true, quota:true, netpol:true, pss:"privileged"},
   {level:"view", identity:"cert", pss:"baseline"}].forEach(o => {
    tenantGuide(o).forEach(s => {
      tenStrings.push(s.h);
      (s.p||[]).concat(s.p2||[]).forEach(x => tenStrings.push(x));
      (s.table||[]).forEach(r => r.forEach(c => tenStrings.push(c)));
      (s.items||[]).forEach(it => tenStrings.push(it.d));
    });
  });
  /* Einzelne Fachbegriffe wie "edit" stehen bewusst nur einmal da; alles mit
     einem Leerzeichen ist Prosa und braucht beide Sprachen. */
  const zweisprachig = s => {
    const n = String(s).split("|").length;
    return n === 2 || (n === 1 && String(s).indexOf(" ") === -1);
  };
  const mlbStrings = [];
  [{}, {mode:"bgp", install:"helm", ipvs:true, ingress:true, autoAssign:false},
   {mode:"l2", range:"10.0.0.5"}].forEach(o => {
    metallbGuide(o).forEach(s => {
      mlbStrings.push(s.h);
      (s.p||[]).concat(s.p2||[]).forEach(x => mlbStrings.push(x));
      (s.table||[]).forEach(r => r.forEach(c => mlbStrings.push(c)));
      (s.items||[]).forEach(it => mlbStrings.push(it.d));
    });
  });
  const addGuide = clusterGuide({have:"node"}), newGuide = clusterGuide({});
  const heads = g => g.map(s => t(s.h)).join(" | ");
  ok("Installation: beim Hinzufügen entfällt kubeadm init",
    heads(addGuide).indexOf("Hauptserver|") === -1 &&
    addGuide.every(s => s.items.every(i => i.c.indexOf("kubeadm init") === -1)),
    heads(addGuide));
  ok("Installation: beim Neuaufsetzen bleibt kubeadm init drin",
    newGuide.some(s => s.items.some(i => i.c.indexOf("kubeadm init") === 5 ||
      i.c.indexOf("sudo kubeadm init") === 0)), "");
  ok("Installation: beim Hinzufügen wird zuerst der Bestand ausgelesen",
    addGuide[0].items.some(i => i.c.indexOf("kubectl get nodes") === 0) &&
    addGuide[0].r.some(x => x.lvl === "err"), "");
  ok("Installation: der Beitrittsbefehl bleibt in beiden Fällen dabei",
    [addGuide, newGuide].every(g => g.some(s => s.items.some(i => i.c.indexOf("kubeadm join") !== -1))), "");
  ok("Installation: Hinzufügen endet mit drain und delete node, nicht mit reset des Clusters",
    addGuide.some(s => s.items.some(i => i.c.indexOf("kubectl drain") === 0)) &&
    heads(addGuide).indexOf("Neu aufsetzen") === -1, "");
  ok("Installation: jeder Abschnitt nennt weiterhin seinen Ort",
    addGuide.concat(newGuide).every(s => CLUSTER_ROLE[s.role]), "");
  const oidcGuide = tenantGuide({user:"bge", ns:"team-admin", identity:"oidc", api:"k8s-cp1.highq.org:6443"});
  const oidcTxt = oidcGuide.map(s => s.items.map(i => i.c).join(" ")).join(" ");
  const ymlTest = (function(){
    const keep = {m:CLUSTER_MODE, t:TENANT};
    CLUSTER_MODE = "tenant";
    TENANT = {user:"bge", ns:"team-admin", api:"k8s-cp1.highq.org:6443", linux:true, quota:true, netpol:true};
    const y = ansibleExport();
    CLUSTER_MODE = keep.m; TENANT = keep.t;
    return y;
  })();
  ok("Ansible-Export: je Rolle ein Play mit passenden hosts",
    ymlTest.indexOf("  hosts: localhost") !== -1 && ymlTest.indexOf("  hosts: k8s_control_plane") !== -1, "");
  ok("Ansible-Export: Manifeste laufen über kubernetes.core.k8s",
    ymlTest.indexOf("kubernetes.core.k8s:") !== -1 && ymlTest.indexOf("        definition:") !== -1 &&
    ymlTest.indexOf("kind: Namespace") !== -1, "");
  ok("Ansible-Export: kein Manifest bleibt als cat-Heredoc stehen",
    ymlTest.indexOf("cat <<'EOF' | kubectl apply -f -") === -1, "");
  ok("Ansible-Export: lesende Befehle melden keine Änderung",
    ymlTest.indexOf("changed_when: false") !== -1, "");
  ok("Ansible-Export: Shell-Aufgaben bekommen bash",
    ymlTest.indexOf("executable: /bin/bash") !== -1, "");
  ok("Ansible-Export: die Risiken stehen als Kommentar dabei",
    ymlTest.indexOf("    # ACHTUNG") !== -1 || ymlTest.indexOf("    # Hinweis") !== -1, "");
  const bundleTest = (function(){
    const keep = CLUSTER_MODE; CLUSTER_MODE = "install";
    const b = ansibleBundle(); CLUSTER_MODE = keep; return b;
  })();
  const bNamen = bundleTest.map(f => f.name);
  const serie = (function(){
    const keep = {m:CLUSTER_MODE, t:TENANT};
    CLUSTER_MODE = "tenant";
    TENANT = {user:"bge", ns:"team-admin", api:"k8s-cp1.highq.org:6443",
              linux:true, quota:true, netpol:true, batch:true};
    const b = ansibleBundle();
    CLUSTER_MODE = keep.m; TENANT = keep.t;
    return b;
  })();
  const sNamen = serie.map(f => f.name);
  ok("Serie: Werteliste, Vorlage und Playbooks sind dabei",
    sNamen.indexOf("group_vars/all.yml") !== -1 && sNamen.indexOf("templates/kubeconfig.j2") !== -1 &&
    sNamen.indexOf("site.yml") === 0, sNamen.join(" "));
  ok("Serie: jede Aufgabe mit item läuft in einer Schleife",
    serie.filter(f => /\.yml$/.test(f.name) && f.name !== "site.yml" && f.name.indexOf("group_vars") !== 0)
      .every(f => f.text.indexOf("{{ item.") === -1 || f.text.indexOf('loop: "{{ teams }}"') !== -1), "");
  ok("Serie: die Werte stehen in der Liste, nicht im Befehlstext",
    serie.filter(f => /^\d\d-/.test(f.name)).every(f => f.text.indexOf("team-admin") === -1) &&
    serie.filter(f => f.name === "group_vars/all.yml")[0].text.indexOf("ns: team-admin") !== -1, "");
  ok("Serie: die Abnahme lässt den Lauf scheitern",
    serie.some(f => f.text.indexOf("failed_when: darf.stdout is not search('yes')") !== -1 &&
                    f.text.indexOf("failed_when: darf_nicht.stdout is not search('no')") !== -1), "");
  ok("Serie: der Rückbau ist in site.yml auskommentiert",
    (function(){
      const site = serie[0].text;
      const r = sNamen.filter(n => n.indexOf("-teardown.yml") !== -1);
      return r.length === 1 && site.indexOf("# - import_playbook: " + r[0]) !== -1 &&
             site.indexOf("\n- import_playbook: " + r[0]) === -1;
    })(), "");
  ok("Serie: ohne Haken bleibt der gewöhnliche Export",
    (function(){
      const keep = {m:CLUSTER_MODE, t:TENANT};
      CLUSTER_MODE = "tenant"; TENANT = {user:"bge", ns:"team-admin"};
      const b = ansibleBundle();
      CLUSTER_MODE = keep.m; TENANT = keep.t;
      return b.every(f => f.name !== "group_vars/all.yml");
    })(), "");
  const tenantBundle = (function(){
    const keep = {m:CLUSTER_MODE, t:TENANT};
    CLUSTER_MODE = "tenant";
    TENANT = {user:"bge", ns:"team-admin", api:"k8s-cp1.highq.org:6443", linux:true, quota:true, netpol:true};
    const b = ansibleBundle();
    CLUSTER_MODE = keep.m; TENANT = keep.t;
    return b;
  })();
  const tNamen = tenantBundle.map(f => f.name);
  ok("Benutzer-Bündel: der Rückbau steht in einer eigenen Datei",
    tNamen.some(n => n.indexOf("-teardown.yml") !== -1), tNamen.join(" "));
  ok("Benutzer-Bündel: site.yml ruft den Rückbau nicht auf",
    (function(){
      const site = tenantBundle[0].text;
      const rueck = tNamen.filter(n => n.indexOf("-teardown.yml") !== -1);
      return rueck.every(n => site.indexOf("\n- import_playbook: " + n) === -1 &&
                              site.indexOf("# - import_playbook: " + n) !== -1);
    })(), "");
  ok("Benutzer-Bündel: delete-Befehle stehen nur im Rückbau",
    tenantBundle.filter(f => /^\d\d-/.test(f.name)).every(f =>
      f.name.indexOf("-teardown.yml") !== -1 || f.text.indexOf("kubectl delete namespace") === -1), "");
  ok("Ansible-Export: Abschnitte ohne Befehle erzeugen keine leeren Plays",
    tenantBundle.filter(f => /^\d\d-/.test(f.name)).every(f =>
      f.text.indexOf("    - name: ") !== -1), "");
  ok("Ansible-Bündel: site.yml, Inventar und README sind dabei",
    bNamen.indexOf("site.yml") === 0 && bNamen.indexOf("inventory.ini") !== -1 &&
    bNamen.indexOf("README.md") !== -1, bNamen.join(" "));
  ok("Ansible-Bündel: je Rollenblock eine eigene Datei",
    bNamen.indexOf("01-all-nodes.yml") !== -1 && bNamen.indexOf("02-control-plane.yml") !== -1 &&
    bNamen.indexOf("03-workers.yml") !== -1, bNamen.join(" "));
  ok("Ansible-Bündel: jede Teildatei steht in site.yml",
    (function(){
      const site = bundleTest[0].text;
      return bNamen.filter(n => /^\d\d-/.test(n)).every(n => site.indexOf("- import_playbook: " + n) !== -1);
    })(), "");
  ok("Ansible-Bündel: jede Teildatei nennt genau einen hosts-Eintrag",
    bundleTest.filter(f => /^\d\d-/.test(f.name)).every(f =>
      f.text.split("\n").filter(z => z.indexOf("  hosts: ") === 0).length === 1), "");
  ok("tar: Groesse ist ein Vielfaches von 512 und endet mit Nullbloecken",
    (function(){
      const b = tarBytes(bundleTest);
      if (b.length % 512 !== 0) return false;
      for (let i = b.length - 1024; i < b.length; i++) if (b[i] !== 0) return false;
      return true;
    })(), "");
  ok("tar: der Kopf traegt Namen, Groesse und ustar",
    (function(){
      const b = tarBytes([{name:"site.yml", text:"hallo"}]);
      let name = "", magic = "";
      for (let i = 0; i < 8 && b[i]; i++) name += String.fromCharCode(b[i]);
      for (let i = 257; i < 262; i++) magic += String.fromCharCode(b[i]);
      /* 5 Zeichen, oktal 5, in elf Stellen mit fuehrenden Nullen */
      let groesse = "";
      for (let i = 124; i < 135; i++) groesse += String.fromCharCode(b[i]);
      return name === "site.yml" && magic === "ustar" && parseInt(groesse, 8) === 5;
    })(), "");
  ok("Ansible-Export: alle drei Modi liefern etwas",
    Object.keys(CLUSTER_MODES).every(m => {
      const keep = CLUSTER_MODE; CLUSTER_MODE = m;
      const y = ansibleExport(); CLUSTER_MODE = keep;
      return y.indexOf("  tasks:") !== -1 && y.indexOf("    - name: ") !== -1 && CLUSTER_MODES[m].yml;
    }), "");
  ok("Mengenangaben: gueltige Werte gehen durch",
    [["4","8Gi"],["500m","512Mi"],["2.5","2G"]].every(f =>
      mengenRisiken(tenantOpts({cpu:f[0], mem:f[1]})).length === 0), "");
  ok("Mengenangaben: Komma, Leerzeichen, GB und Gb werden abgefangen",
    [["2,5","8Gi"],["4","8 Gi"],["4","8GB"],["4","8Gb"],["4 Kerne","8Gi"]].every(f =>
      mengenRisiken(tenantOpts({cpu:f[0], mem:f[1]})).some(x => x.lvl === "err")), "");
  ok("Mengenangaben: Speicher ohne Einheit wird als Byte benannt",
    mengenRisiken(tenantOpts({cpu:"4", mem:"8"})).some(x => x.lvl === "err" &&
      (x.m.indexOf("Byte") !== -1 || x.m.indexOf("bytes") !== -1)), "");
  ok("Mengenangaben: die Warnung steht am Quota-Abschnitt",
    tenantGuide({quota:true, mem:"8GB"}).some(s =>
      s.r.some(x => x.lvl === "err" && x.m.indexOf("8GB") !== -1)), "");
  const pinGuide = tenantGuide({ns:"team-admin", pin:true, pool:"pool=team-admin", taint:true});
  const pinTxt = pinGuide.map(s => s.items.map(i => i.c).join(" ")).join(" ");
  ok("Node-Bindung: Label, Annotation und Plugin gehören zusammen",
    pinTxt.indexOf("kubectl label node") !== -1 &&
    pinTxt.indexOf("scheduler.alpha.kubernetes.io/node-selector") !== -1 &&
    pinTxt.indexOf("PodNodeSelector") !== -1, "");
  ok("Node-Bindung: das stille Scheitern ohne Plugin ist als Fehler benannt",
    pinGuide.some(s => s.r.some(x => x.lvl === "err" &&
      (x.m.indexOf("Admission-Plugin") !== -1 || x.m.indexOf("admission plugin") !== -1))), "");
  ok("Node-Bindung: Taint nur auf Wunsch",
    pinTxt.indexOf("kubectl taint nodes") !== -1 &&
    tenantGuide({pin:true}).map(s => s.items.map(i => i.c).join(" ")).join(" ").indexOf("kubectl taint") === -1, "");
  ok("Node-Bindung: ohne Haken kein Abschnitt",
    tenantGuide({}).length + 1 === tenantGuide({pin:true}).length, "");
  ok("Node-Bindung: Label ohne Leerzeichen",
    tenantOpts({pool:" pool = team-admin "}).pool === "pool=team-admin", "");
  ok("Kennwort-Weg: Anmeldedienst und API-Server-Umstellung kommen dazu",
    oidcGuide.some(s => t(s.h).indexOf("Dex") !== -1) &&
    oidcTxt.indexOf("--oidc-issuer-url=") !== -1 && oidcTxt.indexOf("--oidc-username-prefix=oidc:") !== -1, "");
  ok("Kennwort-Weg: der Name im RoleBinding trägt das Präfix",
    oidcTxt.indexOf("name: oidc:bge@highq.org") !== -1, "");
  ok("Kennwort-Weg: die Domain kommt aus der API-Adresse",
    tenantOpts({user:"bge", api:"k8s-cp1.highq.org:6443"}).email === "bge@highq.org" &&
    tenantOpts({user:"bge", api:"k8s-cp1.highq.org:6443"}).issuer === "https://dex.highq.org:32000", "");
  ok("Kennwort-Weg: kein Zertifikat und kein openssl mehr im Ablauf",
    oidcTxt.indexOf("openssl genrsa") === -1 && oidcTxt.indexOf("kind: CertificateSigningRequest") === -1, "");
  ok("Kennwort-Weg: kubectl fragt auf der Kommandozeile, nicht im Browser",
    oidcTxt.indexOf("--grant-type=password") !== -1, "");
  ok("Kennwort-Weg: --as prüft gegen den Namen mit Präfix",
    oidcTxt.indexOf("--as=oidc:bge@highq.org") !== -1, "");
  ok("Alle drei Anmeldearten liefern eine kubeconfig",
    ["cert","oidc","sa"].every(id => tenantGuide({identity:id}).some(s =>
      s.items.some(i => i.c.indexOf("kubectl config set-credentials") !== -1))), "");
  ok("Benutzer-Assistent: die CA kommt aus der eigenen kubeconfig, nicht nur aus kubeadm",
    tenantGuide({}).some(s => s.items.some(i =>
      i.c.indexOf("certificate-authority-data") !== -1)), "");
  ok("MetalLB-Assistent: jeder Satz hat beide Sprachen",
    mlbStrings.every(s => String(s).split("|").length === 2),
    mlbStrings.filter(s => String(s).split("|").length !== 2).slice(0,2).join(" / "));
  ok("MetalLB-Assistent: Pool und Ankündigung sind immer dabei",
    (function(){
      const c = metallbGuide({}).map(s => s.items.map(i => i.c).join(" ")).join(" ");
      return c.indexOf("kind: IPAddressPool") !== -1 && c.indexOf("kind: L2Advertisement") !== -1;
    })(), "");
  ok("MetalLB-Assistent: BGP bringt den Peer mit, L2 nicht",
    metallbGuide({mode:"bgp"}).some(s => s.items.some(i => i.c.indexOf("kind: BGPPeer") !== -1)) &&
    metallbGuide({mode:"l2"}).every(s => s.items.every(i => i.c.indexOf("kind: BGPPeer") === -1)), "");
  ok("MetalLB-Assistent: eine nackte Adresse wird zu /32",
    metallbOpts({range:"172.18.42.240"}).range === "172.18.42.240/32", "");
  ok("MetalLB-Assistent: der Bereich schlägt bis in die Befehle durch",
    metallbGuide({range:"10.10.0.20-10.10.0.25", ingress:true}).some(s =>
      s.items.some(i => i.c.indexOf("10.10.0.20") !== -1)), "");
  ok("MetalLB-Assistent: die Version bekommt ihr v",
    metallbOpts({version:"0.15.2"}).version === "v0.15.2", "");
  ok("MetalLB-Assistent: strictARP nur im IPVS-Modus",
    metallbGuide({ipvs:true}).length === metallbGuide({}).length + 1 &&
    metallbGuide({ipvs:true, mode:"bgp"}).length === metallbGuide({mode:"bgp"}).length, "");
  ok("MetalLB-Assistent: L2 wird als Ausfallsicherung benannt, nicht als Lastverteilung",
    metallbGuide({}).some(s => s.r.some(x => x.lvl === "warn" &&
      (x.m.indexOf("Lastverteilung") !== -1 || x.m.indexOf("load balancing") !== -1))), "");
  ok("MetalLB-Assistent: Markdown-Export nennt den Bereich",
    (function(){
      const keep = {m:CLUSTER_MODE, s:METALLB};
      CLUSTER_MODE = "metallb"; METALLB = {range:"10.10.0.20-10.10.0.25"};
      const md = clusterMarkdown();
      CLUSTER_MODE = keep.m; METALLB = keep.s;
      return md.indexOf("10.10.0.20") !== -1 && md.indexOf("MetalLB") !== -1;
    })(), "");
  ok("Alle drei Modi liefern Abschnitte mit gültiger Rolle",
    Object.keys(CLUSTER_MODES).every(m => {
      const keep = CLUSTER_MODE; CLUSTER_MODE = m;
      const g = clusterGuideOf(); CLUSTER_MODE = keep;
      return g.length && g.every(s => CLUSTER_ROLE[s.role] && s.h);
    }), "");
  ok("Benutzer-Assistent: jeder Satz hat beide Sprachen",
    tenStrings.every(zweisprachig),
    tenStrings.filter(s => !zweisprachig(s)).slice(0,2).join(" / "));
  ok("Benutzer-Assistent: jeder Abschnitt nennt seinen Ort",
    tenantGuide({linux:true}).every(s => CLUSTER_ROLE[s.role]), "");
  ok("Benutzer-Assistent: Namespace, Rolle und Prüfung sind immer dabei",
    (function(){
      const c = tenantGuide({}).map(s => s.items.map(i => i.c).join(" ")).join(" ");
      return c.indexOf("kind: Namespace") !== -1 && c.indexOf("kind: RoleBinding") !== -1 &&
             c.indexOf("auth can-i") !== -1;
    })(), "");
  ok("Benutzer-Assistent: die Bindung bleibt auf den Namespace begrenzt",
    tenantGuide({}).concat(tenantGuide({level:"admin"})).every(s =>
      s.items.every(i => i.c.indexOf("kind: ClusterRoleBinding") === -1)), "");
  ok("Benutzer-Assistent: der Name schlägt bis in die Befehle durch",
    (function(){
      const c = tenantGuide({user:"bastian", ns:"", linux:true}).map(s =>
        s.items.map(i => i.c).join(" ")).join(" ");
      return c.indexOf("team-bastian") !== -1 && c.indexOf("adduser --disabled-password --gecos \"\" bastian") !== -1;
    })(), "");
  ok("Benutzer-Assistent: ohne Zusatzhaken keine Quota-, Netz- und Linux-Abschnitte",
    tenantGuide({}).length + 3 === tenantGuide({quota:true, netpol:true, linux:true}).length, "");
  ok("Benutzer-Assistent: privileged wird als Fehler gemeldet",
    tenantGuide({pss:"privileged"})[0].r.some(x => x.lvl === "err"), "");
  ok("Benutzer-Assistent: das Zertifikat wird als unwiderruflich benannt",
    tenantGuide({identity:"cert"}).some(s => s.r.some(x => x.lvl === "err" &&
      (x.m.indexOf("zurückziehen") !== -1 || x.m.indexOf("revoked") !== -1))), "");
  ok("Benutzer-Assistent: Markdown-Export nennt Benutzer und Namespace",
    (function(){
      const keep = {m:CLUSTER_MODE, t:TENANT};
      CLUSTER_MODE = "tenant"; TENANT = {user:"anna"};
      const md = clusterMarkdown();
      CLUSTER_MODE = keep.m; TENANT = keep.t;
      return md.indexOf("anna") !== -1 && md.indexOf("team-anna") !== -1;
    })(), "");
  ok("Speicher-Wiki: keine leeren Zeichenketten in DE oder EN",
    swStrings.every(s => {
      const keep = LANG; let good = true;
      ["de","en"].forEach(l => { LANG = l; if (!String(t(s)).trim()) good = false; });
      LANG = keep; return good;
    }), "");
  const swCodes = [];
  STORAGE_WIKI.forEach(sec => {
    if (sec.code) swCodes.push(sec.code);
    (sec.steps||[]).forEach(st => { if (st.code) swCodes.push(st.code); });
  });
  ok("Speicher-Wiki: Codeblöcke überleben den Sprachwechsel",
    swCodes.every(c => {
      if (typeof c === "string") return c.indexOf("|") === -1;
      const keep = LANG; let good = true;
      ["de","en"].forEach(l => { LANG = l; if (t(c).split("\n").length !== c.de.split("\n").length) good = false; });
      LANG = keep; return good;
    }), "");
  ok("Speicher-Wiki: jede Anleitung nennt NFS, ZFS und S3",
    ["NFS anbinden", "ZFS anbinden", "S3 anbinden"].every(h =>
      STORAGE_WIKI.some(s => String(s.h).indexOf(h) === 0)), "");
  ok("Speicher-Wiki: Rezepte haben Schritte mit Code",
    STORAGE_WIKI.filter(s => s.steps).every(s => s.steps.some(st => st.code)), "");
  ok("Speicher-Wiki steht vollständig in der Suche",
    searchIndex().filter(x => x.g === "wiki").length === STORAGE_WIKI.length, "");
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
  {k:"have", t:"select", l:"Ausgangslage|Starting point", structural:true,
   opts:[["neu","Es gibt noch keinen Cluster|There is no cluster yet"],
         ["node","Der Cluster läuft — ein Knoten kommt dazu|The cluster runs — a node is joining"]],
   hint:"Beim Hinzufügen entfällt alles, was nur einmal passiert. Dafür kommt die Frage dazu, was zum bestehenden Cluster passen muss.|When adding, everything that only happens once falls away. In exchange comes the question of what has to match the existing cluster."},
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
  {k:"ha", t:"bool", structural:true, when:o => o.have !== "node",
   l:"Mehrere Hauptserver (Hochverfügbarkeit)|Several control-plane nodes (high availability)",
   hint:"Drei Hauptserver sind das Minimum, damit etcd eine Mehrheit bilden kann. Braucht einen Lastverteiler vor den API-Servern.|Three control-plane nodes are the minimum for etcd to form a majority. Requires a load balancer in front of the API servers."},
  {k:"workers", t:"number", l:"Anzahl Worker|Number of workers", ph:"3", half:true,
   when:o => o.have !== "node"},
  {k:"podCidr", t:"text", l:"Pod-Netz|Pod network", ph:"10.244.0.0/16", half:true,
   when:o => o.have !== "node",
   hint:"Darf sich mit keinem Netz überschneiden, das die Knoten sonst benutzen.|Must not overlap with any network the nodes already use."},
  {k:"svcCidr", t:"text", adv:true, l:"Service-Netz|Service network", ph:"10.96.0.0/12", half:true,
   when:o => o.have !== "node"},
  {k:"singleNode", t:"bool", when:o => o.have !== "node",
   l:"Auch auf dem Hauptserver Pods zulassen|Run pods on the control plane too",
   hint:"Für Testcluster ohne eigene Worker. Entfernt den Taint, den kubeadm setzt.|For test clusters without separate workers. Removes the taint kubeadm sets."},
  {k:"firewall", t:"bool", l:"Firewall-Regeln mit ausgeben|Include firewall rules"},
  {k:"lbRange", t:"text", l:"MetalLB-Adressbereich|MetalLB address range", ph:"192.168.178.240-192.168.178.250",
   when:o => o.have !== "node",
   hint:"Bereich, einzelne Adresse oder CIDR — eine einzelne Adresse wird zu /32 ergaenzt. Muss im **selben** Netz wie die Knoten liegen und ausserhalb des DHCP-Bereichs des Routers. MetalLB kuendigt die Adressen per ARP an — das geht nur im eigenen Segment, ein beliebiges freies Netz reicht nicht. Mit ip -4 addr auf einem Knoten siehst du Adresse und Praefix.|A range, a single address or a CIDR — a single address gets /32 appended. It has to sit in the **same** network as the nodes and outside the router's DHCP range. MetalLB announces the addresses via ARP — that only works within its own segment, an arbitrary free network will not do. Use ip -4 addr on a node to see the address and prefix."}
];

/* Alle drei auf 10.244.0.0/16: Calicos dokumentierte Vorgabe 192.168.0.0/16 ueberschneidet
   sich mit den meisten Heim- und Bueronetzen, und Calico liest das Pod-Netz ohnehin selbst
   aus der Cluster-Konfiguration. */
const CNI_CIDR = {flannel:"10.244.0.0/16", calico:"10.244.0.0/16", cilium:"10.244.0.0/16"};

function clusterOpts(o){
  const cni = o.cni || "cilium";
  return {
    /* add: Der Cluster steht schon, es kommt nur ein Knoten dazu. */
    add: o.have === "node",
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
    firewall: !!o.firewall,
    /* MetalLB akzeptiert CIDR oder Bereich, keine nackte Adresse. */
    lbRange: (function(v){
      v = (v || "").trim() || "192.168.178.240-192.168.178.250";
      return /^\d{1,3}(\.\d{1,3}){3}$/.test(v) ? v + "/32" : v;
    })(o.lbRange)
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

  prep.push({c:"kubeadm version -o short\nkubelet --version\nip -4 addr show | grep 'inet '\nip -4 route | grep -v '^default'",
    d:"Vor dem Weitermachen pruefen. Die ersten beiden Zeilen muessen dieselbe Minor-Version melden — sonst bricht der naechste Schritt mit *the kubelet version is higher than the control plane version* ab. Die letzten beiden Zeilen zeigen alle Netze, die dieser Knoten kennt — eigene Adressen und erreichbare Routen, VPN und andere Standorte eingeschlossen. **Keines** davon darf sich mit dem Pod- oder dem Service-Netz ueberschneiden.|Check before moving on. The first two lines have to report the same minor version — otherwise the next step aborts with *the kubelet version is higher than the control plane version*. The last two lines show every network this node knows — its own addresses and reachable routes, VPNs and other sites included. **None** of them may overlap the pod or the service network."});

  /* Beim Hinzufuegen kommt die wichtigste Frage zuerst: Passt der neue Knoten ueberhaupt? */
  if (o.add){
    sec("Was zum bestehenden Cluster passen muss|What has to match the existing cluster", "admin", {
      p:["Ein Knoten tritt nicht in ein leeres Feld ein, sondern in einen Cluster mit bereits getroffenen Entscheidungen: eine Version, ein Pod-Netz, ein CNI, eine API-Adresse. Die liest man aus, statt sie zu raten — sonst wiederholt sich der Fehler, den man beim ersten Aufsetzen schon hatte.|A node does not join an empty field but a cluster with decisions already made: a version, a pod network, a CNI, an API address. You read those out instead of guessing them — otherwise the mistake from the first setup repeats itself.",
         "Die wichtigste Zahl ist die Version. Der kubelet auf dem neuen Knoten darf **nicht neuer** sein als die Steuerungsebene. Die Paketquelle im nächsten Schritt muss deshalb auf die Minor-Version des Clusters zeigen, nicht auf die neueste.|The most important number is the version. The kubelet on the new node must **not be newer** than the control plane. So the package repository in the next step has to point at the cluster's minor version, not at the newest one."],
      items:[
        {c:"kubectl get nodes -o wide",
         d:"Die Spalte VERSION nennt die Minor-Version, die auch der neue Knoten bekommen muss. Die Spalte OS-IMAGE zeigt nebenbei, ob die vorhandenen Knoten dasselbe Betriebssystem fahren.|The VERSION column names the minor version the new node has to get as well. The OS-IMAGE column shows in passing whether the existing nodes run the same operating system."},
        {c:"kubectl -n kube-system get configmap kubeadm-config -o yaml \\\n  | grep -E 'podSubnet|serviceSubnet|controlPlaneEndpoint|kubernetesVersion'",
         d:"Die Entscheidungen des ersten Aufsetzens, schwarz auf weiß. Pod- und Service-Netz stehen fest und lassen sich nachträglich nicht ändern — der neue Knoten fügt sich ein, nicht umgekehrt.|The decisions from the first setup, in black and white. Pod and service network are fixed and cannot be changed afterwards — the new node fits in, not the other way round."},
        {c:"kubectl get pods -n kube-system -o custom-columns=NAME:.metadata.name,IMAGE:.spec.containers[0].image \\\n  | grep -Ei 'cilium|calico|flannel|weave'",
         d:"Welches CNI läuft, entscheidet, welche Ports die Firewall braucht — und ob der neue Knoten ohne weiteres Zutun ein Pod-Netz bekommt. Ein CNI wird nicht je Knoten installiert: Das DaemonSet verteilt sich von allein.|Which CNI runs decides which ports the firewall needs — and whether the new node gets a pod network without further help. A CNI is not installed per node: the daemon set spreads by itself."},
        {c:"kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{\"\\t\"}{.spec.podCIDR}{\"\\n\"}{end}'",
         d:"Zeigt, wie viel vom Pod-Netz schon vergeben ist. Bei einem /16 und einem /24 je Knoten sind 256 Knoten möglich — bei einem /20 nur sechzehn, und der siebzehnte bekommt gar keines mehr.|Shows how much of the pod network is already handed out. With a /16 and a /24 per node, 256 nodes are possible — with a /20 only sixteen, and the seventeenth gets none at all."}
      ],
      r:[{lvl:"err", m:t("Trägst du oben eine neuere Version ein als die des Clusters, installiert die Paketquelle einen zu neuen kubelet, und der Beitritt scheitert an der Meldung the kubelet version is higher than the control plane version. Die Steuerungsebene wird zuerst aktualisiert, die Knoten danach — nie umgekehrt.|If you enter a version above that is newer than the cluster's, the repository installs a kubelet that is too new and the join fails with the kubelet version is higher than the control plane version. The control plane is upgraded first, the nodes afterwards — never the other way round.")}]
    });
  }

  sec("Vorbereitung|Preparation", o.add ? "neu" : "all", {
    p:[o.add
       ? "Diese Schritte laufen **nur auf dem neuen Rechner**. Die vorhandenen Knoten bleiben unangetastet — nichts davon wirkt auf den laufenden Cluster.|These steps run **only on the new machine**. The existing nodes stay untouched — none of this affects the running cluster."
       : "Diese Schritte laufen unverändert auf **jedem** Rechner — Hauptserver wie Worker. Am schnellsten geht es, wenn du sie parallel auf allen Knoten ausführst.|These steps run identically on **every** machine — control plane and workers alike. Fastest is to run them on all nodes in parallel."],
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

  /* Ein /24 reicht fuer einen Node: kubeadm gibt jedem Knoten standardmaessig ein /24. */
  const prefix = (/\/(\d{1,2})\s*$/.exec(o.podCidr) || [])[1];
  const cidrRisk = [];
  if (prefix !== undefined && +prefix >= 24)
    cidrRisk.push({lvl:"err", m:t("Das Pod-Netz " + o.podCidr + " ist zu klein: kubeadm teilt jedem Knoten ein eigenes /24 zu, also reicht ein /24 fuer genau einen Node — jeder weitere bekommt gar kein Pod-Netz. Ueblich ist ein /16.|The pod network " + o.podCidr + " is too small: kubeadm assigns each node its own /24, so a /24 covers exactly one node — every further node gets no pod network at all. A /16 is the usual choice.")});
  else if (prefix !== undefined && +prefix > 20)
    cidrRisk.push({lvl:"warn", m:t("Das Pod-Netz " + o.podCidr + " ist knapp bemessen: Jeder Knoten belegt daraus ein /24.|The pod network " + o.podCidr + " is tight: every node takes a /24 out of it.")});
  if (/^192\.168\./.test(o.podCidr))
    cidrRisk.push({lvl:"warn", m:t("192.168.x ist der uebliche Bereich von Heim- und Bueronetzen — und zugleich Calicos Vorgabe. Ueberschneidet er sich mit dem Netz der Knoten, kollidieren Pod-Adressen mit echten Geraeten, und die Fehlersuche fuehrt weit in die Irre. Vorher mit ip -4 addr vergleichen und im Zweifel 10.244.0.0/16 nehmen.|192.168.x is the usual range for home and office networks — and at the same time Calico's default. If it overlaps the nodes' network, pod addresses collide with real devices and troubleshooting leads far astray. Compare with ip -4 addr first and use 10.244.0.0/16 when in doubt.")});

  /* --- erster Hauptserver --- */
  const initCmd = ["sudo kubeadm init",
    "  --pod-network-cidr=" + o.podCidr,
    o.svcCidr ? "  --service-cidr=" + o.svcCidr : "",
    (o.endpoint || o.ha) ? "  --control-plane-endpoint=" + api + ":6443" : "",
    o.ha ? "  --upload-certs" : ""
  ].filter(Boolean).join(" \\\n");

  const cp = [{c:initCmd,
    d:"Ohne --kubernetes-version, mit Absicht: kubeadm nimmt dann genau die Version des installierten kubeadm — die aus der Paketquelle von oben. Eine Version von Hand einzutragen fuehrt zuverlaessig zu \"the kubelet version is higher than the control plane version\". Legt etcd, API-Server, Controller-Manager und Scheduler an. Am Ende gibt der Befehl die Beitrittsbefehle aus — **diese Ausgabe aufheben**, sie enthält Token und Prüfsumme.|Deliberately without --kubernetes-version: kubeadm then uses exactly the version of the installed kubeadm — the one from the repository above. Entering a version by hand reliably produces \"the kubelet version is higher than the control plane version\". Creates etcd, the API server, the controller manager and the scheduler. At the end it prints the join commands — **keep that output**, it contains the token and the checksum."}];
  cp.push({c:"mkdir -p $HOME/.kube\nsudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config\nsudo chown $(id -u):$(id -g) $HOME/.kube/config",
    d:"Erst danach funktioniert kubectl als normaler Benutzer.|Only after this does kubectl work as an ordinary user."});

  if (o.cni === "cilium") cp.push({c:"CILIUM_CLI=v0.16.16   # aktuelle Version aus den Release Notes\ncurl -sL --fail --remote-name-all https://github.com/cilium/cilium-cli/releases/download/${CILIUM_CLI}/cilium-linux-amd64.tar.gz\nsudo tar xzvfC cilium-linux-amd64.tar.gz /usr/local/bin\ncilium install\ncilium status --wait",
    d:"Ohne CNI bleiben alle Knoten NotReady und die CoreDNS-Pods hängen in Pending. Das ist kein Fehler, sondern der normale Zwischenstand.|Without a CNI every node stays NotReady and the CoreDNS pods sit in Pending. That is not a fault, it is the normal intermediate state."});
  if (o.cni === "calico") cp.push({c:"CALICO=v3.29.1   # aktuelle Version aus den Release Notes\nkubectl apply -f https://raw.githubusercontent.com/projectcalico/calico/${CALICO}/manifests/calico.yaml",
    d:"Calico übernimmt das Pod-Netz und bringt NetworkPolicy gleich mit. Im Manifest steht zwar 192.168.0.0/16, aber Calico liest das tatsächliche Pod-Netz aus der Cluster-Konfiguration — genau deshalb ist hier 10.244.0.0/16 voreingestellt, das sich mit keinem üblichen Heimnetz überschneidet.|Calico takes over the pod network and brings network policy with it. The manifest says 192.168.0.0/16, but Calico reads the actual pod network from the cluster configuration — which is exactly why 10.244.0.0/16 is preset here, a range that collides with no common home network."});
  if (o.cni === "flannel") cp.push({c:"kubectl apply -f https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml",
    d:"Flannel erwartet zwingend 10.244.0.0/16 als Pod-Netz. Flannel kennt keine NetworkPolicy — dafür braucht es später zusätzlich Calico oder Cilium.|Flannel insists on 10.244.0.0/16 as the pod network. Flannel has no network policy — that needs Calico or Cilium alongside it later."});

  if (o.singleNode) cp.push({c:"kubectl taint nodes --all node-role.kubernetes.io/control-plane-",
    d:"Nimmt den Taint weg, mit dem kubeadm normale Arbeitslast vom Hauptserver fernhält. Für einen Testcluster richtig, für Produktion nicht.|Removes the taint with which kubeadm keeps ordinary workloads off the control plane. Right for a test cluster, not for production."});

  if (!o.add) sec("Erster Hauptserver|First control-plane node", "cp", {
    p:["Ab hier unterscheiden sich die Rechner. Diese Schritte laufen **nur auf dem ersten Hauptserver**.|From here the machines differ. These steps run **only on the first control-plane node**."],
    items:cp,
    r:cidrRisk.concat(noEndpoint ? [{lvl:"err", m:t("Fuer mehrere Hauptserver ist --control-plane-endpoint zwingend. Ohne ihn schreibt kubeadm keinen controlPlaneEndpoint in die Cluster-Konfiguration, und jeder weitere Hauptserver scheitert an der Meldung unable to add a new control plane instance to a cluster that doesn't have a stable controlPlaneEndpoint address. Nachtraeglich aendern heisst im Zweifel: Cluster zuruecksetzen und neu aufsetzen. Trag die Adresse oben ein, bevor du anfaengst.|For several control-plane nodes, --control-plane-endpoint is mandatory. Without it kubeadm writes no controlPlaneEndpoint into the cluster configuration, and every further control-plane node fails with unable to add a new control plane instance to a cluster that doesn't have a stable controlPlaneEndpoint address. Changing it afterwards usually means resetting the cluster and starting over. Enter the address above before you begin.")}] : [])
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
  if (o.ha) join.push({c:"sudo kubeadm init phase upload-certs --upload-certs\nkubeadm token create --print-join-command",
    d:"Beide Werte auf einmal, weil ein weiterer Hauptserver beide braucht: Der erste Befehl lädt die Zertifikate erneut in das Secret kubeadm-certs und gibt den neuen certificate-key als **letzte Zeile** aus, der zweite den vollständigen Beitrittsbefehl mit Token und Hash. Aneinandergehängt ergibt das die Zeile für den neuen Hauptserver.|Both values at once, because an additional control-plane node needs both: the first command uploads the certificates into the kubeadm-certs secret again and prints the new certificate key as its **last line**, the second prints the complete join command with token and hash. Put together they form the line for the new control-plane node."});

  sec("Beitrittsdaten besorgen|Getting the join values", "cp", {
    p:[o.add
       ? "Genau hier fängt das Hinzufügen an. Das Token aus dem ersten Aufsetzen ist längst abgelaufen — es gilt 24 Stunden. Du erzeugst dir ein frisches, **auf einem vorhandenen Hauptserver**, nicht auf dem Rechner, der beitreten soll.|This is exactly where adding begins. The token from the first setup expired long ago — it is valid for 24 hours. You create a fresh one, **on an existing control-plane node**, not on the machine that wants to join."
       : "Die Platzhalter in den folgenden Befehlen stammen alle aus der Ausgabe von `kubeadm init`. Ist die verloren, holst du sie hier — **auf dem ersten Hauptserver**, nicht auf dem Rechner, der beitreten soll.|The placeholders in the commands below all come from the output of `kubeadm init`. If that is lost, this is where you get them — **on the first control-plane node**, not on the machine that wants to join.",
       "Jeder Wert steht in der Ausgabe von `kubeadm init` — und lässt sich jederzeit neu beschaffen.|Every value appears in the output of `kubeadm init` — and can be obtained again at any time."],
    table:[
      ["Platzhalter|Placeholder","Was es ist|What it is","Gültig|Valid for","Woher|Where from"],
      ["`<TOKEN>`","Einmalkennwort für den Beitritt|One-time password for joining","24 Stunden|24 hours",
       "`kubeadm token create --print-join-command`"],
      ["`<HASH>`","Fingerabdruck der Cluster-CA|Fingerprint of the cluster CA","unbegrenzt|indefinitely",
       "derselbe Befehl — oder der openssl-Dreisatz unten|the same command — or the openssl trio below"]
    ].concat(o.ha ? [["`<KEY>`","Schlüssel für die hochgeladenen Zertifikate|Key for the uploaded certificates",
       "2 Stunden|2 hours","`kubeadm init phase upload-certs --upload-certs`"]] : []),
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
      {c:"KEY=$(sudo kubeadm init phase upload-certs --upload-certs | tail -1)\necho \"$(kubeadm token create --print-join-command) --control-plane --certificate-key $KEY\"",
       d:"Auf dem **ersten** Hauptserver ausführen: Das erzeugt einen frischen Zertifikatsschlüssel und ein frisches Token und setzt daraus die vollständige Zeile zusammen, die du oben brauchst. Weil beide Werte neu sind, spielt es keine Rolle, wie lange die Installation her ist.|Run on the **first** control-plane node: this creates a fresh certificate key and a fresh token and assembles the complete line you need above. Since both values are new, it does not matter how long ago the installation was."},
      {c:"getent hosts " + api + "\nkubectl -n kube-system get cm kubeadm-config -o yaml | grep controlPlaneEndpoint",
       d:"Die Gegenprobe, wohin die API-Adresse tatsaechlich zeigt. Loest sie auf die IP **eines einzelnen** Hauptservers auf, ist der Cluster zwar erweiterbar, aber nicht hochverfuegbar: Faellt diese Maschine aus, laeuft der Cluster mit den anderen beiden weiter — nur erreicht niemand mehr die API, weil der Name auf eine tote Adresse zeigt. Fuer echte Hochverfuegbarkeit braucht der Name eine schwebende Adresse: kube-vip als statischer Pod auf den Hauptservern, keepalived, oder ein Lastverteiler davor. Weil sich dabei nur die Aufloesung aendert und nicht der Name, bleiben die Zertifikate gueltig.|The counter-check on where the API address actually points. If it resolves to the IP of **one single** control-plane node, the cluster can be extended but is not highly available: if that machine fails, the cluster keeps running on the other two — only nobody can reach the API any more, because the name points at a dead address. Real high availability needs a floating address for that name: kube-vip as a static pod on the control-plane nodes, keepalived, or a load balancer in front. Since only the resolution changes and not the name, the certificates stay valid."},
      {c:"sudo kubeadm init phase upload-certs --upload-certs\nkubeadm token create --print-join-command",
       d:"Dasselbe in zwei Schritten, falls du die Werte einzeln sehen willst. Der Zertifikatsschlüssel steht in der letzten Zeile der ersten Ausgabe.|The same in two steps, if you would rather see the values separately. The certificate key is the last line of the first output."}
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
       d:"Auf **jedem** Knoten, der schon beigetreten ist. Reihenfolge und Nacharbeiten stehen im letzten Abschnitt **Neu aufsetzen**.|On **every** node that has already joined. The order and the follow-up work are in the last section, **Starting over**."},
      {c:"echo '" + (o.endpoint ? "192.168.0.10 " + o.endpoint : "192.168.0.10 k8s-api.firma.de") + "' | sudo tee -a /etc/hosts",
       d:"Auf allen Knoten, solange es keinen DNS-Eintrag gibt: Die IP ist vorerst der erste Hauptserver. Später zeigt derselbe Name auf den Lastverteiler oder eine VIP — und weil sich nur die Auflösung ändert, bleiben die Zertifikate gültig.|On every node as long as there is no DNS record: the IP is the first control-plane node for now. Later the same name points at the load balancer or a VIP — and because only the resolution changes, the certificates stay valid."},
      {c:initCmd,
       d:"Neu aufsetzen, diesmal mit Endpoint. Danach greifen die Beitrittsbefehle wie beschrieben.|Set up again, this time with the endpoint. After that the join commands work as described."}
    ],
    r:[{lvl:"warn", m:t("Zeigt der Endpoint auf die IP eines einzelnen Hauptservers, laesst kubeadm zwar weitere Master zu — hochverfuegbar ist der Cluster damit trotzdem nicht, weil die Adresse mit genau dieser Maschine steht und faellt.|If the endpoint points at a single control-plane node's IP, kubeadm does allow further masters — but the cluster is still not highly available, because the address lives and dies with that one machine.")}]
  });

  /* --- Worker --- */
  sec(o.add ? "Auf dem neuen Knoten|On the new node" : "Auf jedem Worker|On every worker", o.add ? "neu" : "worker", {
    p:[o.add
       ? "Der eigentliche Beitritt. Danach übernimmt der Cluster: Der CNI-DaemonSet verteilt sich von allein auf den neuen Knoten, und der Scheduler fängt an, Pods dorthin zu legen.|The actual join. After that the cluster takes over: the CNI daemon set spreads to the new node by itself, and the scheduler starts placing pods there."
       : (o.workers ? "Auf allen " + o.workers + " Workern" : "Auf jedem Worker") + " — nach der Vorbereitung ganz oben, aber ohne die Schritte des Hauptservers.|" +
         (o.workers ? "On all " + o.workers + " workers" : "On every worker") + " — after the preparation above, but without any of the control-plane steps."],
    items:[
      {c:"sudo kubeadm join " + api + ":6443 \\\n  --token <TOKEN> \\\n  --discovery-token-ca-cert-hash sha256:<HASH>",
       d:"Der Befehl für einen Worker, ohne --control-plane. `<TOKEN>` und `<HASH>` kommen aus dem Abschnitt **Beitrittsdaten besorgen** — dort steht auch, wie du sie neu erzeugst.|The command for a worker, without --control-plane. `<TOKEN>` and `<HASH>` come from the section **Getting the join values**, which also shows how to create them anew."}
    ].concat(o.add ? [{c:"sudo kubeadm join " + api + ":6443 \\\n  --token <TOKEN> \\\n  --discovery-token-ca-cert-hash sha256:<HASH> \\\n  --control-plane --certificate-key <KEY>",
       d:"Nur wenn der neue Knoten ein weiterer **Hauptserver** werden soll. Dafür braucht es zusätzlich den certificate-key, und der Cluster muss von Anfang an einen controlPlaneEndpoint haben — fehlt der, geht es nachträglich nicht.|Only if the new node is to become another **control-plane node**. That additionally needs the certificate key, and the cluster must have had a controlPlaneEndpoint from the start — without it, this is not possible afterwards."}] : []),
    r:[{lvl:"err", m:t("kubectl gehört nicht auf die Worker und die admin.conf schon gar nicht. Wer sie dorthin kopiert, gibt jedem mit Zugang zum Worker die volle Kontrolle über den Cluster.|kubectl does not belong on the workers and admin.conf certainly does not. Copying it there hands anyone with access to that worker full control of the cluster.")}]
  });

  /* --- Prüfen --- */
  sec("Prüfen|Checking", "cp", {
    p:[o.add
       ? "Auf einem Hauptserver, sobald der neue Knoten beigetreten ist. Er taucht zuerst als NotReady auf — das bleibt so, bis das CNI seine Pods dorthin verteilt hat, meist eine knappe Minute.|On a control-plane node, once the new node has joined. It first appears as NotReady — and stays that way until the CNI has spread its pods there, usually under a minute."
       : "Auf dem Hauptserver, sobald alle Knoten beigetreten sind.|On the control-plane node, once every node has joined."],
    items:[
      {c:"kubectl get nodes -o wide",
       d:"Alle Knoten müssen Ready sein. NotReady direkt nach dem Beitritt ist normal, solange das CNI seine Pods noch verteilt.|Every node has to be Ready. NotReady right after joining is normal while the CNI is still distributing its pods."},
      {c:"kubectl get pods -A",
       d:"CoreDNS ist der beste Anzeiger: Läuft es, funktioniert das Pod-Netz.|CoreDNS is the best indicator: if it runs, the pod network works."},
      {c:"kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{\": \"}" +
         "{range .status.conditions[?(@.type==\"Ready\")]}{.message}{end}{\"\\n\"}{end}'",
       d:"Sagt im Klartext, **warum** ein Knoten NotReady ist, statt es raten zu lassen. Steht dort *cni plugin not initialized*, fehlt schlicht das Netzwerk-Plugin — der Normalzustand direkt nach dem Beitritt. Steht etwas anderes da, ist es auch etwas anderes.|Says in plain words **why** a node is NotReady instead of leaving you guessing. If it reads *cni plugin not initialized*, the network plugin is simply missing — the normal state right after joining. If it says something else, it is something else."},
      {c:"kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{\"\\t\"}{.spec.podCIDR}{\"\\n\"}{end}'",
       d:"Jeder Knoten muss ein eigenes Teilnetz haben — bei einem /16 als Pod-Netz also 10.244.0.0/24, 10.244.1.0/24 und so weiter. Bleibt die Spalte bei einem Knoten leer, war das Pod-Netz zu klein gewaehlt.|Every node has to have its own subnet — with a /16 as the pod network that means 10.244.0.0/24, 10.244.1.0/24 and so on. If the column stays empty for a node, the pod network was chosen too small."},
      {c:"kubectl run probe --image=nginx:1.27-alpine --restart=Never --rm -it -- sh",
       d:"Ein Pod von Hand, um den Weg von der Registry bis in den Container einmal zu gehen.|A pod by hand, to walk the path from the registry into the container once."}
    ].concat(o.add ? [{c:"kubectl run neutest --image=busybox:1.36 --restart=Never --rm -it \\\n  --overrides='{\"spec\":{\"nodeName\":\"KNOTEN\"}}' -- \\\n  nslookup kubernetes.default.svc.cluster.local",
       d:"Ein Pod, der ausdrücklich auf dem neuen Knoten landet. Erst das beweist, dass Registry, Pod-Netz und DNS auf **dieser** Maschine arbeiten — ein Pod irgendwo im Cluster beweist es nicht.|A pod that lands on the new node deliberately. Only that proves registry, pod network and DNS work on **this** machine — a pod somewhere in the cluster does not prove it."}] : [])
  });

  sec("Funktionstest|Smoke test", "cp", {
    p:["Der Reihe nach von innen nach aussen. Jeder Schritt setzt den vorigen voraus — bricht einer ab, ist die Ursache dort und nicht weiter unten.|From the inside out, in order. Each step needs the one before it — if one fails, the cause is there and not further down."],
    items:[
      {c:"kubectl get nodes -o wide\nkubectl get pods -A",
       d:"Erwartung: alle Knoten Ready, alle Pods Running oder Completed. Haengt CoreDNS in Pending, laeuft das CNI noch nicht.|Expected: every node Ready, every pod Running or Completed. If CoreDNS sits in Pending, the CNI is not up yet."},
      {c:"kubectl run dnstest --image=busybox:1.36 --restart=Never --rm -it -- \\\n  nslookup kubernetes.default.svc.cluster.local",
       d:"Der **vollstaendige** Name mit Absicht: BusyBox wertet die search-Liste aus /etc/resolv.conf nicht zuverlaessig aus und fragt Namen mit Punkt so ab, wie sie dastehen. Die Kurzform kubernetes.default liefert deshalb NXDOMAIN, obwohl DNS einwandfrei arbeitet. Erwartung: Address 10.96.0.1.|The **full** name deliberately: BusyBox does not reliably apply the search list from /etc/resolv.conf and queries names containing a dot exactly as written. The short form kubernetes.default therefore returns NXDOMAIN even though DNS works perfectly. Expected: Address 10.96.0.1."},
      {c:"kubectl run dnstest --image=busybox:1.36 --restart=Never --rm -it -- \\\n  cat /etc/resolv.conf",
       d:"Falls die Abfrage scheitert: Hier muss nameserver 10.96.0.10 stehen, dazu die search-Liste mit default.svc.cluster.local. Antwortet 10.96.0.10 ueberhaupt — egal mit was —, sind Pod-Netz und kube-proxy in Ordnung und das Problem liegt in CoreDNS selbst. Kommt dagegen ein Timeout, ist es das Netz.|If the query fails: this has to show nameserver 10.96.0.10 plus the search list with default.svc.cluster.local. If 10.96.0.10 answers at all — with anything — the pod network and kube-proxy are fine and the problem is inside CoreDNS. A timeout instead means it is the network."},
      {c:"kubectl create deployment web --image=nginx:1.27-alpine --replicas=3\nkubectl expose deployment web --port=80\nkubectl get pods -o wide\nkubectl get endpoints web",
       d:"Erwartung: drei Pods, moeglichst auf verschiedenen Knoten, und drei Adressen unter ENDPOINTS. Steht dort none, trifft der Selector nicht.|Expected: three pods, ideally on different nodes, and three addresses under ENDPOINTS. If it says none, the selector does not match."},
      {c:"kubectl run probe --image=busybox:1.36 --restart=Never --rm -it -- \\\n  wget -qO- http://web",
       d:"Der aussagekraeftigste Test ueberhaupt, weil er den normalen Resolver des Containers benutzt und nicht BusyBox' nslookup: ueber den Service-Namen, aus einem anderen Pod, moeglicherweise von einem anderen Knoten. Kommt die nginx-Startseite zurueck, funktionieren DNS, kube-proxy und das Overlay ueber Knotengrenzen hinweg — dann ist die Frage nach dem NXDOMAIN oben erledigt.|The most meaningful test of all, because it uses the container's normal resolver rather than BusyBox's nslookup: via the service name, from another pod, possibly on another node. If the nginx welcome page comes back, DNS, kube-proxy and the overlay across node boundaries all work — and the NXDOMAIN question above is settled."},
      {c:"kubectl patch svc web -p '{\"spec\":{\"type\":\"NodePort\"}}'\nkubectl get svc web\n# dann vom eigenen Rechner, nicht vom Knoten:\ncurl http://ADRESSE-EINES-KNOTENS:ANGEZEIGTER-NODEPORT",
       d:"Der einfachste Test von aussen, ganz ohne MetalLB und ohne Ingress. Die zweite Spalte zeigt etwas wie 80:31234/TCP — die Zahl hinter dem Doppelpunkt ist der Port. Erreichbar ist er auf **jedem** Knoten, auch auf denen, wo gar kein Pod laeuft. Klappt das, sind Knoten, kube-proxy und Pod in Ordnung, und alles Weitere liegt dann allein an MetalLB oder am Ingress.|The simplest test from outside, with no MetalLB and no ingress. The second column shows something like 80:31234/TCP — the number after the colon is the port. It is reachable on **every** node, including those where no pod runs. If that works, nodes, kube-proxy and pod are fine, and anything further is down to MetalLB or the ingress alone."},
      {c:"METALLB=v0.14.9   # aktuelle Version aus den Release Notes\nkubectl apply -f https://raw.githubusercontent.com/metallb/metallb/${METALLB}/config/manifests/metallb-native.yaml\nkubectl -n metallb-system wait --for=condition=available deploy/controller --timeout=120s",
       d:"Auf eigener Hardware vergibt niemand externe Adressen — MetalLB uebernimmt das. In der Cloud entfaellt dieser Schritt, dort macht es der Anbieter.|On your own hardware nothing hands out external addresses — MetalLB does that job. In the cloud you skip this step; the provider does it."},
      {c:"cat <<'EOF' | kubectl apply -f -\napiVersion: metallb.io/v1beta1\nkind: IPAddressPool\nmetadata:\n  name: lan\n  namespace: metallb-system\nspec:\n  addresses:\n    - " + o.lbRange + "\n---\napiVersion: metallb.io/v1beta1\nkind: L2Advertisement\nmetadata:\n  name: lan\n  namespace: metallb-system\nspec:\n  ipAddressPools:\n    - lan\nEOF",
       d:"Der Bereich muss im Netz der Knoten liegen und ausserhalb dessen, was der Router per DHCP vergibt — sonst bekommt irgendwann ein Laptop dieselbe Adresse wie dein Service. Eine **einzelne** Adresse ist ein voellig ueblicher Fall: Sie geht an den Ingress-Controller, und alle Anwendungen teilen sie sich ueber ihre Hostnamen. Mit serviceAllocation und autoAssign false laesst sich ein Pool zusaetzlich auf bestimmte Namespaces oder Dienste festnageln.|The range has to sit in the nodes' network and outside what the router hands out via DHCP — otherwise a laptop eventually gets the same address as your service. A **single** address is a perfectly normal case: it goes to the ingress controller and every application shares it through its hostname. With serviceAllocation and autoAssign false a pool can additionally be pinned to particular namespaces or services."},
      {c:"kubectl patch svc web -p '{\"spec\":{\"type\":\"LoadBalancer\"}}'\nkubectl get svc web",
       d:"Erwartung: unter EXTERNAL-IP steht nach wenigen Sekunden eine Adresse aus dem Bereich oben. Bleibt dort dauerhaft Pending, findet MetalLB keinen freien Platz — oder der Pool passt nicht zum Netz der Knoten.|Expected: an address from the range above appears under EXTERNAL-IP within seconds. If it stays Pending, MetalLB finds no free slot — or the pool does not match the nodes' network."},
      {c:"curl http://ADRESSE-AUS-EXTERNAL-IP",
       d:"Vom eigenen Rechner aus, nicht vom Knoten. Kommt die nginx-Seite, ist der Weg von aussen bis in den Pod offen.|From your own machine, not from a node. If the nginx page appears, the path from outside into the pod is open."},
      {c:"kubectl -n metallb-system logs -l component=speaker --tail=30\nip neigh | grep ADRESSE-AUS-EXTERNAL-IP",
       d:"Nur noetig, wenn die Adresse zwar vergeben ist, aber nichts antwortet. MetalLB kuendigt sie im lokalen Netz per ARP an. Taucht sie in der Nachbarschaftstabelle deines Rechners nicht auf, liegt sie ausserhalb des Subnetzes der Knoten oder die L2Advertisement fehlt. Antwortet der NodePort von oben weiterhin, ist der Cluster in Ordnung und es liegt allein an MetalLB.|Only needed if the address is assigned but nothing answers. MetalLB announces it on the local network via ARP. If it does not show up in your machine's neighbour table, it sits outside the nodes' subnet or the L2Advertisement is missing. If the NodePort above still answers, the cluster is fine and it is MetalLB alone."},
      {c:"kubectl -n ingress-nginx get pods\nkubectl get ingressclass",
       d:"Zuerst: Gibt es den Controller ueberhaupt? Erwartung ist ein Pod im Zustand Running und eine IngressClass namens nginx. Fehlt die Klasse, wird jede Ingress-Regel spaeter stillschweigend ignoriert — ohne Fehlermeldung, denn niemand fuehlt sich zustaendig.|First: does the controller exist at all? Expected is a pod in Running and an IngressClass called nginx. Without that class every ingress rule is silently ignored later — with no error, because nobody feels responsible."},
      {c:"kubectl -n ingress-nginx patch svc ingress-nginx-controller \\\n  -p '{\"spec\":{\"type\":\"LoadBalancer\"}}'\nkubectl -n ingress-nginx get svc ingress-nginx-controller",
       d:"Das Baremetal-Manifest des Ingress-Controllers legt einen NodePort-Service an. Mit MetalLB bekommt er stattdessen eine eigene Adresse — die Adresse, auf die spaeter alle Hostnamen zeigen.|The ingress controller's baremetal manifest creates a NodePort service. With MetalLB it gets an address of its own instead — the address all your hostnames will later point at."},
      {c:"curl -I http://ADRESSE-DES-INGRESS",
       d:"Der aussagekraeftigste Einzeltest, noch **ohne** jede Ingress-Regel. Erwartung: **404 Not Found** mit einer Zeile server: nginx. Das klingt nach Fehler, ist aber der Beweis, dass der Controller lebt und erreichbar ist — er hat nur noch keine passende Regel. Kommt stattdessen connection refused oder ein Timeout, ist es kein Ingress-Problem, sondern eines der Adresse.|The single most telling test, still **without** any ingress rule. Expected: **404 Not Found** with a server: nginx line. That looks like a failure but proves the controller is alive and reachable — it simply has no matching rule yet. If you get connection refused or a timeout instead, this is not an ingress problem but an address problem."},
      {c:"kubectl create ingress web --class=nginx \\\n  --rule=\"web.example.lan/*=web:80\"\nkubectl get ingress",
       d:"Erwartung: Nach ein paar Sekunden steht in der Spalte ADDRESS die Adresse des Controllers. Bleibt sie leer, hat der Controller die Regel nicht angenommen — dann stimmt die Klasse nicht mit dem ueberein, was kubectl get ingressclass oben gezeigt hat.|Expected: after a few seconds the ADDRESS column shows the controller's address. If it stays empty the controller has not taken the rule — then the class does not match what kubectl get ingressclass showed above."},
      {c:"curl -H 'Host: web.example.lan' http://ADRESSE-DES-INGRESS",
       d:"Der Host-Header ersetzt den DNS-Eintrag fuer den ersten Test. Kommt die nginx-Seite, funktioniert die ganze Kette: MetalLB, Ingress-Controller, Regel, Service, Pod. Die beiden Fehlerbilder sind eindeutig: **404** heisst, die Regel greift nicht — meist ein Tippfehler im Hostnamen. **503** heisst, die Regel greift, aber der Service hat keine bereiten Endpoints. Danach den Namen im DNS oder in /etc/hosts auf dieselbe Adresse zeigen lassen.|The Host header stands in for the DNS record for a first test. If the nginx page appears, the whole chain works: MetalLB, ingress controller, rule, service, pod. The two failure modes are unambiguous: **404** means the rule does not match — usually a typo in the hostname. **503** means the rule matches but the service has no ready endpoints. After that, point the name at the same address in DNS or /etc/hosts."},
      {c:"kubectl -n ingress-nginx logs -l app.kubernetes.io/component=controller \\\n  --tail=20 -f",
       d:"Die letzte Instanz bei jedem Ingress-Problem: Der Controller schreibt jede Anfrage mit, samt Statuscode. Taucht dein curl hier auf, ist die Anfrage angekommen und die Ursache liegt in Regel oder Backend. Taucht sie nicht auf, hat sie den Controller nie erreicht — dann ist es das Netz oder die Adresse.|The last resort for any ingress problem: the controller logs every request with its status code. If your curl shows up here, the request arrived and the cause lies in the rule or the backend. If it does not, it never reached the controller — then it is the network or the address."},
      {c:"kubectl delete ingress web\nkubectl delete svc web\nkubectl delete deployment web",
       d:"Aufraeumen. MetalLB und der Ingress-Controller bleiben stehen, die brauchst du weiter.|Clean up. MetalLB and the ingress controller stay, you will keep needing those."}
    ],
    r:[{lvl:"warn", m:t("Bleibt ein Service auf Pending oder ein Pod auf ContainerCreating, hilft kubectl describe auf genau dieses Objekt weiter — der Abschnitt Events ganz unten nennt die Ursache fast immer im Klartext.|If a service stays Pending or a pod stays in ContainerCreating, kubectl describe on exactly that object is the way forward — the Events section at the bottom almost always names the cause outright.")}]
  });

  if (!o.add) sec("Danach|Afterwards", "cp", {
    p:["Ein frischer Cluster kann noch nichts von außen annehmen und keinen Speicher bereitstellen. Diese drei Dinge fehlen praktisch immer.|A fresh cluster can neither accept anything from outside nor provide storage. These three are missing practically every time."],
    items:[
      {c:"kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/baremetal/deploy.yaml",
       d:"Ein Ingress-Controller, sonst bleibt jeder Ingress wirkungslos. Auf eigener Hardware ist zusätzlich MetalLB nötig, damit ein Service vom Typ LoadBalancer eine Adresse bekommt.|An ingress controller, otherwise every Ingress stays inert. On your own hardware you also need MetalLB so a LoadBalancer service gets an address."},
      {c:"kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml",
       d:"Ohne metrics-server liefert kubectl top nichts und ein HorizontalPodAutoscaler skaliert nie.|Without metrics-server, kubectl top returns nothing and a HorizontalPodAutoscaler never scales."},
      {c:"kubectl -n kube-system patch deployment metrics-server --type=json \\\n  -p='[{\"op\":\"add\",\"path\":\"/spec/template/spec/containers/0/args/-\",\"value\":\"--kubelet-insecure-tls\"}]'\nkubectl -n kube-system rollout status deploy/metrics-server\nkubectl top nodes",
       d:"Auf einem kubeadm-Cluster bleibt metrics-server sonst dauerhaft auf **0/1** stehen — Status Running, aber nie bereit. Grund: Er spricht die kubelets ueber HTTPS an und prueft deren Zertifikate, und kubeadm stattet die kubelets mit selbstsignierten Zertifikaten ohne passende SANs aus. Im Log steht dann *cannot validate certificate ... doesn't contain any IP SANs*. Der saubere Weg fuer Produktion ist serverTLSBootstrap im kubelet samt Freigabe der Zertifikatsanfragen; fuer Labor und Testcluster ist dieser Schalter der uebliche Weg.|On a kubeadm cluster metrics-server otherwise sits at **0/1** forever — status Running, but never ready. The reason: it talks to the kubelets over HTTPS and validates their certificates, and kubeadm equips the kubelets with self-signed certificates without matching SANs. The log then reads *cannot validate certificate ... doesn't contain any IP SANs*. The clean route for production is serverTLSBootstrap in the kubelet plus approving the certificate requests; for labs and test clusters this flag is the usual way."},
      {c:"ssh " + (o.endpoint || "HAUPTSERVER") + " 'sudo cat /etc/kubernetes/admin.conf' > ~/.kube/config\nchmod 600 ~/.kube/config\nkubectl get nodes",
       d:"Von der eigenen Arbeitsstation aus arbeiten, statt sich auf den Hauptserver zu setzen. Wichtig: In der Datei steht die API-Adresse als Name — der muss auch **auf deinem Rechner** aufloesen, notfalls ueber die lokale hosts-Datei. Hast du schon eine kubeconfig, nicht ueberschreiben, sondern zusammenfuehren: KUBECONFIG=~/.kube/config:neue.conf kubectl config view --flatten.|Work from your own machine instead of sitting on the control-plane node. Important: the file contains the API address as a name — that has to resolve **on your machine** too, via the local hosts file if need be. If you already have a kubeconfig, do not overwrite it but merge: KUBECONFIG=~/.kube/config:new.conf kubectl config view --flatten."},
      {c:"# StorageClass: auf eigener Hardware etwa Longhorn oder der local-path-provisioner",
       d:"Ohne StorageClass bleibt jedes PersistentVolumeClaim für immer Pending.|Without a storage class every PersistentVolumeClaim stays Pending forever."}
    ],
    r:[{lvl:"err", m:t("Die admin.conf ist ein Vollzugriff auf den gesamten Cluster, unbefristet und nicht widerrufbar ausser durch Austausch der CA. Auf einem Laptop ist sie fuer den Anfang bequem und auf Dauer die falsche Antwort — sobald mehr als eine Person damit arbeitet, gehoert jede an ihren eigenen Zugang mit eigenen Rechten, ueber RBAC begrenzt.|admin.conf is full access to the entire cluster, unlimited in time and revocable only by replacing the CA. On a laptop it is convenient to start with and the wrong answer in the long run — as soon as more than one person works with it, everyone belongs on their own credentials with their own rights, limited via RBAC.")},
       {lvl:"warn", m:t("Beim Upgrade immer nur eine Minor-Version auf einmal, und kubeadm zuerst. kubelet darf höchstens eine Minor-Version hinter dem API-Server liegen, niemals davor.|When upgrading, only one minor version at a time, and kubeadm first. The kubelet may trail the API server by at most one minor version, and must never lead it.")}]
  });

  if (o.add){
    sec("Den Knoten wieder entfernen|Removing the node again", "admin", {
      back:true,
      p:["Der Rückbau geht in der umgekehrten Richtung und in genau dieser Reihenfolge: erst die Pods herunterfahren, dann den Knoten aus dem Cluster nehmen, zuletzt die Maschine selbst zurücksetzen. Wer mit dem `reset` anfängt, hinterlässt einen Knoten-Eintrag, den danach niemand mehr sauber loswird.|The teardown goes the other direction and in exactly this order: drain the pods first, then take the node out of the cluster, and reset the machine itself last. Starting with the `reset` leaves a node entry behind that nobody gets rid of cleanly afterwards."],
      items:[
        {c:"kubectl drain KNOTEN --ignore-daemonsets --delete-emptydir-data",
         d:"Verschiebt alle Pods auf andere Knoten und lässt keine neuen mehr zu. --ignore-daemonsets ist nötig, weil DaemonSets sich nicht verschieben lassen — sie gehören zu jedem Knoten. --delete-emptydir-data heißt: Zwischendaten in emptyDir-Volumes gehen verloren, und das ist genau das, wofür emptyDir gedacht ist.|Moves all pods to other nodes and lets no new ones in. --ignore-daemonsets is needed because daemon sets cannot be moved — they belong to every node. --delete-emptydir-data means scratch data in emptyDir volumes is lost, which is exactly what emptyDir is for."},
        {c:"kubectl get pods -A -o wide --field-selector spec.nodeName=KNOTEN",
         d:"Die Gegenprobe vor dem nächsten Schritt. Was hier noch steht, sind DaemonSet-Pods — alles andere sollte weg sein.|The counter-check before the next step. What is left here are daemon-set pods — everything else should be gone."},
        {c:"kubectl delete node KNOTEN",
         d:"Nimmt den Knoten aus dem Cluster. Erst danach gibt der Cluster sein Pod-Teilnetz wieder frei.|Takes the node out of the cluster. Only after this does the cluster release its pod subnet again."},
        {c:"# auf dem entfernten Knoten selbst:\nsudo kubeadm reset -f\nsudo rm -rf /etc/cni/net.d /etc/kubernetes $HOME/.kube\nsudo iptables -F && sudo iptables -t nat -F && sudo iptables -X",
         d:"kubeadm reset räumt das CNI-Verzeichnis und die iptables-Regeln **nicht** auf. Bleiben sie stehen, verhält sich die Maschine bei einem späteren Beitritt unerklärlich — halb verbunden, mit Routen ins Nichts.|kubeadm reset does **not** clean up the CNI directory or the iptables rules. If they stay, the machine behaves inexplicably on a later join — half connected, with routes into nowhere."}
      ],
      r:[{lvl:"warn", m:t("Läuft auf dem Knoten ein Pod mit einem ReadWriteOnce-Volume, findet er anderswo kein neues — das Volume hängt an diesem Knoten. Vorher prüfen, welche PVCs betroffen sind.|If a pod with a ReadWriteOnce volume runs on the node, it finds no new home elsewhere — the volume is attached to that node. Check which PVCs are affected first.")}]
    });
  }

  if (!o.add) sec("Neu aufsetzen|Starting over", "all", {
    back:true,
    p:["Manches laesst sich nachtraeglich nicht mehr aendern: das Pod-Netz, der controlPlaneEndpoint, das Service-Netz. Bei einem Cluster, auf dem noch nichts Produktives liegt, ist der Neuanfang schneller und sicherer als jede Reparatur.|Some things cannot be changed afterwards: the pod network, the controlPlaneEndpoint, the service network. On a cluster with nothing productive on it, starting over is faster and safer than any repair.",
       "**Die Reihenfolge ist wichtig: von aussen nach innen.** Erst alle Worker, dann die weiteren Hauptserver, zuletzt der erste Hauptserver. Wer den ersten Hauptserver zuerst zuruecksetzt, nimmt allen anderen die API — deren reset laeuft dann zwar durch, kann sich aber nicht mehr sauber aus dem Cluster abmelden.|**The order matters: from the outside in.** First all workers, then the further control-plane nodes, and the first control-plane node last. Resetting the first control-plane node first takes the API away from everyone else — their reset still runs, but can no longer deregister cleanly."],
    items:[
      {c:"kubectl get nodes -o wide",
       d:"Bestandsaufnahme auf dem Hauptserver: Welche Knoten sind ueberhaupt beigetreten? Genau die muessen zurueckgesetzt werden, in der Reihenfolge oben.|Take stock on the control-plane node: which nodes have actually joined? Exactly those need resetting, in the order above."},
      {c:"# auf jedem Knoten, Worker zuerst, erster Hauptserver zuletzt\nsudo kubeadm reset -f\nsudo rm -rf /etc/cni/net.d /etc/kubernetes $HOME/.kube",
       d:"Derselbe Befehl auf jeder Maschine. Auf einem Hauptserver loescht er zusaetzlich das etcd-Verzeichnis — damit sind **alle** Objekte des Clusters weg, nicht nur die Konfiguration.|The same command on every machine. On a control-plane node it also deletes the etcd directory — which means **every** object in the cluster is gone, not just the configuration."},
      {c:"sudo ip link delete cni0 2>/dev/null\nsudo ip link delete flannel.1 2>/dev/null\nsudo ip link delete cilium_host 2>/dev/null\nsudo iptables -F && sudo iptables -t nat -F && sudo iptables -t mangle -F\nsudo systemctl restart containerd",
       d:"kubeadm reset raeumt die Netzwerkreste **nicht** mit weg: Bruecken, VXLAN-Geraete und iptables-Regeln des CNI bleiben liegen und stoeren den naechsten Aufbau. Wer sichergehen will, startet den Knoten stattdessen einfach neu — das erledigt dasselbe zuverlaessiger.|kubeadm reset does **not** clean up the network leftovers: the CNI's bridges, VXLAN devices and iptables rules stay behind and disturb the next setup. If you want to be sure, simply reboot the node instead — that does the same thing more reliably."},
      {c:"getent hosts " + (o.endpoint || "k8s-api.firma.de"),
       d:"Vor dem Neuaufbau auf **allen** Knoten pruefen: Loest die API-Adresse auf? Ein Eintrag in /etc/hosts ueberlebt den reset, ein fehlender faellt aber erst beim Beitritt auf.|Check on **every** node before rebuilding: does the API address resolve? An entry in /etc/hosts survives the reset, but a missing one only shows up when joining."}
    ],
    r:[{lvl:"err", m:t("Auf dem ersten Hauptserver loescht der reset etcd und damit den gesamten Clusterinhalt: alle Deployments, Secrets, ConfigMaps, PVC-Objekte. Was du behalten willst, vorher mit kubectl get -A -o yaml sichern.|On the first control-plane node the reset deletes etcd and with it the entire cluster content: all deployments, secrets, ConfigMaps, PVC objects. Back up whatever you want to keep with kubectl get -A -o yaml first.")},
       {lvl:"warn", m:t("Danach von vorn: erst der erste Hauptserver mit kubeadm init, dann das CNI genau einmal, dann die weiteren Hauptserver, zuletzt die Worker. Das CNI gehoert nur auf den ersten Hauptserver — es gilt clusterweit und wird nicht je Knoten angewendet.|Then start from the top: first the initial control-plane node with kubeadm init, then the CNI exactly once, then the further control-plane nodes, and the workers last. The CNI belongs on the first control-plane node only — it applies cluster-wide and is not applied per node.")}]
  });

  return out;
}

/* ---------- Benutzer und Namespace ----------
   Erzeugt aus einem Namen alles, was ein abgegrenzter Arbeitsbereich braucht:
   Namespace mit Sicherheitsstufe, Rolle, Quota, Netzregel, Identität, kubeconfig
   und den Linux-Benutzer auf dem Hauptserver. */
const TENANT_FIELDS = [
  {k:"user", t:"text", l:"Benutzername|User name", ph:"anna", half:true, structural:true,
   hint:"Wird zum Namen im Zertifikat, zum Linux-Konto und zur Vorgabe für den Namespace.|Becomes the name in the certificate, the Linux account and the default for the namespace."},
  {k:"ns", t:"text", l:"Namespace", ph:"team-anna", half:true,
   hint:"Leer lassen heißt team-BENUTZERNAME.|Leave empty for team-USERNAME."},
  {k:"level", t:"select", l:"Was der Benutzer darf|What the user may do", structural:true,
   opts:[["edit","Arbeiten — Pods, Deployments, Services anlegen und ändern|Work — create and change pods, deployments, services"],
         ["view","Nur zusehen — alles lesen, nichts ändern|Watch only — read everything, change nothing"],
         ["admin","Verwalten — zusätzlich Rechte im eigenen Namespace vergeben|Administer — additionally grant rights inside the own namespace"]]},
  {k:"identity", t:"select", l:"Womit er sich anmeldet|How the user signs in", structural:true,
   opts:[["cert","Client-Zertifikat — ein echter Benutzer im Cluster|Client certificate — a real user in the cluster"],
         ["oidc","Benutzername und Kennwort — über einen Anmeldedienst|User name and password — through a sign-in service"],
         ["sa","ServiceAccount-Token — jederzeit widerrufbar|ServiceAccount token — revocable at any time"]],
   hint:"Kubernetes selbst kennt keine Kennwörter — die Prüfung übernimmt ein Dienst davor. Der Assistent nimmt dafür Dex mit hinterlegten Benutzern.|Kubernetes itself knows no passwords — a service in front does the checking. The wizard uses Dex with stored users for that."},
  {k:"email", t:"text", l:"Anmeldename|Sign-in name", ph:"bge@firma.de", half:true,
   when:o => o.identity === "oidc",
   hint:"Womit sich der Benutzer anmeldet. Genau dieser Wert landet als Name im RoleBinding.|What the user signs in with. Exactly this value ends up as the name in the role binding."},
  {k:"issuer", t:"text", l:"Adresse des Anmeldedienstes|Address of the sign-in service", ph:"https://dex.firma.de:32000", half:true,
   when:o => o.identity === "oidc",
   hint:"Muss **vom API-Server aus** erreichbar sein und HTTPS sprechen. Das ist die Stelle, an der es am häufigsten klemmt.|Has to be reachable **from the API server** and speak HTTPS. That is where it goes wrong most often."},
  {k:"api", t:"text", l:"API-Adresse|API address", ph:"k8s-api.firma.de:6443",
   hint:"Dieselbe Adresse, die auch in deiner eigenen kubeconfig unter server steht.|The same address your own kubeconfig has under server."},
  {k:"days", t:"number", half:true, l:"Zertifikat gültig (Tage)|Certificate valid for (days)", ph:"365",
   when:o => (o.identity || "cert") === "cert"},
  {k:"pss", t:"select", l:"Pod Security Standard", half:true, structural:true,
   opts:[["restricted","restricted — kein root, keine Rechteerweiterung|restricted — no root, no privilege escalation"],
         ["baseline","baseline — verbietet das offensichtlich Gefährliche|baseline — forbids the obviously dangerous"],
         ["privileged","privileged — keine Einschränkung|privileged — no restriction"]]},
  {k:"linux", t:"bool", structural:true, l:"Linux-Benutzer auf dem Hauptserver anlegen|Create a Linux user on the control plane",
   hint:"Für Zugriff per SSH oder VS Code Remote, mit eigener kubeconfig im Heimatverzeichnis.|For access over SSH or VS Code Remote, with its own kubeconfig in the home directory."},
  {k:"quota", t:"bool", structural:true, l:"Verbrauch begrenzen (ResourceQuota)|Cap consumption (ResourceQuota)"},
  {k:"cpu", t:"text", l:"CPU insgesamt|CPU in total", ph:"4", half:true, when:o => !!o.quota},
  {k:"mem", t:"text", l:"Speicher insgesamt|Memory in total", ph:"8Gi", half:true, when:o => !!o.quota},
  {k:"pods", t:"number", l:"Pods höchstens|Pods at most", ph:"20", half:true, when:o => !!o.quota},
  {k:"netpol", t:"bool", l:"Namespace nach außen abschotten (NetworkPolicy)|Seal the namespace off (NetworkPolicy)"},
  {k:"batch", t:"bool", structural:true, l:"Mehrere Benutzer auf einmal|Several users at once",
   hint:"Ändert nur den Ansible-Export: statt fester Werte laufen die Playbooks über eine Liste in group_vars. Die Anleitung daneben bleibt der Weg für einen einzelnen.|Changes the Ansible export only: instead of fixed values the playbooks loop over a list in group_vars. The guide beside it stays the route for a single one."},
  {k:"pin", t:"bool", structural:true, l:"Nur auf bestimmten Nodes laufen lassen|Run only on certain nodes",
   hint:"Alle Pods dieses Namespace landen dann ausschließlich auf Nodes mit dem Label unten.|Every pod of this namespace then lands only on nodes carrying the label below."},
  {k:"pool", t:"text", l:"Node-Label|Node label", ph:"pool=team-admin", half:true, when:o => !!o.pin,
   hint:"Schlüssel und Wert, mit denen die Nodes markiert werden. Frei wählbar.|Key and value the nodes are marked with. Free to choose."},
  {k:"taint", t:"bool", l:"Diese Nodes für andere Namespaces sperren|Bar these nodes from other namespaces",
   when:o => !!o.pin,
   hint:"Ohne das dürfen andere weiterhin dort laufen — die Bindung gilt dann nur in eine Richtung.|Without this, others may still run there — the binding then holds in one direction only."}
];

/* Aus k8s-cp1.firma.de:6443 wird firma.de — als Vorgabe fuer Anmeldename und Dienst. */
function domainOf(api){
  const host = String(api || "").split(":")[0];
  const teile = host.split(".").filter(Boolean);
  return teile.length >= 3 ? teile.slice(1).join(".") : (teile.join(".") || "firma.de");
}

function tenantOpts(o){
  const user = (o.user || "").trim() || "anna";
  const api = (o.api || "").trim() || "API-ADRESSE:6443";
  const dom = domainOf(api);
  /* Gebunden wird der Namespace, nicht die Person — also haengt die Vorgabe an ihm. */
  const ns = (o.ns || "").trim() || ("team-" + user);
  return {
    user: user,
    email: (o.email || "").trim() || (user + "@" + dom),
    issuer: (o.issuer || "").trim().replace(/\/+$/, "") || ("https://dex." + dom + ":32000"),
    ns: ns,
    level: o.level || "edit",
    identity: o.identity || "cert",
    api: (o.api || "").trim() || "API-ADRESSE:6443",
    days: num(o.days) === undefined ? 365 : num(o.days),
    pss: o.pss || "restricted",
    linux: !!o.linux,
    quota: !!o.quota,
    cpu: (o.cpu || "").trim() || "4",
    mem: (o.mem || "").trim() || "8Gi",
    pods: num(o.pods) === undefined ? 20 : num(o.pods),
    netpol: !!o.netpol,
    batch: !!o.batch,
    pin: !!o.pin,
    /* pool=wert wird an zwei Stellen gebraucht: als Label und als Taint. */
    pool: ((o.pool || "").trim() || "pool=" + ns).replace(/\s+/g, ""),
    taint: !!o.taint
  };
}

/* Der eingebaute ClusterRole-Name je Stufe. Es sind Vorgaben von Kubernetes,
   keine selbst gebauten Rollen — deshalb überleben sie jedes Upgrade. */
const TENANT_ROLE = {edit:"edit", view:"view", admin:"admin"};

/* Kubernetes prueft Mengenangaben gegen genau diesen Ausdruck. Wer hier
   4 Kerne, 8 GB oder 2,5 eintraegt, bekommt vom API-Server nur die Regel
   zurueck und nicht das Feld, an dem es liegt — also pruefen wir vorher. */
const MENGE = /^([+-]?[0-9.]+)([eEinumkKMGTP]*[-+]?[0-9]*)$/;

function mengenRisiken(o){
  const out = [];
  [["CPU", o.cpu], ["Speicher|Memory", o.mem]].forEach(f => {
    if (MENGE.test(String(f[1]))) return;
    out.push({lvl:"err", m:t("Die Angabe für " + t(f[0]) + " ist keine gültige Mengenangabe: \"" + f[1] +
      "\". Der API-Server lehnt das Manifest mit quantities must match the regular expression ab und nennt dabei nicht, welches Feld gemeint war. Erlaubt sind eine Zahl und ein Suffix ohne Leerzeichen — 4, 500m, 2.5, 8Gi, 512Mi. Nicht erlaubt sind Komma statt Punkt, GB oder Gb statt Gi oder G, und jedes Leerzeichen.|The value for " + t(f[0]) + " is not a valid quantity: \"" + f[1] +
      "\". The API server rejects the manifest with quantities must match the regular expression and does not say which field it meant. Allowed is a number and a suffix without a space — 4, 500m, 2.5, 8Gi, 512Mi. Not allowed are a comma instead of a dot, GB or Gb instead of Gi or G, and any space.")});
  });
  if (MENGE.test(String(o.mem)) && /^[0-9.]+$/.test(String(o.mem)))
    out.push({lvl:"err", m:t("Der Speicherwert \"" + o.mem + "\" hat keine Einheit und bedeutet damit " + o.mem +
      " **Byte**. Der Namespace kann danach keinen einzigen Pod starten. Gemeint ist vermutlich " + o.mem + "Gi.|The memory value \"" + o.mem + "\" has no unit and therefore means " + o.mem +
      " **bytes**. The namespace cannot start a single pod afterwards. What is meant is probably " + o.mem + "Gi.")});
  return out;
}

function tenantGuide(raw){
  const o = tenantOpts(raw);
  const out = [];
  const sec = (h, role, x) => { out.push(Object.assign({h:h, role:role, items:[], p:[], r:[]}, x)); };
  const cert = o.identity === "cert";
  const oidc = o.identity === "oidc";
  /* Der Name im RoleBinding haengt daran, woher der API-Server ihn liest:
     aus dem Zertifikat, aus dem Token des Anmeldedienstes oder vom ServiceAccount. */
  const asUser = cert ? o.user
               : oidc ? "oidc:" + o.email
               : "system:serviceaccount:" + o.ns + ":" + o.user;
  const subject = o.identity === "sa"
    ? "  - kind: ServiceAccount\n    name: " + o.user + "\n    namespace: " + o.ns
    : "  - kind: User\n    name: " + asUser + "\n    apiGroup: rbac.authorization.k8s.io";

  /* --- 1. Namespace --- */
  sec("Der Namespace mit Sicherheitsstufe|The namespace with its security level", "admin", {
    p:["Ein Namespace ist zuerst nur ein Namensraum. Er trennt Objekte und Namen — sonst nichts. Weder Rechte noch Verbrauch noch Netzverkehr sind damit getrennt; das kommt in den nächsten drei Schritten dazu.|A namespace is first of all just a name space. It separates objects and names — nothing else. Neither rights nor consumption nor network traffic are separated by it; that comes in the next three steps.",
       "Die drei Labels schalten den Pod Security Standard ein. `enforce` lehnt einen Pod ab, der dagegen verstößt, `warn` gibt beim Anlegen eine Meldung zurück, `audit` schreibt nur ins Prüfprotokoll. Alle drei auf dieselbe Stufe zu setzen ist die ehrliche Variante — sonst wundert man sich später, warum nichts blockiert wurde.|The three labels switch on the Pod Security Standard. `enforce` rejects a pod that violates it, `warn` returns a message on creation, `audit` only writes to the audit log. Setting all three to the same level is the honest variant — otherwise you wonder later why nothing was blocked."],
    items:[
      {c:"cat <<'EOF' | kubectl apply -f -\napiVersion: v1\nkind: Namespace\nmetadata:\n  name: " + o.ns + "\n  labels:\n    kubernetes.io/metadata.name: " + o.ns + "\n    pod-security.kubernetes.io/enforce: " + o.pss + "\n    pod-security.kubernetes.io/warn: " + o.pss + "\n    pod-security.kubernetes.io/audit: " + o.pss + "\nEOF",
       d:"Legt den Namespace an und schaltet die Prüfung sofort scharf. Die Labels lassen sich später ändern — bereits laufende Pods werden dabei nicht rückwirkend geprüft.|Creates the namespace and arms the check right away. The labels can be changed later — pods already running are not re-checked retroactively."}
    ],
    r:o.pss === "privileged"
      ? [{lvl:"err", m:t("Mit privileged darf ein Pod als root laufen, das Host-Dateisystem einhängen und den Kernel ansprechen. Wer darin Pods anlegen darf, ist faktisch root auf dem Node — die Rolle darunter ist dann Zierde.|With privileged a pod may run as root, mount the host filesystem and talk to the kernel. Whoever may create pods there is effectively root on the node — the role below is then decoration.")}]
      : o.pss === "baseline"
        ? [{lvl:"warn", m:t("baseline verbietet das offensichtlich Gefährliche, erlaubt aber weiterhin root im Container. Für fremden oder zugelieferten Code ist restricted die richtige Stufe.|baseline forbids the obviously dangerous but still allows root inside the container. For foreign or vendored code, restricted is the right level.")}]
        : []
  });

  /* --- 2. Quota --- */
  if (o.quota){
    sec("Grenzen setzen|Setting limits", "admin", {
      p:["Ohne Quota kann ein einzelner Namespace den gesamten Cluster leerräumen — nicht aus Bosheit, sondern durch ein Deployment mit zu vielen Replicas.|Without a quota a single namespace can drain the whole cluster — not out of malice but through a deployment with too many replicas.",
         "Die ResourceQuota hat eine Falle, die fast jeden einmal trifft: Sobald sie CPU oder Speicher begrenzt, wird **jeder** Pod ohne requests und limits abgelehnt. Deshalb gehört die LimitRange direkt daneben — sie setzt die fehlenden Werte selbst ein.|The ResourceQuota has a trap that catches almost everyone once: as soon as it limits CPU or memory, **every** pod without requests and limits is rejected. That is why the LimitRange belongs right next to it — it fills in the missing values itself."],
      items:[
        {c:"cat <<'EOF' | kubectl apply -f -\napiVersion: v1\nkind: ResourceQuota\nmetadata:\n  name: quota\n  namespace: " + o.ns + "\nspec:\n  hard:\n    requests.cpu: \"" + o.cpu + "\"\n    requests.memory: " + o.mem + "\n    limits.cpu: \"" + o.cpu + "\"\n    limits.memory: " + o.mem + "\n    pods: \"" + o.pods + "\"\n    persistentvolumeclaims: \"10\"\n    services.loadbalancers: \"1\"\n---\napiVersion: v1\nkind: LimitRange\nmetadata:\n  name: vorgaben\n  namespace: " + o.ns + "\nspec:\n  limits:\n    - type: Container\n      default:\n        cpu: 200m\n        memory: 256Mi\n      defaultRequest:\n        cpu: 50m\n        memory: 64Mi\n      max:\n        cpu: \"2\"\n        memory: 2Gi\nEOF",
         d:"default gilt für limits, defaultRequest für requests. max ist die Obergrenze je Container — damit belegt kein einzelner Pod die ganze Quota.|default applies to limits, defaultRequest to requests. max is the ceiling per container — so no single pod occupies the entire quota."},
        {c:"kubectl describe resourcequota quota -n " + o.ns,
         d:"Zeigt Verbrauch gegen Grenze. Diese Ausgabe ist die erste Anlaufstelle, wenn ein Pod plötzlich nicht mehr startet.|Shows usage against the limit. This output is the first place to look when a pod suddenly stops starting."}
      ],
      r:mengenRisiken(o).concat([{lvl:"warn", m:t("Die Quota zählt requests, nicht den tatsächlichen Verbrauch. Ein Namespace mit großzügigen requests blockiert Platz, den er nie benutzt — und einer mit zu kleinen bekommt Pods, die unter Last gedrosselt werden.|The quota counts requests, not actual consumption. A namespace with generous requests blocks room it never uses — and one with requests too small gets pods that are throttled under load.")}])
    });
  }

  /* --- 3. Rolle --- */
  sec("Die Rolle: was er darf und wo|The role: what and where", "admin", {
    p:["Kubernetes bringt die Rollen fertig mit. Du baust keine eigene — du bindest eine vorhandene **in einem Namespace**. Genau darin liegt der Trick: Eine ClusterRole ist nur eine Sammlung von Regeln. Ob sie clusterweit oder in einem einzigen Namespace gilt, entscheidet die Bindung.|Kubernetes ships the roles ready-made. You do not build your own — you bind an existing one **inside a namespace**. That is exactly the trick: a ClusterRole is merely a set of rules. Whether it applies cluster-wide or in a single namespace is decided by the binding.",
       "Ein RoleBinding auf eine ClusterRole bedeutet: diese Regeln, aber nur hier. Ein ClusterRoleBinding auf dieselbe ClusterRole bedeutet: überall. Der Unterschied ist ein Wort und der ganze Sicherheitsgewinn.|A RoleBinding onto a ClusterRole means: these rules, but only here. A ClusterRoleBinding onto the same ClusterRole means: everywhere. The difference is one word and the entire security benefit."],
    table:[["Stufe|Level","Darf|May","Darf nicht|May not"],
      ["view","Alles lesen außer Secrets|Read everything except secrets","Nichts ändern|Change nothing"],
      ["edit","Pods, Deployments, Services, ConfigMaps und Secrets anlegen und ändern|Create and change pods, deployments, services, config maps and secrets","Rollen vergeben, den Namespace löschen|Grant roles, delete the namespace"],
      ["admin","Zusätzlich Rollen und Bindungen im eigenen Namespace vergeben|Additionally grant roles and bindings inside the own namespace","Mehr Rechte vergeben, als er selbst hat|Grant more rights than they hold themselves"]],
    items:[
      {c:"cat <<'EOF' | kubectl apply -f -\napiVersion: rbac.authorization.k8s.io/v1\nkind: RoleBinding\nmetadata:\n  name: " + o.user + "-" + TENANT_ROLE[o.level] + "\n  namespace: " + o.ns + "\nroleRef:\n  kind: ClusterRole\n  name: " + TENANT_ROLE[o.level] + "\n  apiGroup: rbac.authorization.k8s.io\nsubjects:\n" + subject + "\nEOF",
       d:"kind ist RoleBinding, roleRef.kind ist ClusterRole — diese Mischung ist beabsichtigt und der übliche Weg. Der Namespace in metadata bestimmt, wo die Regeln greifen.|kind is RoleBinding, roleRef.kind is ClusterRole — that mixture is deliberate and the usual way. The namespace in metadata decides where the rules apply."},
      {c:"kubectl get rolebindings -n " + o.ns + " -o wide",
       d:"Zeigt, wer in diesem Namespace welche Rolle hat. Sollte kurz und überschaubar bleiben.|Shows who holds which role in this namespace. Should stay short and surveyable."}
    ],
    r:[{lvl:"warn", m:t("edit und admin dürfen die Secrets im eigenen Namespace lesen — auch die, die du dort später anlegst. Ein Namespace ist genau so vertraulich wie sein am wenigsten vertrauenswürdiger Benutzer.|edit and admin may read the secrets in their own namespace — including the ones you create there later. A namespace is exactly as confidential as its least trustworthy user.")}]
      .concat(o.level === "admin" ? [{lvl:"warn", m:t("admin darf im eigenen Namespace weitere Bindungen anlegen. Mehr als die eigenen Rechte kann er dabei nicht vergeben — der API-Server verhindert das. Ein zweiter Benutzer im selben Namespace kann so aber ohne dein Zutun entstehen.|admin may create further bindings inside their own namespace. They cannot grant more than they hold — the API server prevents that. But a second user in the same namespace can appear without your involvement.")}] : [])
  });

  /* --- 3b. Anmeldedienst, nur beim Kennwort-Weg --- */
  if (oidc){
    const dexHost = o.issuer.replace(/^https?:\/\//, "").split(":")[0];
    sec("Der Anmeldedienst: Dex|The sign-in service: Dex", "admin", {
      p:["Kubernetes selbst hat keine Kennwörter. Die Anmeldung mit Benutzername und Kennwort wurde 2019 aus dem API-Server entfernt — was es dort noch gibt, sind Zertifikate, Token und **OIDC**. Ein Kennwort prüft also ein Dienst davor, und der API-Server glaubt anschließend dem Token, das dieser Dienst ausstellt.|Kubernetes itself has no passwords. Signing in with a user name and password was removed from the API server in 2019 — what remains there are certificates, tokens and **OIDC**. So a service in front checks the password, and the API server then trusts the token that service issues.",
         "**Dex** ist die kleinste Ausführung davon: ein Dienst, der Benutzer entweder aus LDAP, GitHub oder Entra ID holt — oder schlicht aus einer Liste in seiner eigenen Konfiguration. Genau diese Liste nehmen wir hier.|**Dex** is the smallest version of that: a service that gets users from LDAP, GitHub or Entra ID — or simply from a list in its own configuration. That list is exactly what we use here."],
      items:[
        {c:"htpasswd -bnBC 10 \"\" 'HIER-DAS-KENNWORT' | tr -d ':\\n'",
         d:"Erzeugt den bcrypt-Wert für das Kennwort. Nur dieser Wert kommt in die Konfiguration, das Kennwort selbst nirgendwo hin. Fehlt htpasswd, liefert es das Paket apache2-utils beziehungsweise httpd-tools.|Produces the bcrypt value for the password. Only that value goes into the configuration, the password itself goes nowhere. If htpasswd is missing, the package apache2-utils or httpd-tools provides it."},
        {c:"cat <<'EOF' | kubectl apply -f -\napiVersion: v1\nkind: Namespace\nmetadata:\n  name: dex\n---\napiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: dex\n  namespace: dex\ndata:\n  config.yaml: |\n    issuer: " + o.issuer + "\n    storage:\n      type: kubernetes\n      config:\n        inCluster: true\n    web:\n      https: 0.0.0.0:5556\n      tlsCert: /etc/dex/tls/tls.crt\n      tlsKey: /etc/dex/tls/tls.key\n    oauth2:\n      skipApprovalScreen: true\n      passwordConnector: local\n    staticClients:\n      - id: kubernetes\n        name: Kubernetes\n        secret: KLIENT-GEHEIMNIS-HIER\n        redirectURIs:\n          - http://localhost:8000\n          - http://127.0.0.1:5555/callback\n    enablePasswordDB: true\n    staticPasswords:\n      - email: \"" + o.email + "\"\n        username: \"" + o.user + "\"\n        userID: \"" + o.user + "\"\n        hash: \"$2y$10$HIER-DER-BCRYPT-WERT\"\nEOF",
         d:"Die Benutzerliste steht in staticPasswords. passwordConnector: local ist der Schalter, der die Anmeldung ohne Browser erlaubt — kubectl fragt dann Name und Kennwort direkt auf der Kommandozeile ab.|The user list sits in staticPasswords. passwordConnector: local is the switch that allows signing in without a browser — kubectl then asks for name and password right on the command line."},
        {c:"# Dex selbst, mit Zertifikat für " + dexHost + ":\nhelm repo add dex https://charts.dexidp.io\nhelm install dex dex/dex -n dex --values dex-werte.yaml\n\nkubectl -n dex get pods\ncurl -k " + o.issuer + "/.well-known/openid-configuration",
         d:"Der letzte Befehl ist die Probe: Kommt hier JSON zurück, ist der Dienst erreichbar. Genau diese Adresse muss gleich auch der API-Server erreichen können — von seinem Netz aus, nicht von deinem.|The last command is the test: if JSON comes back, the service is reachable. That same address has to be reachable by the API server in a moment — from its network, not from yours."}
      ],
      r:[{lvl:"err", m:t("Der Anmeldedienst braucht ein TLS-Zertifikat, dem der API-Server traut. Ein selbstsigniertes geht, dann muss dessen CA im nächsten Schritt als --oidc-ca-file mitgegeben werden. Ohne das lehnt der API-Server jedes Token ab, und die Meldung nennt nur oidc: authentication failed.|The sign-in service needs a TLS certificate the API server trusts. A self-signed one works, but then its CA has to be passed as --oidc-ca-file in the next step. Without that the API server rejects every token, and the message only says oidc: authentication failed.")},
         {lvl:"warn", m:t("Die Adresse in issuer muss buchstabengleich mit der übereinstimmen, die später in der kubeconfig steht — samt Port und ohne abschließenden Schrägstrich. Eine Abweichung darin ist der häufigste Grund, warum die Anmeldung ohne erkennbaren Fehler scheitert.|The address in issuer has to match the one that later appears in the kubeconfig character for character — port included, no trailing slash. A mismatch there is the most common reason a sign-in fails without a visible error.")}]
    });

    sec("Den API-Server auf OIDC umstellen|Switching the API server to OIDC", "cp", {
      p:["Dieser Schritt ist der einzige in der ganzen Anleitung, der den laufenden Cluster anfasst. Der API-Server ist ein statischer Pod: Sobald du seine Manifest-Datei speicherst, startet der kubelet ihn neu. Ein Tippfehler nimmt dir die API — deshalb vorher eine Kopie.|This step is the only one in the whole guide that touches the running cluster. The API server is a static pod: the moment you save its manifest file, the kubelet restarts it. A typo takes the API away from you — so make a copy first.",
         "Die Beruhigung dabei: Deine eigene admin.conf arbeitet mit einem Client-Zertifikat, nicht mit OIDC. Selbst wenn die Umstellung misslingt, kommst du weiterhin an den Cluster und kannst zurückdrehen.|The reassuring part: your own admin.conf works with a client certificate, not with OIDC. Even if the change fails you still reach the cluster and can roll it back."],
      items:[
        {c:"sudo cp /etc/kubernetes/manifests/kube-apiserver.yaml ~/kube-apiserver.yaml.sicherung",
         d:"Zuerst die Kopie. Geht etwas schief, spielst du sie zurück und der kubelet startet den API-Server erneut.|The copy first. If something goes wrong you put it back and the kubelet restarts the API server."},
        {c:"# in /etc/kubernetes/manifests/kube-apiserver.yaml unter command: ergänzen\n    - --oidc-issuer-url=" + o.issuer + "\n    - --oidc-client-id=kubernetes\n    - --oidc-username-claim=email\n    - --oidc-username-prefix=oidc:\n    - --oidc-groups-claim=groups\n    - --oidc-groups-prefix=oidc:\n    - --oidc-ca-file=/etc/kubernetes/pki/dex-ca.crt",
         d:"Das Präfix oidc: ist kein Schmuck: Ohne es könnte ein Anmeldedienst Namen ausstellen, die mit denen aus Zertifikaten oder mit system: kollidieren. Mit Präfix bleiben die Welten getrennt — und genau deshalb heißt der Benutzer im RoleBinding weiter oben oidc:" + o.email + " und nicht nur " + o.email + ".|The oidc: prefix is not decoration: without it a sign-in service could issue names that collide with those from certificates or with system:. With the prefix the worlds stay apart — which is exactly why the user in the role binding above is oidc:" + o.email + " and not just " + o.email + "."},
        {c:"sudo cp dex-ca.crt /etc/kubernetes/pki/dex-ca.crt\nsudo crictl ps | grep kube-apiserver\nkubectl get --raw /healthz",
         d:"Die CA muss im selben Verzeichnis liegen, das der API-Server ohnehin einhängt — sonst findet er die Datei im Container nicht. healthz muss ok melden; kommt keine Antwort, ist der Pod nicht hochgekommen.|The CA has to sit in the directory the API server mounts anyway — otherwise it cannot find the file inside the container. healthz has to report ok; if nothing answers, the pod did not come up."},
        {c:"sudo journalctl -u kubelet -n 50 --no-pager | grep -i apiserver\nsudo crictl logs $(sudo crictl ps -a --name kube-apiserver -q | head -1) 2>&1 | tail -30",
         d:"Nur nötig, wenn healthz stumm bleibt. Meist ist es ein Einrückungsfehler im YAML oder ein Pfad, den es im Container nicht gibt.|Only needed if healthz stays silent. Usually it is an indentation error in the YAML or a path that does not exist inside the container."}
      ],
      r:[{lvl:"err", m:t("Bei mehreren Hauptservern muss diese Änderung auf jedem einzeln gemacht werden. Solange sie nur auf einem steht, funktioniert die Anmeldung mal und mal nicht — je nachdem, welchen API-Server der Lastverteiler gerade erwischt. Das ist ein Fehlerbild, das lange in die Irre führt.|With several control-plane nodes this change has to be made on each one separately. As long as it is only on one, sign-in works sometimes and sometimes not — depending on which API server the load balancer happens to hit. That is a symptom that misleads for a long time.")}]
    });
  }

  /* --- 4. Identität --- */
  if (cert){
    sec("Die Identität: ein Client-Zertifikat|The identity: a client certificate", "admin", {
      p:["Kubernetes führt keine Benutzerliste. Es gibt keine Tabelle mit Konten, kein `kubectl create user`. Ein Benutzer ist schlicht ein Name, den der API-Server aus einem gültigen Zertifikat abliest: **CN wird zum Benutzernamen, O zur Gruppe**.|Kubernetes keeps no list of users. There is no table of accounts, no `kubectl create user`. A user is simply a name the API server reads out of a valid certificate: **CN becomes the user name, O becomes the group**.",
         "Der private Schlüssel entsteht dabei auf deinem Rechner und verlässt ihn nie — unterschrieben wird nur die Anfrage. Das ist der Grund, warum dieser Weg trotz der drei Schritte der saubere ist.|The private key is created on your machine and never leaves it — only the request gets signed. That is why this route is the clean one despite its three steps."],
      items:[
        {c:"openssl genrsa -out " + o.user + ".key 4096\nopenssl req -new -key " + o.user + ".key -out " + o.user + ".csr \\\n  -subj \"/CN=" + o.user + "/O=" + o.ns + "\"",
         d:"CN ist der Benutzername, mit dem der API-Server ihn später kennt. O ist die Gruppe — praktisch, wenn später mehrere Personen dieselben Rechte bekommen sollen.|CN is the user name the API server will know them by. O is the group — handy when several people are to get the same rights later."},
        {c:"CSR=$(base64 -w0 " + o.user + ".csr)          # macOS: base64 -i " + o.user + ".csr | tr -d '\\n'\ncase \"$CSR\" in LS0tLS1CRUdJTi*) echo ok ;; *) echo \"FEHLER: keine gueltige CSR\"; false ;; esac",
         d:"Erst den Wert erzeugen und ansehen. Eine base64-kodierte CSR beginnt **immer** mit `LS0tLS1CRUdJTi` — das ist `-----BEGIN` in base64. Steht dort etwas anderes, hat der nächste Schritt keine Aussicht auf Erfolg.|Create the value first and look at it. A base64-encoded CSR **always** starts with `LS0tLS1CRUdJTi` — that is `-----BEGIN` in base64. If something else is there, the next step has no chance of succeeding."},
        {c:"cat <<EOF | kubectl apply -f -\napiVersion: certificates.k8s.io/v1\nkind: CertificateSigningRequest\nmetadata:\n  name: " + o.user + "\nspec:\n  request: ${CSR}\n  signerName: kubernetes.io/kube-apiserver-client\n  expirationSeconds: " + (o.days * 86400) + "\n  usages:\n    - client auth\nEOF\n\nkubectl certificate approve " + o.user,
         d:"Der Cluster unterschreibt selbst, mit seiner eigenen CA. Das `EOF` steht hier **ohne** Anführungszeichen, damit die Shell `${CSR}` einsetzt — bei den reinen YAML-Blöcken in dieser Anleitung ist es umgekehrt Absicht, dass sie in Anführungszeichen stehen.|The cluster signs it itself, with its own CA. The `EOF` here has **no** quotes so the shell substitutes `${CSR}` — with the plain YAML blocks in this guide it is deliberately the other way round."},
        {c:"kubectl get csr " + o.user + " -o jsonpath='{.spec.request}' | base64 -d | openssl req -noout -subject\nkubectl get csr " + o.user + " -o jsonpath='{.status.certificate}' | base64 -d > " + o.user + ".crt\nopenssl x509 -in " + o.user + ".crt -noout -subject -dates",
         d:"Holt das unterschriebene Zertifikat heraus und zeigt zur Kontrolle Name und Laufzeit an.|Fetches the signed certificate and prints name and validity for checking."}
      ],
      r:[{lvl:"err", m:t("Dieser Abschnitt gehoert in eine Shell, nicht in eine Datei. Wer den Block als bge.yaml speichert und mit kubectl apply -f anwendet, bekommt illegal base64 data at input byte 0 — dann steht im Feld request woertlich $(base64 ...) statt des Wertes. Byte 0 ist das Dollarzeichen.|This section belongs in a shell, not in a file. Anyone who saves the block as bge.yaml and applies it with kubectl apply -f gets illegal base64 data at input byte 0 — the request field then literally contains $(base64 ...) instead of the value. Byte 0 is the dollar sign.")},
         {lvl:"warn", m:t("Bei verwalteten Clustern — EKS, GKE, AKS — ist dieser Weg meist gesperrt: Die Steuerungsebene unterschreibt keine fremden Client-Anfragen, weil die Anmeldung über den Anbieter läuft. Dort führt der Weg über dessen Rechteverwaltung, oder über einen ServiceAccount.|With managed clusters — EKS, GKE, AKS — this route is usually closed: the control plane signs no external client requests because sign-in goes through the provider. There the way leads through the provider's own access management, or through a service account.")},
         {lvl:"err", m:t("Ein ausgestelltes Client-Zertifikat lässt sich nicht zurückziehen. Kubernetes führt keine Sperrliste. Bis zum Ablauf hilft nur, die RoleBindings zu entfernen: Der Benutzer kommt weiterhin an die API, darf dann aber nichts mehr. Deshalb eine kurze Laufzeit wählen.|An issued client certificate cannot be revoked. Kubernetes keeps no revocation list. Until it expires the only remedy is removing the role bindings: the user still reaches the API but may do nothing. So pick a short lifetime.")}]
    });
  } else if (oidc){
    sec("Die Identität: der Eintrag im Anmeldedienst|The identity: the entry in the sign-in service", "admin", {
      p:["Anders als beim Zertifikat gibt es hier nichts mehr auszustellen — der Benutzer steht bereits in der Liste von Dex. Was jetzt folgt, ist die Probe, dass Kennwort, Anmeldename und RoleBinding zusammenpassen.|Unlike with the certificate there is nothing left to issue — the user is already in Dex's list. What follows is the check that password, sign-in name and role binding fit together.",
         "Der entscheidende Wert ist der **email**-Anspruch im Token. Genau er wird zum Benutzernamen im Cluster, mit dem Präfix davor. Weicht er ab, meldet sich der Benutzer erfolgreich an und darf trotzdem nichts.|The decisive value is the **email** claim in the token. That is what becomes the user name in the cluster, with the prefix in front. If it differs, the user signs in successfully and still may do nothing."],
      items:[
        {c:"curl -k -s " + o.issuer + "/token \\\n  -d grant_type=password -d client_id=kubernetes \\\n  -d client_secret=KLIENT-GEHEIMNIS-HIER \\\n  -d scope='openid profile email groups' \\\n  -d username='" + o.email + "' -d password='HIER-DAS-KENNWORT'",
         d:"Holt ein Token, so wie es kubectl gleich auch tun wird. Kommt hier ein id_token zurück, stimmen Kennwort und Klient-Geheimnis. Kommt invalid_grant, stimmt eines von beiden nicht.|Fetches a token the way kubectl will in a moment. If an id_token comes back, password and client secret are right. If invalid_grant comes back, one of the two is wrong."},
        {c:"# das id_token aus der Antwort hier einsetzen:\necho 'TOKEN' | cut -d. -f2 | base64 -d 2>/dev/null | python3 -m json.tool",
         d:"Zeigt den Inhalt des Tokens im Klartext — ein JWT ist nicht verschlüsselt, nur unterschrieben. Der Wert bei email muss genau **" + o.email + "** lauten, sonst passt der Name im RoleBinding nicht.|Shows the token's contents in plain text — a JWT is not encrypted, only signed. The email value has to read exactly **" + o.email + "**, otherwise the name in the role binding does not match."},
        {c:"kubectl get configmap dex -n dex -o jsonpath='{.data.config\\.yaml}' | grep -A4 staticPasswords",
         d:"Wer im Anmeldedienst eingetragen ist. Diese Liste ist die Benutzerverwaltung — es gibt keine zweite.|Who is entered in the sign-in service. That list is the user management — there is no second one."}
      ],
      r:[{lvl:"warn", m:t("Ein Kennwort ist so gut wie der Ort, an dem es aufbewahrt wird, und es hat keine zweite Stufe. Für eine Handvoll Personen im Heimlabor ist die Liste in Dex in Ordnung. Sobald es mehr werden, gehört ein richtiges Verzeichnis dahinter — LDAP, Entra ID oder Google —, damit Sperren, Ablauf und Zwei-Faktor dort geregelt sind und nicht in einer ConfigMap.|A password is only as good as the place it is kept, and it has no second factor. For a handful of people in a home lab, Dex's list is fine. Once there are more, a proper directory belongs behind it — LDAP, Entra ID or Google — so that blocking, expiry and two-factor are handled there and not in a config map.")},
         {lvl:"warn", m:t("Das Token ist kurzlebig, meist einen Tag. Das ist der Vorteil gegenüber dem Zertifikat: Nimmst du den Benutzer aus der Liste, ist er nach Ablauf des laufenden Tokens draußen — ohne dass irgendwo eine Sperrliste geführt werden müsste.|The token is short-lived, usually a day. That is the advantage over the certificate: take the user out of the list and they are out once the current token expires — with no revocation list to maintain anywhere.")}]
    });
  } else {
    sec("Die Identität: ein ServiceAccount|The identity: a service account", "admin", {
      p:["Ein ServiceAccount ist ein Konto, das im Cluster selbst liegt — anders als beim Zertifikat gibt es hier ein Objekt, das du löschen kannst. Genau das ist sein Vorteil: Der Zugang lässt sich jederzeit zurücknehmen.|A service account is an account that lives inside the cluster — unlike the certificate there is an object here that you can delete. That is exactly its advantage: access can be withdrawn at any time.",
         "Der Preis: Ein Token ist ein Kennwort im Klartext. Wer es sieht, ist der Benutzer. Es gehört nicht in ein Repository, nicht in eine Chatnachricht und nicht in eine Umgebungsvariable, die irgendwo protokolliert wird.|The price: a token is a password in plain text. Whoever sees it is the user. It does not belong in a repository, a chat message or an environment variable that gets logged somewhere."],
      items:[
        {c:"kubectl create serviceaccount " + o.user + " -n " + o.ns,
         d:"Das Konto selbst. Ohne RoleBinding darf es nichts — der ServiceAccount allein ist kein Recht.|The account itself. Without a role binding it may do nothing — a service account alone is not a permission."},
        {c:"kubectl create token " + o.user + " -n " + o.ns + " --duration=" + (o.days * 24) + "h",
         d:"Erzeugt ein befristetes Token und gibt es aus. Der API-Server kann die Höchstdauer begrenzen, dann bekommst du eine kürzere zurück als angefragt — die Ausgabe zählt, nicht die Anfrage.|Creates a time-limited token and prints it. The API server can cap the maximum duration, in which case you get back a shorter one than requested — the output counts, not the request."},
        {c:"kubectl delete serviceaccount " + o.user + " -n " + o.ns,
         d:"Der Widerruf. Alle Token dieses Kontos sind damit sofort wertlos — das ist der Unterschied zum Zertifikat.|The revocation. Every token of this account becomes worthless immediately — that is the difference from the certificate."}
      ],
      r:[{lvl:"warn", m:t("ServiceAccounts sind für Programme gedacht, nicht für Menschen. Für zwei, drei Personen im Heimlabor ist das in Ordnung. Sobald es mehr werden oder Nachvollziehbarkeit zählt, gehört ein richtiger Anmeldedienst davor — OIDC über Keycloak, Entra ID oder Google.|Service accounts are meant for programs, not people. For two or three people in a home lab that is fine. As soon as there are more, or accountability matters, a proper sign-in service belongs in front — OIDC via Keycloak, Entra ID or Google.")}]
    });
  }

  /* --- 5. kubeconfig --- */
  const kc = o.user + ".kubeconfig";
  const credLine = cert
    ? "kubectl config set-credentials " + o.user + " \\\n  --client-certificate=" + o.user + ".crt --client-key=" + o.user + ".key \\\n  --embed-certs=true --kubeconfig=" + kc
    : oidc
    ? "kubectl krew install oidc-login   # einmalig, auch beim Benutzer\n\nkubectl config set-credentials " + o.user + " \\\n  --exec-api-version=client.authentication.k8s.io/v1beta1 \\\n  --exec-command=kubectl \\\n  --exec-arg=oidc-login --exec-arg=get-token \\\n  --exec-arg=--oidc-issuer-url=" + o.issuer + " \\\n  --exec-arg=--oidc-client-id=kubernetes \\\n  --exec-arg=--oidc-client-secret=KLIENT-GEHEIMNIS-HIER \\\n  --exec-arg=--oidc-extra-scope=email --exec-arg=--oidc-extra-scope=groups \\\n  --exec-arg=--grant-type=password \\\n  --exec-arg=--certificate-authority=dex-ca.crt \\\n  --kubeconfig=" + kc
    : "kubectl config set-credentials " + o.user + " \\\n  --token=\"$(kubectl create token " + o.user + " -n " + o.ns + " --duration=" + (o.days * 24) + "h)\" \\\n  --kubeconfig=" + kc;
  sec("Die kubeconfig bauen|Building the kubeconfig", "admin", {
    p:["Eine kubeconfig besteht aus drei Teilen, die getrennt gesetzt und dann verbunden werden: **wo** der Cluster ist, **wer** du bist, und **welche Kombination** aus beidem gerade gilt. Der letzte Befehl setzt den Namespace mit — sonst landet der Benutzer in `default` und sieht nichts.|A kubeconfig consists of three parts that are set separately and then joined: **where** the cluster is, **who** you are, and **which combination** of the two is currently active. The last command sets the namespace too — otherwise the user lands in `default` and sees nothing."],
    items:[
      {c:"kubectl config view --raw --minify \\\n  -o jsonpath='{.clusters[0].cluster.certificate-authority-data}' | base64 -d > ca.crt\nkubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}{\"\\n\"}'",
       d:"Die CA und die Adresse aus deiner **eigenen** kubeconfig. Das ist der Weg, der überall funktioniert — bei kubeadm, bei k3s und bei einem verwalteten Cluster, wo es die Datei auf keiner Maschine gibt, an die du herankommst. Die zweite Zeile liefert genau den Wert, der oben ins Feld API-Adresse gehört.|The CA and the address out of your **own** kubeconfig. That is the route that works everywhere — with kubeadm, with k3s, and with a managed cluster where the file exists on no machine you can reach. The second line prints exactly the value that belongs in the API address field above."},
      {c:"kubectl config set-cluster cluster \\\n  --server=https://" + o.api + " \\\n  --certificate-authority=ca.crt \\\n  --embed-certs=true --kubeconfig=" + kc,
       d:"embed-certs schreibt die CA in die Datei hinein. Ohne das verweist die kubeconfig auf einen Pfad, den es auf dem Rechner des Benutzers nicht gibt. Auf einem kubeadm-Hauptserver liegt dieselbe Datei unter /etc/kubernetes/pki/ca.crt, bei k3s unter /var/lib/rancher/k3s/server/tls/server-ca.crt.|embed-certs writes the CA into the file. Without it the kubeconfig points at a path that does not exist on the user's machine. On a kubeadm control-plane node the same file sits at /etc/kubernetes/pki/ca.crt, with k3s at /var/lib/rancher/k3s/server/tls/server-ca.crt."},
      {c:credLine,
       d:cert ? "Zertifikat und Schlüssel wandern ebenfalls in die Datei. Danach ist sie eigenständig — und damit so schützenswert wie ein Kennwort.|Certificate and key go into the file as well. It is then self-contained — and as worth protecting as a password."
         : oidc ? "In der Datei steht diesmal **kein** Zugangsdatum, sondern ein Aufruf: kubectl startet bei Bedarf das Werkzeug oidc-login, das nach Name und Kennwort fragt und ein Token holt. --grant-type=password ist dabei der Unterschied zwischen einer Abfrage auf der Kommandozeile und einem Browserfenster. Das Token landet im Zwischenspeicher unter ~/.kube/cache/oidc-login und wird bis zum Ablauf wiederverwendet.|This time the file contains **no** credential but a call: when needed, kubectl starts the oidc-login tool, which asks for name and password and fetches a token. --grant-type=password is the difference between a prompt on the command line and a browser window. The token lands in the cache under ~/.kube/cache/oidc-login and is reused until it expires."
                : "Das Token wandert im Klartext in die Datei. Danach ist sie eigenständig — und damit so schützenswert wie ein Kennwort.|The token goes into the file in plain text. It is then self-contained — and as worth protecting as a password."},
      {c:"kubectl config set-context " + o.user + " \\\n  --cluster=cluster --user=" + o.user + " --namespace=" + o.ns + " --kubeconfig=" + kc + "\nkubectl config use-context " + o.user + " --kubeconfig=" + kc,
       d:"Der Namespace im Kontext erspart dem Benutzer das -n bei jedem Befehl — und verhindert, dass er aus Versehen in default arbeitet.|The namespace in the context saves the user the -n on every command — and keeps them from accidentally working in default."},
      {c:oidc ? "KUBECONFIG=" + kc + " kubectl get pods   # fragt jetzt nach Name und Kennwort"
              : "KUBECONFIG=" + kc + " kubectl get pods",
       d:"Der erste echte Test, noch als du selbst. Kommt hier eine Fehlermeldung über Rechte, stimmt die Bindung nicht — kommt eine über die Verbindung, stimmt die Adresse nicht.|The first real test, still as yourself. An error about permissions here means the binding is wrong — one about the connection means the address is wrong."}
    ]
  });

  /* --- 5b. beim Benutzer --- */
  sec("Beim Benutzer ankommen|Arriving at the user", "user", {
    p:["Die fertige Datei geht an die Person, für die sie ist — über einen Weg, dem du beide vertraut: verschlüsselt, nicht als Chatnachricht und nicht als Anhang in einem Ticket. Sie enthält den vollständigen Zugang.|The finished file goes to the person it is for — over a route you both trust: encrypted, not as a chat message and not as an attachment in a ticket. It contains complete access.",
       "Wichtig zu wissen: Ein Konto auf dem Server braucht dafür niemand. Der Cluster ist über die API erreichbar, und kubectl läuft genauso gut auf dem eigenen Rechner. Der Linux-Benutzer im nächsten Schritt ist nur nötig, wenn wirklich **auf** dem Server gearbeitet werden soll.|Worth knowing: nobody needs an account on the server for this. The cluster is reachable over the API and kubectl runs just as well on your own machine. The Linux user in the next step is only needed if work really has to happen **on** the server."],
    items:[
      {c:"# auf dem Rechner des Benutzers, sobald die Datei dort angekommen ist:\nmkdir -p ~/.kube\ninstall -m 600 " + kc + " ~/.kube/config",
       d:"install kopiert und setzt die Rechte in einem Zug — die Vorlage bleibt liegen, denn beim Verwalter wird sie im nächsten Schritt noch gebraucht. Wer schon eine kubeconfig hat, legt diese daneben und schaltet mit der Umgebungsvariable KUBECONFIG um, statt die vorhandene zu überschreiben.|install copies and sets the permissions in one go — the original stays, because the admin still needs it in the next step. Anyone who already has a kubeconfig puts this one next to it and switches with the KUBECONFIG environment variable instead of overwriting the existing one."},
      {c:"kubectl config get-contexts\nkubectl config current-context\nkubectl config view --minify",
       d:"Zeigt, mit welchem Cluster, als wer und in welchem Namespace gearbeitet wird. Die dritte Zeile blendet alles aus, was gerade nicht gilt.|Shows which cluster, as whom and in which namespace you are working. The third line hides everything not currently in effect."},
      {c:"kubectl get pods\nkubectl auth can-i --list",
       d:"Der erste Befehl als der neue Benutzer selbst. Die Liste dahinter beantwortet gleich mit, was noch geht — bevor die erste Fehlermeldung Rätsel aufgibt.|The first command as the new user themselves. The list behind it answers what else is possible — before the first error message becomes a riddle."}
    ],
    r:[{lvl:"warn", m:t("In Visual Studio Code genügt die Kubernetes-Erweiterung mit dieser Datei — sie spricht die API direkt an. Remote-SSH auf den Hauptserver ist etwas anderes und für das reine Arbeiten mit kubectl nicht nötig.|In Visual Studio Code the Kubernetes extension with this file is enough — it talks to the API directly. Remote SSH onto the control plane is a different thing and not needed just to work with kubectl.")}]
  });

  /* --- 6. Linux-Benutzer --- */
  if (o.linux){
    sec("Der Linux-Benutzer auf dem Server|The Linux user on the server", "cp", {
      p:["Zwei völlig verschiedene Benutzerbegriffe treffen hier aufeinander: Der Linux-Benutzer meldet sich am Server an, der Kubernetes-Benutzer an der API. Sie haben nichts miteinander zu tun — der eine kennt den anderen nicht. Die Verbindung entsteht allein dadurch, dass die kubeconfig im Heimatverzeichnis liegt.|Two entirely different notions of user meet here: the Linux user signs in to the server, the Kubernetes user to the API. They have nothing to do with each other — neither knows the other. The connection exists solely because the kubeconfig sits in the home directory.",
         "Entscheidend ist, was du **nicht** vergibst. Drei Dinge machen jeden Benutzer sofort zum Cluster-Administrator, ganz gleich welche Rolle er in Kubernetes hat: sudo, Leserecht auf `/etc/kubernetes/admin.conf`, und Zugriff auf den Socket der Container-Runtime.|What matters is what you do **not** hand out. Three things turn any user into a cluster administrator immediately, no matter what role they hold in Kubernetes: sudo, read access to `/etc/kubernetes/admin.conf`, and access to the container runtime's socket."],
      items:[
        {c:"sudo adduser --disabled-password --gecos \"\" " + o.user,
         d:"Kein Kennwort, keine Zusatzgruppen. Die Anmeldung läuft über den SSH-Schlüssel im nächsten Schritt.|No password, no extra groups. Sign-in goes through the SSH key in the next step."},
        {c:"sudo install -d -o " + o.user + " -g " + o.user + " -m 700 /home/" + o.user + "/.ssh\nsudo tee /home/" + o.user + "/.ssh/authorized_keys <<< \"ssh-ed25519 AAAA... " + o.user + "\"\nsudo chown " + o.user + ":" + o.user + " /home/" + o.user + "/.ssh/authorized_keys\nsudo chmod 600 /home/" + o.user + "/.ssh/authorized_keys",
         d:"Den öffentlichen Schlüssel lässt du dir schicken — der private bleibt beim Benutzer. Umgekehrt wäre es kein Schlüssel, sondern ein geteiltes Geheimnis.|Have the public key sent to you — the private one stays with the user. The other way round it would not be a key but a shared secret."},
        {c:"sudo install -D -o " + o.user + " -g " + o.user + " -m 600 " + kc + " /home/" + o.user + "/.kube/config",
         d:"600 ist hier keine Förmlichkeit: Die Datei enthält den vollständigen Zugang zum Cluster.|600 is not a formality here: the file contains complete access to the cluster."},
        {c:"sudo -u " + o.user + " kubectl get pods\nsudo -u " + o.user + " kubectl get pods -n kube-system",
         d:"Der erste Befehl muss gehen, der zweite muss scheitern. Geht der zweite auch, ist die Bindung clusterweit geraten statt auf den Namespace begrenzt.|The first command has to work, the second has to fail. If the second works too, the binding ended up cluster-wide instead of scoped to the namespace."},
        {c:"getent group sudo\nls -l /etc/kubernetes/admin.conf\nls -l /run/containerd/containerd.sock",
         d:"Die Gegenprobe: Der neue Name darf in keiner dieser drei Ausgaben auftauchen — weder in der Gruppe noch als Besitzer noch in einer Gruppe, die auf die Dateien darf.|The counter-check: the new name must appear in none of these three outputs — not in the group, not as owner, not in a group with access to those files."}
      ],
      r:[{lvl:"err", m:t("Wer sudo hat, liest /etc/kubernetes/admin.conf und ist damit Cluster-Administrator. Jede Rolle, jede Quota und jede Netzregel ist dann bedeutungslos. Dasselbe gilt für den containerd- oder docker-Socket: darüber startet man einen Container, der das Wirtsdateisystem einhängt.|Whoever has sudo reads /etc/kubernetes/admin.conf and is thereby a cluster administrator. Every role, every quota and every network policy is then meaningless. The same goes for the containerd or docker socket: through it you start a container that mounts the host filesystem.")},
         {lvl:"warn", m:t("Auf einem Hauptserver arbeiten mehrere Menschen gleichzeitig selten gut. Bequemer und sicherer ist es, ihnen die kubeconfig auf den eigenen Rechner zu geben — der Cluster ist über die API erreichbar, ein Konto auf dem Server braucht es dafür nicht.|Several people working on a control-plane node at once rarely goes well. It is more convenient and safer to hand them the kubeconfig for their own machine — the cluster is reachable over the API, an account on the server is not needed for that.")}]
    });
  }

  /* --- 7. Netz --- */
  if (o.netpol){
    sec("Den Namespace abschotten|Sealing the namespace off", "admin", {
      p:["Ohne NetworkPolicy darf jeder Pod im Cluster mit jedem anderen sprechen — über alle Namespaces hinweg. Die Trennung, die du gerade gebaut hast, gilt für die API, nicht für das Netz.|Without a network policy every pod in the cluster may talk to every other one — across all namespaces. The separation you just built applies to the API, not to the network.",
         "Das übliche Muster sind zwei Regeln: erst alles verbieten, dann das Nötige wieder erlauben. DNS muss dabei ausdrücklich erlaubt werden — sonst löst im Namespace kein einziger Name mehr auf, und die Fehlersuche führt in die Irre, weil es wie ein Anwendungsfehler aussieht.|The usual pattern is two rules: forbid everything first, then allow back what is needed. DNS has to be allowed explicitly — otherwise not a single name resolves in the namespace, and the hunt goes astray because it looks like an application error."],
      items:[
        {c:"cat <<'EOF' | kubectl apply -f -\napiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: default-deny\n  namespace: " + o.ns + "\nspec:\n  podSelector: {}\n  policyTypes:\n    - Ingress\n    - Egress\n---\napiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: erlaubt-intern-und-dns\n  namespace: " + o.ns + "\nspec:\n  podSelector: {}\n  policyTypes:\n    - Ingress\n    - Egress\n  ingress:\n    - from:\n        - podSelector: {}\n  egress:\n    - to:\n        - podSelector: {}\n    - to:\n        - namespaceSelector:\n            matchLabels:\n              kubernetes.io/metadata.name: kube-system\n      ports:\n        - protocol: UDP\n          port: 53\n        - protocol: TCP\n          port: 53\nEOF",
         d:"Die erste Regel verbietet alles, die zweite erlaubt den Verkehr innerhalb des Namespace und DNS nach kube-system. Regeln addieren sich — es gibt kein Verbot, das ein Erlaubnis übersteuert.|The first rule forbids everything, the second allows traffic inside the namespace and DNS to kube-system. Rules add up — there is no deny that overrides an allow."},
        {c:"kubectl run test --rm -it -n " + o.ns + " --image=busybox:1.36 --restart=Never -- \\\n  sh -c 'nslookup kubernetes.default.svc.cluster.local; wget -qO- -T3 http://example.com || echo blockiert'",
         d:"Die Probe aufs Exempel: Der Name muss auflösen, der Zugriff nach außen muss scheitern. Nur eines von beiden zu prüfen führt regelmäßig zu einem falschen Ergebnis.|The actual test: the name has to resolve, the outward access has to fail. Checking only one of the two regularly leads to a wrong conclusion."}
      ],
      r:[{lvl:"warn", m:t("Flannel setzt NetworkPolicies nicht durch. Der API-Server nimmt sie an, kubectl meldet keinen Fehler, und es passiert schlicht nichts. Wirksam sind sie erst mit Calico, Cilium oder einem anderen CNI, das Policies unterstützt.|Flannel does not enforce network policies. The API server accepts them, kubectl reports no error, and simply nothing happens. They only take effect with Calico, Cilium or another CNI that supports policies.")},
         {lvl:"warn", m:t("Die Regel schneidet auch den Weg nach außen ab. Braucht eine Anwendung im Namespace das Internet — für Paketquellen, eine API, einen Webhook — muss das ausdrücklich erlaubt werden.|The rule also cuts off the way out. If an application in the namespace needs the internet — for package repositories, an API, a webhook — that has to be allowed explicitly.")}]
    });
  }

  /* --- 7b. Nodes --- */
  if (o.pin){
    const key = o.pool.split("=")[0];
    const val = o.pool.split("=").slice(1).join("=") || o.ns;
    sec("Den Namespace an Nodes binden|Tying the namespace to nodes", "admin", {
      p:["Zwei Richtungen, und sie sind nicht dasselbe. **Hin**: Die Pods dieses Namespace sollen nur auf bestimmten Nodes landen. **Zurück**: Auf diesen Nodes soll sonst nichts laufen. Wer nur die erste einrichtet, hat einen reservierten Bereich, in dem trotzdem jeder andere mitspielt.|Two directions, and they are not the same thing. **There**: the pods of this namespace should only land on certain nodes. **Back**: nothing else should run on those nodes. Setting up only the first gives you a reserved area everyone else still plays in.",
         "Die Hinrichtung macht ein `nodeSelector` an jedem Pod. Den von Hand in jedes Manifest zu schreiben hält niemand durch — deshalb setzt ihn eine Annotation am Namespace für alle Pods darin, sobald das Admission-Plugin `PodNodeSelector` läuft.|The there-direction is a `nodeSelector` on every pod. Writing it by hand into every manifest is not sustainable — so an annotation on the namespace sets it for every pod inside, once the `PodNodeSelector` admission plugin is running."],
      table:[["Was du willst|What you want","Womit|With what","Wirkt auf|Acts on"],
        ["Nur diese Nodes benutzen|Use only these nodes","nodeSelector, gesetzt über die Namespace-Annotation|nodeSelector, set via the namespace annotation","die Pods des Namespace|the namespace's pods"],
        ["Andere fernhalten|Keep others away","Taint auf den Nodes|A taint on the nodes","alle anderen Pods|all other pods"],
        ["Beides|Both","Annotation und Taint zusammen|Annotation and taint together","echte Zuteilung|a real assignment"]],
      items:[
        {c:"kubectl label node NODE-1 NODE-2 " + o.pool + " --overwrite\nkubectl get nodes -l " + o.pool,
         d:"Zuerst die Nodes markieren. Der zweite Befehl muss genau die Maschinen zeigen, die gemeint sind — kommt eine leere Liste, passt das Label nicht.|Mark the nodes first. The second command has to show exactly the machines you mean — an empty list means the label does not match."},
        {c:"kubectl annotate namespace " + o.ns + " \\\n  scheduler.alpha.kubernetes.io/node-selector='" + o.pool + "' --overwrite",
         d:"Von jetzt an bekommt jeder Pod in diesem Namespace diesen nodeSelector eingesetzt — auch die, die ein Deployment oder ein DaemonSet erzeugt. Bringt ein Pod bereits einen widersprechenden Selector mit, wird er abgelehnt statt stillschweigend verschoben.|From now on every pod in this namespace gets this nodeSelector inserted — including those created by a deployment or a daemon set. A pod that already carries a conflicting selector is rejected rather than silently moved."},
        {c:"# auf jedem Hauptserver, in /etc/kubernetes/manifests/kube-apiserver.yaml:\n    - --enable-admission-plugins=NodeRestriction,PodNodeSelector\n\n# danach:\nkubectl get --raw /healthz",
         d:"Ohne dieses Plugin wird die Annotation **stillschweigend ignoriert**. Kein Fehler, keine Meldung — die Pods verteilen sich weiter über alle Nodes, und man sucht lange an der falschen Stelle. Vorhandene Plugins in der Zeile stehen lassen und PodNodeSelector nur anhängen.|Without this plugin the annotation is **silently ignored**. No error, no message — the pods keep spreading across all nodes and you search in the wrong place for a long time. Keep the existing plugins in that line and only append PodNodeSelector."}
      ].concat(o.taint ? [
        {c:"kubectl taint nodes NODE-1 NODE-2 " + key + "=" + val + ":NoSchedule --overwrite\nkubectl describe node NODE-1 | grep -A2 Taints",
         d:"Der Riegel in die Gegenrichtung. NoSchedule hält neue Pods fern und lässt laufende in Ruhe; NoExecute würde auch die bereits laufenden vertreiben.|The bolt in the other direction. NoSchedule keeps new pods away and leaves running ones alone; NoExecute would also evict those already running."},
        {c:"kubectl annotate namespace " + o.ns + " \\\n  scheduler.alpha.kubernetes.io/defaultTolerations='[{\"key\":\"" + key + "\",\"operator\":\"Equal\",\"value\":\"" + val + "\",\"effect\":\"NoSchedule\"}]' --overwrite",
         d:"Damit die eigenen Pods den Taint überwinden, ohne dass jemand eine toleration ins Manifest schreiben muss. Braucht zusätzlich das Plugin PodTolerationRestriction in derselben Zeile wie oben. Wer das nicht will, schreibt die toleration je Deployment von Hand — der Wizard baut sie im Schritt Zeitplanung mit.|So that your own pods overcome the taint without anyone writing a toleration into a manifest. This additionally needs the PodTolerationRestriction plugin in the same line as above. If you would rather not, write the toleration per deployment by hand — the wizard builds it in the scheduling step."}
      ] : []).concat([
        {c:"kubectl -n " + o.ns + " run pintest --image=busybox:1.36 --restart=Never -- sleep 60\nkubectl -n " + o.ns + " get pod pintest -o wide\nkubectl -n " + o.ns + " get pod pintest -o jsonpath='{.spec.nodeSelector}{\"\\n\"}'\nkubectl -n " + o.ns + " delete pod pintest",
         d:"Die Probe: Der Pod muss auf einem der markierten Nodes liegen, und die dritte Zeile muss den Selector zeigen. Ist sie leer, läuft das Plugin nicht.|The test: the pod has to sit on one of the marked nodes, and the third line has to show the selector. If it is empty, the plugin is not running."}
      ]),
      r:[{lvl:"err", m:t("Die Annotation allein bewirkt nichts. Sie ist eine Anweisung an ein Admission-Plugin, das erst eingeschaltet werden muss — und der Cluster meldet nirgends, dass es fehlt. Nach dem Einschalten mit dem Testpod oben nachweisen, dass der Selector wirklich gesetzt wird.|The annotation alone does nothing. It is an instruction to an admission plugin that has to be switched on first — and the cluster reports nowhere that it is missing. After switching it on, use the test pod above to prove the selector is really being set.")},
         {lvl:"warn", m:t("Sind alle markierten Nodes voll oder nicht bereit, bleiben die Pods in Pending stehen. Sie weichen nicht aus — das ist der Sinn der Sache, überrascht aber beim ersten Ausfall. Zwei Nodes sind das Minimum, wenn es weiterlaufen soll.|If all marked nodes are full or not ready, the pods stay Pending. They do not fall back — that is the whole point, but it surprises you at the first outage. Two nodes are the minimum if things should keep running.")}]
        .concat(o.taint ? [{lvl:"warn", m:t("DaemonSets aus kube-system — CNI, kube-proxy, Speicher-Treiber — bringen meist eine allgemeine toleration mit und laufen weiter. Selbst gebaute DaemonSets tun das nicht und verschwinden von diesen Nodes, sobald der Taint steht.|Daemon sets from kube-system — CNI, kube-proxy, storage drivers — usually carry a blanket toleration and keep running. Home-grown daemon sets do not, and disappear from those nodes the moment the taint is set.")}] : [])
    });
  }

  /* --- 7c. Serie --- */
  if (o.batch){
    sec("Mehrere auf einmal|Several at once", "admin", {
      p:["Für zwei oder drei Personen ist der Weg oben der richtige: nachlesen, verstehen, tippen. Ab dem vierten Mal ist es Fleißarbeit mit Tippfehlern — und genau dafür ist der Ansible-Export da.|For two or three people the route above is the right one: read, understand, type. From the fourth time on it is busywork with typos — and that is exactly what the Ansible export is for.",
         "Der Knopf **Ansible** liefert dann keine Abbildung dieser Anleitung mehr, sondern Playbooks, die über eine Liste laufen. Die Werte stehen an einer Stelle — `group_vars/all.yml` — und nicht im Befehlstext. Ein weiterer Benutzer ist ein Eintrag mehr, kein weiterer Durchlauf.|The **Ansible** button then no longer delivers a copy of this guide but playbooks that loop over a list. The values sit in one place — `group_vars/all.yml` — instead of inside the command text. Another user is one more entry, not another pass.",
         "Was dabei anders ist: Die Manifeste laufen über `kubernetes.core.k8s` und sind wiederholbar, die Schlüssel entstehen über `community.crypto` statt über `openssl` von Hand, und die Abnahme lässt den Lauf **scheitern**, wenn ein Benutzer an `kube-system` herankommt.|What differs: the manifests run through `kubernetes.core.k8s` and are repeatable, the keys come from `community.crypto` instead of `openssl` by hand, and the acceptance play **fails** the run if a user can reach `kube-system`."],
      r:[{lvl:"warn", m:t("Die erzeugten Schlüssel und kubeconfigs landen im Verzeichnis out/. Das ist vollständiger Zugang zu jedem dieser Namespaces — nach der Übergabe löschen und niemals ins Repository legen.|The generated keys and kubeconfigs land in the out/ directory. That is complete access to every one of those namespaces — delete it after handover and never put it in the repository.")}]
    });
  }

  /* --- 8. Prüfen --- */
  sec("Prüfen, ob die Grenze hält|Checking that the boundary holds", "admin", {
    p:["`kubectl auth can-i --as=` ist die ehrlichste Prüfung, die es gibt: Der API-Server beantwortet die Frage genau so, wie er es beim echten Benutzer täte — dieselbe Auswertung, dieselben Regeln. Was hier steht, gilt.|`kubectl auth can-i --as=` is the most honest check there is: the API server answers the question exactly as it would for the real user — same evaluation, same rules. What it says is what holds.",
       "Wichtig ist, auch die Fragen zu stellen, deren Antwort **no** sein muss. Ein Test, der nur bestätigt, was funktionieren soll, findet keine zu weit geratene Bindung.|What matters is asking the questions whose answer has to be **no** as well. A test that only confirms what should work will never find a binding that turned out too wide."],
    items:[
      {c:"kubectl auth can-i --list --as=" + asUser + " -n " + o.ns,
       d:"Die vollständige Liste dessen, was im eigenen Namespace erlaubt ist. Kurz durchlesen lohnt sich — hier fällt auf, wenn die Stufe zu hoch gewählt war.|The complete list of what is allowed in the own namespace. Worth a quick read — this is where an overly high level shows itself."},
      {c:"kubectl auth can-i get secrets -n kube-system --as=" + asUser + "\nkubectl auth can-i delete namespace " + o.ns + " --as=" + asUser + "\nkubectl auth can-i create clusterrolebinding --as=" + asUser + "\nkubectl auth can-i get nodes --as=" + asUser,
       d:"Vier Fragen, auf die viermal no kommen muss. Kommt irgendwo yes, ist eine Bindung clusterweit statt auf den Namespace begrenzt — dann ist ein ClusterRoleBinding im Spiel, wo ein RoleBinding hingehört.|Four questions that have to be answered no four times. A yes anywhere means a binding is cluster-wide instead of scoped — then a ClusterRoleBinding is in play where a RoleBinding belongs."},
      {c:"kubectl get clusterrolebindings -o custom-columns=NAME:.metadata.name,ROLE:.roleRef.name,SUBJECTS:.subjects[*].name \\\n  | grep -v '^system:'",
       d:"Der Blick aufs Ganze: Alles, was clusterweit gebunden ist und nicht von Kubernetes selbst stammt. Diese Liste sollte man kennen und erklären können.|The wider view: everything bound cluster-wide that does not come from Kubernetes itself. You should know this list and be able to explain it."},
      {c:cert ? "shred -u " + o.user + ".key " + o.user + ".csr " + o.user + ".crt " + kc + " ca.crt"
              : "shred -u " + kc + " ca.crt",
       d:"Zum Schluss aufräumen. Der private Schlüssel und die fertige kubeconfig sind vollständiger Zugang zu diesem Namespace — auf der Maschine des Verwalters haben sie nichts mehr verloren, sobald sie beim Benutzer angekommen sind. Der Cluster braucht sie nicht: Was er behält, ist das unterschriebene Zertifikat.|Clean up at the end. The private key and the finished kubeconfig are complete access to this namespace — they have no business on the admin's machine once they have reached the user. The cluster does not need them: what it keeps is the signed certificate."}
    ],
    r:[{lvl:"warn", m:t("--as selbst ist ein Recht, das nur Administratoren haben. Ein Benutzer kann sich damit nicht zu jemand anderem machen — wer es könnte, wäre bereits Administrator.|--as is itself a permission only administrators have. A user cannot make themselves into someone else with it — anyone who could would already be an administrator.")}]
  });

  /* --- 9. Zurücknehmen --- */
  sec("Wieder wegnehmen|Taking it back", "admin", {
    back:true,
    p:["Der Weg hinaus ist kürzer als der hinein, hat aber eine scharfe Kante: `kubectl delete namespace` löscht **alles** darin — Deployments, Secrets, PVCs. Ob die Daten hinter den PVCs mitgehen, entscheidet die reclaimPolicy der StorageClass.|The way out is shorter than the way in but has a sharp edge: `kubectl delete namespace` deletes **everything** inside — deployments, secrets, PVCs. Whether the data behind the PVCs goes with them is decided by the storage class's reclaim policy."],
    items:[
      {c:"kubectl delete rolebinding " + o.user + "-" + TENANT_ROLE[o.level] + " -n " + o.ns,
       d:"Der schonende Weg: Die Rechte sind weg, alles andere bleibt stehen. Bei einem Zertifikat ist das der einzige wirksame Widerruf.|The gentle way: the rights are gone, everything else stays. With a certificate this is the only effective revocation."},
      {c:cert ? "kubectl delete csr " + o.user
         : oidc ? "# den Eintrag aus staticPasswords in der ConfigMap entfernen, dann:\nkubectl -n dex rollout restart deployment dex"
                : "kubectl delete serviceaccount " + o.user + " -n " + o.ns,
       d:cert ? "Räumt das Antragsobjekt weg. Das bereits ausgestellte Zertifikat bleibt davon unberührt und gilt bis zum Ablauf weiter — dagegen hilft nur die Zeit.|Cleans away the request object. The certificate already issued is untouched and remains valid until it expires — only time helps against that."
         : oidc ? "Der Benutzer kann sich danach nicht mehr anmelden. Ein bereits ausgestelltes Token gilt noch bis zum Ablauf — meist einen Tag. Wer sofort zumachen muss, entfernt zusätzlich das RoleBinding.|The user can no longer sign in afterwards. A token already issued remains valid until it expires — usually a day. Anyone who has to close the door immediately also removes the role binding."
                : "Der wirksame Widerruf: Mit dem Konto sind auch alle seine Token sofort wertlos.|The effective revocation: with the account gone, all its tokens are worthless immediately."},
      {c:"kubectl delete namespace " + o.ns,
       d:"Der große Schnitt. Vorher mit kubectl get all -n NAMESPACE nachsehen, was darin noch läuft.|The big cut. Check what is still running inside with kubectl get all -n NAMESPACE first."}
    ].concat(o.linux ? [{c:"sudo deluser --remove-home " + o.user,
       d:"Entfernt das Konto samt Heimatverzeichnis und damit auch die kubeconfig darin.|Removes the account together with its home directory, and with it the kubeconfig inside."}] : []),
    r:[{lvl:"err", m:t("Ein gelöschter Namespace kommt nicht zurück. Bleibt er in Terminating hängen, wartet meist ein Finalizer auf eine Ressource, die es nicht mehr gibt — dann zeigt kubectl get namespace NAME -o yaml, worauf.|A deleted namespace does not come back. If it hangs in Terminating, usually a finalizer is waiting on a resource that no longer exists — kubectl get namespace NAME -o yaml then shows what it is.")}]
  });

  /* --- 10. Grenzen --- */
  sec("Was diese Trennung nicht leistet|What this separation does not do", "admin", {
    p:["Ein Namespace trennt die API, nicht den Rechner. Alle Pods aller Benutzer teilen sich denselben Kernel, dieselben Nodes und dieselbe Netzwerkkarte. Das ist kein Mangel der Einrichtung, sondern die Bauart von Kubernetes.|A namespace separates the API, not the machine. All pods of all users share the same kernel, the same nodes and the same network card. That is not a shortcoming of the setup but the way Kubernetes is built."],
    table:[["Getrennt ist|Separated","Nicht getrennt ist|Not separated"],
      ["Objekte, Namen, Rechte über RBAC|Objects, names, rights via RBAC","Kernel und Node — eine Lücke dort trifft alle|Kernel and node — a hole there hits everyone"],
      ["Verbrauch über ResourceQuota|Consumption via ResourceQuota","Ein voller Node oder volles Dateisystem|A full node or a full filesystem"],
      ["Netzverkehr über NetworkPolicy|Network traffic via NetworkPolicy","Verkehr innerhalb desselben Namespace|Traffic inside the same namespace"],
      ["Was der Benutzer an der API darf|What the user may do at the API","Was ein Pod im Container tut|What a pod does inside the container"]],
    p2:["Für Kolleginnen und Kollegen, die man kennt, reicht diese Trennung gut aus — sie verhindert Versehen und macht Zuständigkeiten sichtbar. Für Benutzer, die einander nicht vertrauen, oder für fremden Code reicht sie nicht: Dann braucht es getrennte Cluster, virtuelle Cluster wie vCluster, oder eine Laufzeit mit eigenem Kernel wie Kata oder gVisor.|For colleagues you know, this separation is quite sufficient — it prevents accidents and makes responsibilities visible. For users who do not trust each other, or for foreign code, it is not enough: then you need separate clusters, virtual clusters such as vCluster, or a runtime with its own kernel such as Kata or gVisor."]
  });

  return out;
}

/* ---------- MetalLB ----------
   Vergibt Adressen aus dem Knoten-Netz an Services vom Typ LoadBalancer —
   die Rolle, die in der Cloud der Anbieter übernimmt und im eigenen Rechenzentrum
   sonst niemand. */
const METALLB_FIELDS = [
  {k:"range", t:"text", l:"Adressbereich|Address range", ph:"172.18.42.240-172.18.42.250",
   hint:"Bereich, einzelne Adresse oder CIDR. Muss im **selben** Netz liegen wie die Knoten und außerhalb des DHCP-Bereichs des Routers.|A range, a single address or a CIDR. Has to sit in the **same** network as the nodes and outside the router's DHCP range."},
  {k:"mode", t:"select", l:"Betriebsart|Mode", half:true, structural:true,
   opts:[["l2","L2 — antwortet per ARP, braucht nichts am Router|L2 — answers over ARP, needs nothing on the router"],
         ["bgp","BGP — der Router lernt die Route, echte Lastverteilung|BGP — the router learns the route, real load spreading"]]},
  {k:"install", t:"select", l:"Installation", half:true, structural:true,
   opts:[["manifest","Manifest — eine Datei, keine weiteren Werkzeuge|Manifest — one file, no further tooling"],
         ["helm","Helm — leichter zu aktualisieren|Helm — easier to update"]]},
  {k:"version", t:"text", l:"Version", ph:"v0.15.2", half:true, when:o => (o.install || "manifest") === "manifest",
   hint:"Steht fest in der Manifest-Adresse. Vor der Installation kurz nachsehen, ob es eine neuere gibt.|Baked into the manifest URL. Check for a newer one before installing."},
  {k:"autoAssign", t:"bool", structural:true, l:"Adressen automatisch vergeben|Hand out addresses automatically",
   hint:"Aus: Ein Service bekommt nur dann eine Adresse, wenn er den Pool ausdrücklich nennt. Sinnvoll, wenn der Bereich klein ist.|Off: a service only gets an address if it names the pool explicitly. Sensible when the range is small."},
  {k:"ingress", t:"bool", l:"Ingress-Controller auf die erste Adresse setzen|Point the ingress controller at the first address"},
  {k:"ipvs", t:"bool", l:"kube-proxy läuft im IPVS-Modus|kube-proxy runs in IPVS mode",
   hint:"Dann braucht es strictARP. Im Standardmodus iptables schadet die Einstellung nicht.|Then strictARP is required. In the default iptables mode the setting does no harm."},
  {k:"peer", t:"text", l:"Router-Adresse (BGP)|Router address (BGP)", ph:"172.18.42.1", half:true,
   when:o => o.mode === "bgp"},
  {k:"peerAsn", t:"number", l:"AS des Routers|Router AS", ph:"64512", half:true, when:o => o.mode === "bgp"},
  {k:"myAsn", t:"number", l:"AS des Clusters|Cluster AS", ph:"64513", half:true, when:o => o.mode === "bgp"}
];

function metallbOpts(o){
  /* MetalLB nimmt CIDR oder Bereich, keine nackte Adresse. */
  let range = (o.range || "").trim() || "172.18.42.240-172.18.42.250";
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(range)) range += "/32";
  return {
    range: range,
    mode: o.mode || "l2",
    install: o.install || "manifest",
    version: ((o.version || "").trim() || "v0.15.2").replace(/^(?!v)/, "v"),
    autoAssign: o.autoAssign === undefined ? true : !!o.autoAssign,
    ingress: !!o.ingress,
    ipvs: !!o.ipvs,
    peer: (o.peer || "").trim() || "172.18.42.1",
    peerAsn: num(o.peerAsn) === undefined ? 64512 : num(o.peerAsn),
    myAsn: num(o.myAsn) === undefined ? 64513 : num(o.myAsn)
  };
}

/* Die erste Adresse des Bereichs — sie taucht in den Beispielen wieder auf. */
function firstAddr(range){
  return String(range).split("-")[0].split("/")[0].trim();
}

function metallbGuide(raw){
  const o = metallbOpts(raw);
  const out = [];
  const sec = (h, role, x) => { out.push(Object.assign({h:h, role:role, items:[], p:[], r:[]}, x)); };
  const ip = firstAddr(o.range);
  const l2 = o.mode === "l2";

  /* --- 1. vorher --- */
  sec("Vorher: passt der Bereich überhaupt|First: does the range fit at all", "all", {
    p:["MetalLB erfindet kein Netz. Es vergibt Adressen aus dem Netz, in dem die Knoten schon stehen — deshalb ist die erste Frage nicht, wie man es installiert, sondern welche Adressen frei sind.|MetalLB does not invent a network. It hands out addresses from the network the nodes already sit in — so the first question is not how to install it but which addresses are free.",
       "Zwei Bedingungen, und beide werden regelmäßig übersehen: Der Bereich muss im **selben** Segment liegen wie die Knoten, und er muss **außerhalb** dessen liegen, was der Router per DHCP verteilt. Ein beliebiges freies Netz genügt nicht — im L2-Modus antwortet MetalLB per ARP, und ARP kommt über keinen Router.|Two conditions, and both get overlooked regularly: the range has to be in the **same** segment as the nodes, and it has to be **outside** what the router hands out over DHCP. An arbitrary free network will not do — in L2 mode MetalLB answers over ARP, and ARP does not cross a router."],
    items:[
      {c:"ip -4 addr show | grep -w inet",
       d:"Auf einem Knoten ausführen. Adresse und Präfix daraus bestimmen, welcher Bereich in Frage kommt.|Run on a node. Address and prefix from this determine which range is eligible."},
      {c:"for i in $(seq 240 250); do ping -c1 -W1 " + ip.split(".").slice(0,3).join(".") + ".$i >/dev/null 2>&1 && echo \"$i belegt\"; done",
       d:"Grobe Gegenprobe, ob im geplanten Bereich schon jemand antwortet. Ein Gerät, das gerade aus ist, verrät sich dabei allerdings nicht — der Blick in die DHCP-Einstellungen des Routers bleibt nötig.|A rough check whether something already answers in the planned range. A device that happens to be off will not show up though — a look at the router's DHCP settings stays necessary."}
    ],
    r:[{lvl:"err", m:t("Überschneidet sich der Bereich mit dem DHCP-Bereich des Routers, vergibt irgendwann jemand dieselbe Adresse zweimal. Der Fehler tritt nicht sofort auf, sondern Wochen später und sieht dann nach einem Netzwerkproblem aus.|If the range overlaps the router's DHCP range, sooner or later the same address gets handed out twice. The fault does not appear immediately but weeks later, and then looks like a network problem.")}]
  });

  /* --- 2. strictARP --- */
  if (o.ipvs && l2){
    sec("kube-proxy auf strictARP stellen|Setting kube-proxy to strictARP", "admin", {
      p:["Im IPVS-Modus beantwortet kube-proxy ARP-Anfragen auch für Adressen, die ihm nicht gehören. MetalLB und kube-proxy antworten dann beide, und wer gewinnt, entscheidet der Zufall.|In IPVS mode kube-proxy answers ARP requests even for addresses that are not its own. MetalLB and kube-proxy then both answer, and chance decides who wins."],
      items:[
        {c:"kubectl -n kube-system get configmap kube-proxy -o yaml \\\n  | sed -e 's/strictARP: false/strictARP: true/' \\\n  | kubectl apply -f -\nkubectl -n kube-system rollout restart daemonset kube-proxy",
         d:"Ohne den Neustart bleibt die alte Einstellung im laufenden Prozess. Im Standardmodus iptables ist der Schritt nicht nötig und richtet auch keinen Schaden an.|Without the restart the old setting stays in the running process. In the default iptables mode this step is unnecessary and does no harm either."}
      ]
    });
  }

  /* --- 3. Installation --- */
  sec("MetalLB installieren|Installing MetalLB", "admin", {
    p:["Die Installation bringt zwei Dinge mit: den **Controller**, der Adressen vergibt, und den **Speaker**, der auf jedem Knoten läuft und die Adresse nach außen bekannt macht. Ohne Konfiguration tut beides nichts — der nächste Schritt ist der eigentliche.|The installation brings two things: the **controller**, which hands out addresses, and the **speaker**, which runs on every node and announces the address to the outside. Without configuration neither does anything — the next step is the actual one."],
    items:o.install === "helm"
      ? [{c:"helm repo add metallb https://metallb.github.io/metallb\nhelm repo update\nhelm install metallb metallb/metallb -n metallb-system --create-namespace",
          d:"Helm legt den Namespace mit an und setzt die nötigen Sicherheitslabels selbst.|Helm creates the namespace as well and sets the required security labels itself."},
         {c:"kubectl -n metallb-system get pods\nkubectl -n metallb-system rollout status deployment/metallb-controller",
          d:"Der Controller ist ein Deployment, der Speaker ein DaemonSet — es muss also je Knoten ein Speaker laufen.|The controller is a deployment, the speaker a daemon set — so there has to be one speaker per node."}]
      : [{c:"kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/" + o.version + "/config/manifests/metallb-native.yaml",
          d:"Eine Datei, kein Helm. Die Version steht fest in der Adresse — für ein Upgrade tauscht man sie aus und wendet erneut an.|One file, no Helm. The version is fixed in the URL — for an upgrade you swap it and apply again."},
         {c:"kubectl -n metallb-system get pods -w",
          d:"Warten, bis Controller und Speaker laufen. Erst danach nimmt der Cluster die Konfiguration im nächsten Schritt an — sie wird von einem Webhook geprüft, den die Installation mitbringt.|Wait until controller and speaker are running. Only then does the cluster accept the configuration in the next step — it is checked by a webhook the installation brings along."}],
    r:[{lvl:"warn", m:t("Der Speaker braucht erweiterte Rechte am Netz und läuft deshalb nicht unter dem Pod Security Standard restricted. Die Installation setzt am Namespace metallb-system die Stufe privileged — das ist beabsichtigt und darf nicht überschrieben werden.|The speaker needs elevated network privileges and therefore does not run under the restricted Pod Security Standard. The installation sets the metallb-system namespace to privileged — that is deliberate and must not be overridden.")}]
  });

  /* --- 4. Konfiguration --- */
  const poolYaml = "cat <<'EOF' | kubectl apply -f -\napiVersion: metallb.io/v1beta1\nkind: IPAddressPool\nmetadata:\n  name: haupt\n  namespace: metallb-system\nspec:\n  addresses:\n    - " + o.range + "\n  autoAssign: " + (o.autoAssign ? "true" : "false") + "\n---\napiVersion: metallb.io/v1beta1\nkind: " + (l2 ? "L2Advertisement" : "BGPAdvertisement") + "\nmetadata:\n  name: haupt\n  namespace: metallb-system\nspec:\n  ipAddressPools:\n    - haupt\nEOF";
  sec("Den Adressbereich bekanntgeben|Announcing the address range", "admin", {
    p:l2
      ? ["Zwei Objekte, und beide werden gebraucht: Der **IPAddressPool** sagt, welche Adressen es gibt. Die **L2Advertisement** sagt, dass sie per ARP angekündigt werden sollen. Fehlt das zweite, bleibt jeder Service auf `EXTERNAL-IP: <pending>` stehen — ohne Fehlermeldung, denn falsch ist daran nichts.|Two objects, and both are needed: the **IPAddressPool** says which addresses exist. The **L2Advertisement** says they should be announced over ARP. Without the second one every service stays at `EXTERNAL-IP: <pending>` — with no error message, because nothing about it is wrong."]
      : ["Im BGP-Modus kommen drei Objekte zusammen: der **IPAddressPool**, die **BGPAdvertisement** und der **BGPPeer**, der dem Router gegenübersteht. Der Router muss die Gegenstelle ebenfalls kennen — diese Hälfte macht MetalLB nicht.|In BGP mode three objects come together: the **IPAddressPool**, the **BGPAdvertisement** and the **BGPPeer** facing the router. The router has to know its counterpart too — MetalLB does not do that half."],
    items:[{c:poolYaml,
      d:o.autoAssign
        ? "autoAssign: true heißt, dass jeder Service vom Typ LoadBalancer eine Adresse aus diesem Pool bekommt, ohne dass man ihn nennen muss.|autoAssign: true means every service of type LoadBalancer gets an address from this pool without having to name it."
        : "autoAssign: false heißt, dass der Pool nur auf ausdrückliche Anfrage vergibt. Services ohne die passende Annotation bleiben pending — das ist gewollt, überrascht aber beim ersten Mal.|autoAssign: false means the pool only hands out on explicit request. Services without the matching annotation stay pending — that is intended but surprises you the first time."}]
      .concat(l2 ? [] : [{c:"cat <<'EOF' | kubectl apply -f -\napiVersion: metallb.io/v1beta2\nkind: BGPPeer\nmetadata:\n  name: router\n  namespace: metallb-system\nspec:\n  myASN: " + o.myAsn + "\n  peerASN: " + o.peerAsn + "\n  peerAddress: " + o.peer + "\nEOF\n\nkubectl -n metallb-system logs -l app=metallb,component=speaker | grep -i bgp",
        d:"Die Gegenstelle. In den Logs des Speakers steht danach, ob die Sitzung zustande kommt — solange dort established fehlt, kündigt niemand etwas an.|The counterpart. The speaker's logs then say whether the session comes up — as long as established is missing there, nobody announces anything."}]),
    r:l2
      ? [{lvl:"warn", m:t("Im L2-Modus hält immer genau ein Knoten die Adresse und beantwortet alle Anfragen. Das ist Ausfallsicherung, keine Lastverteilung: Der gesamte Verkehr für diese Adresse läuft über einen Knoten, auch bei zehn Knoten im Cluster.|In L2 mode exactly one node holds the address and answers all requests. That is failover, not load balancing: all traffic for that address goes through one node, even with ten nodes in the cluster.")}]
      : [{lvl:"warn", m:t("BGP braucht einen Router, der mitspielt. Eine gewöhnliche Fritzbox tut das nicht — dafür braucht es OPNsense, pfSense, Mikrotik oder Vergleichbares. Im Zweifel ist L2 die Betriebsart, die einfach funktioniert.|BGP needs a router that plays along. An ordinary home router does not — that calls for OPNsense, pfSense, Mikrotik or similar. When in doubt, L2 is the mode that simply works.")}]
  });

  /* --- 5. feste Adresse --- */
  sec("Eine feste Adresse vergeben|Pinning a fixed address", "admin", {
    p:["Ohne weitere Angabe nimmt MetalLB die nächste freie Adresse aus dem Pool. Für etwas, worauf ein DNS-Eintrag zeigt, will man das nicht dem Zufall überlassen — die Annotation `metallb.io/loadBalancerIPs` legt sie fest.|Without further instruction MetalLB takes the next free address from the pool. For something a DNS record points at you do not want that left to chance — the annotation `metallb.io/loadBalancerIPs` pins it.",
       "Das alte Feld `spec.loadBalancerIP` im Service tut dasselbe, ist in Kubernetes aber als veraltet markiert. Neue Manifeste benutzen die Annotation.|The old `spec.loadBalancerIP` field in the service does the same but is marked deprecated in Kubernetes. New manifests use the annotation."],
    items:[
      {c:"cat <<'EOF' | kubectl apply -f -\napiVersion: v1\nkind: Service\nmetadata:\n  name: web\n  annotations:\n    metallb.io/loadBalancerIPs: " + ip + (o.autoAssign ? "" : "\n    metallb.io/address-pool: haupt") + "\nspec:\n  type: LoadBalancer\n  selector:\n    app: web\n  ports:\n    - name: http\n      port: 80\n      targetPort: http\nEOF",
       d:o.autoAssign
         ? "Die Adresse muss innerhalb des Pools liegen, sonst bleibt der Service pending.|The address has to lie inside the pool, otherwise the service stays pending."
         : "Beide Annotationen sind nötig: die eine wählt den Pool, die andere die Adresse darin.|Both annotations are needed: one picks the pool, the other the address within it."},
      {c:"kubectl get svc -A -o wide | grep LoadBalancer",
       d:"Die Übersicht über alles, was gerade eine Adresse von außen hält. Bei einem kleinen Bereich lohnt sich der Blick regelmäßig.|The overview of everything currently holding an outside address. With a small range it is worth looking regularly."}
    ]
  });

  /* --- 6. Ingress --- */
  if (o.ingress){
    sec("Den Ingress-Controller darauf setzen|Pointing the ingress controller at it", "admin", {
      p:["Damit schließt sich der Kreis: **Eine** Adresse von außen, dahinter der Ingress-Controller, der anhand des Host-Namens verteilt. Jede weitere Anwendung braucht dann nur noch eine Ingress-Regel und keine eigene Adresse mehr.|That closes the circle: **one** address from outside, behind it the ingress controller distributing by host name. Every further application then needs only an ingress rule, no address of its own.",
         "Genau dafür lohnt sich ein kleiner Bereich — im Grunde reicht eine einzige Adresse, solange alles über HTTP und HTTPS läuft.|That is exactly why a small range pays off — one single address is enough as long as everything runs over HTTP and HTTPS."],
      items:[
        {c:"kubectl -n ingress-nginx annotate service ingress-nginx-controller \\\n  metallb.io/loadBalancerIPs=" + ip + " --overwrite" + (o.autoAssign ? "" : " \\\n  metallb.io/address-pool=haupt"),
         d:"Wirkt sofort, ohne Neustart. Ein bereits vergebener Wert wird durch --overwrite ersetzt.|Takes effect immediately, no restart. An existing value is replaced by --overwrite."},
        {c:"kubectl -n ingress-nginx get svc ingress-nginx-controller",
         d:"In der Spalte EXTERNAL-IP muss die gewünschte Adresse stehen. Bleibt dort pending, ist der Pool nicht erreichbar oder die Adresse liegt außerhalb.|The EXTERNAL-IP column has to show the wanted address. If it stays pending, the pool is unreachable or the address lies outside it."}
      ]
    });
  }

  /* --- 7. Testen --- */
  sec("Prüfen, ob die Adresse wirklich antwortet|Checking that the address really answers", "admin", {
    p:["Der Test gehört auf einen Rechner, der **nicht** im Cluster ist. Von einem Knoten aus antwortet die Adresse auch dann, wenn die Ankündigung nach außen gar nicht funktioniert — der Weg dorthin führt über die interne Weiterleitung.|The test belongs on a machine that is **not** in the cluster. From a node the address answers even when the outside announcement does not work at all — the route there goes through internal forwarding."],
    items:[
      {c:"kubectl get svc -A | grep " + ip + "\nkubectl -n metallb-system logs -l component=speaker --tail=20 | grep -i " + ip,
       d:"Erst die Zuweisung, dann die Ankündigung. Im Log des Speakers steht, welcher Knoten die Adresse übernommen hat.|First the assignment, then the announcement. The speaker's log says which node took over the address."},
      {c:"# vom Arbeitsplatz, nicht von einem Knoten:\nping -c2 " + ip + "\ncurl -sI http://" + ip + "/\narping -c2 " + ip + "   # zeigt die MAC — sie gehört einem der Knoten",
       d:"Antwortet ping, aber curl nicht, stimmt der Port oder der Service dahinter nicht. Antwortet gar nichts, kommt die ARP-Ankündigung nicht durch — anderes VLAN, WLAN dazwischen, oder ein Switch mit Port-Sicherheit.|If ping answers but curl does not, the port or the service behind it is wrong. If nothing answers, the ARP announcement is not getting through — a different VLAN, WiFi in between, or a switch with port security."},
      {c:"kubectl cordon KNOTEN-DER-DIE-ADRESSE-HAELT\nsleep 5 && ping -c3 " + ip + "\nkubectl uncordon KNOTEN-DER-DIE-ADRESSE-HAELT",
       d:"Die Probe auf die Ausfallsicherung: Ein anderer Knoten muss die Adresse übernehmen. Ein paar verlorene Pakete dabei sind normal, der Umzug dauert Sekunden.|The failover test: another node has to take over the address. A few lost packets are normal, the move takes seconds."}
    ]
  });

  /* --- 8. Fehlerbilder --- */
  sec("Wenn es nicht geht|When it does not work", "admin", {
    table:[["Bild|Symptom","Meist die Ursache|Usually the cause"],
      ["EXTERNAL-IP bleibt pending|EXTERNAL-IP stays pending","Kein IPAddressPool, keine Advertisement, oder autoAssign steht auf false und der Service nennt den Pool nicht.|No IPAddressPool, no advertisement, or autoAssign is false and the service does not name the pool."],
      ["Adresse vergeben, antwortet aber nicht|Address assigned but silent","Die Ankündigung kommt nicht durch: anderes Segment, WLAN dazwischen, oder im IPVS-Modus fehlt strictARP.|The announcement is not getting through: different segment, WiFi in between, or strictARP is missing in IPVS mode."],
      ["Antwortet nur von einem Knoten|Only one node answers","Kein Fehler. Im L2-Modus ist das die Bauart — ein Knoten hält die Adresse.|Not a fault. In L2 mode that is by design — one node holds the address."],
      ["Speaker startet nicht|Speaker does not start","Der Namespace metallb-system braucht die Stufe privileged. Eine clusterweite Regel, die restricted erzwingt, hält ihn auf.|The metallb-system namespace needs the privileged level. A cluster-wide rule enforcing restricted stops it."],
      ["Adresse doppelt im Netz|Address duplicated on the network","Der Bereich überschneidet sich mit dem DHCP-Bereich des Routers.|The range overlaps the router's DHCP range."],
      ["Webhook denied|Webhook denied","Die Konfiguration wurde angewendet, bevor der Controller lief. Kurz warten und erneut anwenden.|The configuration was applied before the controller was running. Wait a moment and apply again."]],
    items:[
      {c:"kubectl -n metallb-system get pods -o wide\nkubectl -n metallb-system logs -l component=controller --tail=50\nkubectl describe svc SERVICE | tail -20",
       d:"Die drei Blicke in dieser Reihenfolge. Die Events unter describe nennen den Grund meistens im Klartext.|The three looks in that order. The events under describe usually name the reason in plain words."}
    ]
  });

  /* --- 9. Einordnung --- */
  sec("Was MetalLB ist und was nicht|What MetalLB is and is not", "admin", {
    p:["MetalLB füllt genau eine Lücke: In der Cloud beantwortet der Anbieter einen Service vom Typ LoadBalancer mit einer echten Adresse. Im eigenen Rechenzentrum beantwortet ihn niemand, und der Service bleibt für immer pending. MetalLB ist die Antwort auf diese Frage — nicht mehr und nicht weniger.|MetalLB fills exactly one gap: in the cloud the provider answers a service of type LoadBalancer with a real address. In your own data centre nobody answers, and the service stays pending forever. MetalLB is the answer to that question — no more and no less."],
    table:[["Es leistet|It does","Es leistet nicht|It does not"],
      ["Adressen aus dem eigenen Netz vergeben|Hand out addresses from your own network","TLS beenden, Namen unterscheiden, Pfade verteilen — das ist der Ingress-Controller.|Terminate TLS, distinguish names, route paths — that is the ingress controller."],
      ["Bei Knotenausfall die Adresse umziehen|Move the address on node failure","Den Verkehr im L2-Modus auf mehrere Knoten verteilen.|Spread traffic across several nodes in L2 mode."],
      ["Im BGP-Modus mehrere Wege ankündigen|Announce several paths in BGP mode","Einen Router ersetzen, der BGP nicht kann.|Replace a router that cannot do BGP."],
      ["Auch UDP und beliebige Ports|UDP and arbitrary ports too","Etwas gegen einen ausgefallenen Uplink.|Anything about a failed uplink."]],
    p2:["Die übliche und meist beste Aufteilung: **eine** Adresse für den Ingress-Controller, und alles Weitere läuft über Host-Namen darauf. Eigene LoadBalancer-Adressen lohnen sich nur für das, was kein HTTP spricht — eine Datenbank nach außen, ein Spieleserver, ein Syslog-Empfänger.|The usual and mostly best split: **one** address for the ingress controller, and everything else runs over host names on it. Separate LoadBalancer addresses only pay off for what does not speak HTTP — a database exposed outward, a game server, a syslog receiver."]
  });

  return out;
}

let CLUSTER = {};
let TENANT = {};
let METALLB = {autoAssign:true};
let CLUSTER_MODE = "install";

const CLUSTER_ROLE = {
  all:  "auf allen Knoten|on every node",
  cp:   "nur Hauptserver|control plane only",
  worker:"nur Worker|workers only",
  neu:  "nur der neue Knoten|the new node only",
  admin:"als Cluster-Verwalter|as the cluster admin",
  user: "beim Benutzer|on the user's machine"
};

/* Der Assistent hat zwei Modi: Cluster aufsetzen und Benutzer einrichten.
   Beide liefern dieselbe Abschnittsform, also teilen sie Darstellung und Export. */
const CLUSTER_MODES = {
  install: {fields:() => CLUSTER_FIELDS, state:() => CLUSTER, guide:() => clusterGuide(CLUSTER),
            file:"cluster-installation.md", yml:"cluster-installation.yml",
            tar:"cluster-installation-ansible.tar"},
  tenant:  {fields:() => TENANT_FIELDS,  state:() => TENANT,  guide:() => tenantGuide(TENANT),
            file:"benutzer-namespace.md", yml:"benutzer-namespace.yml",
            tar:"benutzer-namespace-ansible.tar"},
  metallb: {fields:() => METALLB_FIELDS, state:() => METALLB, guide:() => metallbGuide(METALLB),
            file:"metallb.md", yml:"metallb.yml",
            tar:"metallb-ansible.tar"}
};
function clusterModeOf(){ return CLUSTER_MODES[CLUSTER_MODE] || CLUSTER_MODES.install; }
function clusterFieldsOf(){ return clusterModeOf().fields(); }
function clusterStateOf(){ return clusterModeOf().state(); }
function clusterGuideOf(){ return clusterModeOf().guide(); }

function renderClusterFields(){
  let h = "";
  const state = clusterStateOf();
  /* when blendet Felder aus, die zur getroffenen Auswahl nicht passen. */
  clusterFieldsOf().filter(f => (!SHORT || !f.adv) && (!f.when || f.when(state))).forEach(f => {
    const v = state[f.k] === undefined ? "" : state[f.k];
    const cls = f.half ? "f f--in" : "f";
    /* Hinweise duerfen hier **fett** und `code` enthalten wie der Text daneben. */
    const hint = f.hint ? '<span class="hint">' + mdInline(t(f.hint)) + "</span>" : "";
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
      /* Zwei Platzhalter haengen an anderen Feldern und muessen mitziehen. */
      const ph = f.k === "podCidr" ? CNI_CIDR[CLUSTER.cni || "cilium"]
               : f.k === "ns" ? "team-" + ((TENANT.user || "").trim() || "anna")
               : (f.ph ? t(f.ph) : "");
      h += '<div class="' + cls + '"><label>' + esc(t(f.l)) + '</label><input type="' +
        (f.t === "number" ? "number" : "text") + '" data-cl="' + f.k + '" value="' + esc(v) +
        '" placeholder="' + esc(ph) + '">' + hint + "</div>";
    }
  });
  $("clusterFields").innerHTML = h;
}

function renderClusterOut(){
  let h = "";
  clusterGuideOf().forEach((s, i) => {
    h += '<div class="cstep"><p class="hgroup">' + String(i+1).padStart(2,"0") + " · " + esc(t(s.h)) +
         '<span class="crole crole--' + s.role + '">' + esc(t(CLUSTER_ROLE[s.role])) + "</span></p>";
    (s.p||[]).forEach(x => { h += "<p>" + mdInline(t(x)) + "</p>"; });
    if (s.table){
      const rows = s.table;
      h += '<div class="swtwrap"><table class="swtable"><thead><tr>' +
           rows[0].map(c => "<th>" + mdInline(t(c)) + "</th>").join("") + "</tr></thead><tbody>" +
           rows.slice(1).map(r => "<tr>" + r.map((c, n) =>
             "<td" + (n === 0 ? ' class="swkey"' : "") + ">" + mdInline(t(c)) + "</td>").join("") + "</tr>").join("") +
           "</tbody></table></div>";
    }
    (s.p2||[]).forEach(x => { h += "<p>" + mdInline(t(x)) + "</p>"; });
    if ((s.r||[]).length)
      h += '<div class="crisks">' + s.r.map(x =>
        '<p class="crisk crisk--' + x.lvl + '"><b>' + (x.lvl === "err" ? "!" : "?") + "</b>" + esc(x.m) + "</p>").join("") + "</div>";
    h += '<div class="wikiitems">' + (s.items||[]).map(it =>
      '<div class="wikiitem"><button class="cmd cmd--big" data-cmd="' + esc(it.c) + '"><span>' +
      esc(it.c) + "</span></button><p>" + mdInline(t(it.d)) + "</p></div>").join("") + "</div></div>";
  });
  $("clusterOut").innerHTML = h;
}

/* ---------- Ansible-Export ----------
   Die Rollenmarke jedes Abschnitts sagt schon, auf welchen Maschinen er laufen
   muss — daraus wird je Rolle ein eigenes Play. */
const ROLE_HOSTS = {
  all:   "k8s_all",
  cp:    "k8s_control_plane",
  worker:"k8s_workers",
  neu:   "k8s_new_node",
  admin: "localhost",
  user:  "localhost"
};

/* Befehle, die nur lesen, duerfen Ansible nicht als Aenderung melden. */
const NUR_LESEN = /^(kubectl (get|describe|logs|auth|top|api-resources|config (view|get-contexts|current-context))|openssl (x509|req) |curl |ip -4 |ip -o |getent |ls -l|zpool (status|list)|zfs list|showmount |systemctl status|cat \/proc|grep |awk |helm (list|repo list)|velero backup describe|kubeadm token list|kubeadm version|kubelet --version|exportfs -v|arping|ping |echo )/;

function nurLesend(cmd){
  const zeilen = cmd.split("\n").map(z => z.trim()).filter(z => z && z.charAt(0) !== "#");
  return zeilen.length > 0 && zeilen.every(z => NUR_LESEN.test(z));
}

function ynString(s){
  return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

function einruecken(text, n){
  const pad = new Array(n + 1).join(" ");
  return text.split("\n").map(z => z.length ? pad + z : "").join("\n");
}

/* Ein Befehl der Form  cat <<'EOF' | kubectl apply -f -  …  EOF  wird zu einer
   oder mehreren k8s-Aufgaben — damit ist der Schritt wiederholbar statt blind. */
function manifesteAus(cmd){
  const zeilen = cmd.split("\n");
  if (!/^cat <<'?EOF'? \| kubectl apply -f -\s*$/.test(zeilen[0])) return null;
  const ende = zeilen.lastIndexOf("EOF");
  if (ende < 1) return null;
  /* Steht hinter dem Heredoc noch etwas, ist es kein reines Manifest. */
  if (zeilen.slice(ende + 1).some(z => z.trim())) return null;
  const roh = zeilen.slice(1, ende).join("\n");
  if (roh.indexOf("$") !== -1) return null;      /* Shell-Ersetzung: muss Shell bleiben */
  return roh.split(/\n---\n/).map(x => x.trim()).filter(Boolean);
}

function ansibleAufgabe(name, cmd){
  const docs = manifesteAus(cmd);
  if (docs){
    return docs.map((doc, i) => {
      const titel = docs.length > 1 ? name + " (" + (i + 1) + "/" + docs.length + ")" : name;
      return "    - name: " + ynString(titel) + "\n" +
             "      kubernetes.core.k8s:\n" +
             "        state: present\n" +
             "        definition:\n" + einruecken(doc, 10);
    }).join("\n\n");
  }
  return "    - name: " + ynString(name) + "\n" +
         "      ansible.builtin.shell: |\n" + einruecken(cmd, 8) + "\n" +
         "      args:\n        executable: /bin/bash\n" +
         (nurLesend(cmd) ? "      changed_when: false" : "").replace(/\n$/, "");
}

function ansibleKopf(){
  const de = LANG === "de";
  const titel = t(CLUSTER_TAB_LABEL[CLUSTER_MODE] || CLUSTER_TAB_LABEL.install);
  let h = "# " + (de ? "Erzeugt mit dem k8s-wizard" : "Generated with the k8s wizard") + " — " + titel + "\n#\n";
  h += de
    ? "# YAML-Manifeste laufen über kubernetes.core.k8s und sind damit wiederholbar.\n" +
      "# Alles andere steht als shell-Aufgabe genau so da, wie es im Terminal stünde —\n" +
      "# samt sudo, damit die Zeilen auch ohne become stimmen. Lesende Befehle sind\n" +
      "# mit changed_when: false versehen.\n#\n" +
      "# Vor dem ersten Lauf:\n" +
      "#   ansible-galaxy collection install kubernetes.core\n" +
      "#   pip install kubernetes\n#\n" +
      "# Platzhalter in Großbuchstaben — <TOKEN>, NODE-1, HIER-DAS-KENNWORT — sind\n" +
      "# vor dem Lauf zu ersetzen. Erst mit --check und --diff probieren.\n"
    : "# YAML manifests run through kubernetes.core.k8s and are therefore repeatable.\n" +
      "# Everything else appears as a shell task exactly as it would in the terminal —\n" +
      "# sudo included, so the lines are right without become. Read-only commands carry\n" +
      "# changed_when: false.\n#\n" +
      "# Before the first run:\n" +
      "#   ansible-galaxy collection install kubernetes.core\n" +
      "#   pip install kubernetes\n#\n" +
      "# Placeholders in capitals — <TOKEN>, NODE-1, HIER-DAS-KENNWORT — have to be\n" +
      "# replaced before running. Try it with --check and --diff first.\n";
  h += "#\n# " + (de ? "Inventar, Beispiel" : "Inventory, example") + ":\n" +
       "#   [k8s_control_plane]\n#   k8s-cp1\n#\n#   [k8s_workers]\n#   k8s-w1\n#   k8s-w2\n#\n" +
       "#   [k8s_all:children]\n#   k8s_control_plane\n#   k8s_workers\n";
  return h + "\n";
}

/* Dateinamen bleiben englisch, egal in welcher Sprache die Oberflaeche steht —
   sie landen in einem Repository und sollen dort stabil heissen. */
const ROLE_SLUG = {
  all:"all-nodes", cp:"control-plane", worker:"workers",
  neu:"new-node", admin:"admin", user:"user"
};

/* Ein Eintrag je zusammenhaengendem Rollenblock, in der Reihenfolge der Anleitung. */
function ansiblePlays(){
  const de = LANG === "de";
  const teile = [];
  let letzteRolle = null, letzterBack = null, akt = null;
  /* Abschnitte ohne Befehle sind reine Erläuterung und haben im Playbook nichts verloren. */
  clusterGuideOf().filter(s => (s.items || []).length).forEach((s, i) => {
    const back = !!s.back;
    /* Der Rückbau bekommt ein eigenes Play — sonst legt site.yml alles an
       und löscht es in derselben Runde wieder. */
    if (s.role !== letzteRolle || back !== letzterBack){
      const host = ROLE_HOSTS[s.role] || "localhost";
      akt = {rolle:s.role, host:host, back:back,
             slug:back ? "teardown" : (ROLE_SLUG[s.role] || "tasks"),
             nr:teile.length + 1, titel:t(CLUSTER_ROLE[s.role]), abschnitte:[], text:""};
      teile.push(akt);
      letzteRolle = s.role; letzterBack = back;
      akt.text = "- name: " + ynString((de ? "Teil " : "Part ") + akt.nr + " · " +
                   (back ? (de ? "Rückbau — " : "Teardown — ") : "") + akt.titel) + "\n" +
                 "  hosts: " + host + "\n" +
                 (host === "localhost" ? "  connection: local\n  gather_facts: false\n" : "  gather_facts: true\n") +
                 "  tasks:\n";
    }
    akt.abschnitte.push(t(s.h));
    /* Die Hinweise des Assistenten gehen als Kommentar mit — sie sind der Grund,
       warum ein Schritt so aussieht, wie er aussieht. */
    akt.text += "\n    # " + String(i + 1).padStart(2, "0") + " · " + t(s.h) + "\n";
    (s.r || []).forEach(x => {
      akt.text += "    # " + (x.lvl === "err" ? (de ? "ACHTUNG" : "WARNING") : (de ? "Hinweis" : "Note")) +
                  ": " + x.m.replace(/\*\*/g, "").replace(/\n/g, " ") + "\n";
    });
    (s.items || []).forEach((it, n) => {
      akt.text += ansibleAufgabe(t(s.h) + " · " + (n + 1), it.c) + "\n";
    });
  });
  return teile;
}

/* Alles in einer Datei — bleibt fuer den Blick zwischendurch. */
function ansibleExport(){
  return ansibleKopf() + "---\n" + ansiblePlays().map(x => x.text).join("\n");
}

/* ---------- Mehrere Benutzer auf einmal ----------
   Der gewöhnliche Export bildet die Anleitung eins zu eins ab: ein Benutzer,
   feste Werte. Für mehrere gibt es stattdessen Playbooks, die über eine Liste
   laufen — die Werte stehen dann an einer Stelle und nicht im Befehlstext. */
function tenantBatchBundle(){
  const o = tenantOpts(TENANT);
  const de = LANG === "de";
  const cert = o.identity === "cert";
  const oidc = o.identity === "oidc";
  const dateien = [];
  const teile = [];

  /* Der Name, unter dem der API-Server den Benutzer kennt — je Anmeldeart anders. */
  const subjekt = oidc
    ? '          - kind: User\n            name: "oidc:{{ item.email }}"\n            apiGroup: rbac.authorization.k8s.io'
    : cert
    ? '          - kind: User\n            name: "{{ item.user }}"\n            apiGroup: rbac.authorization.k8s.io'
    : '          - kind: ServiceAccount\n            name: "{{ item.user }}"\n            namespace: "{{ item.ns }}"';
  const alsWer = oidc ? '"oidc:{{ item.email }}"'
               : cert ? '"{{ item.user }}"'
               : '"system:serviceaccount:{{ item.ns }}:{{ item.user }}"';

  const kopf = (nr, titel, host, datei) =>
    "# " + (de ? "Teil " : "Part ") + nr + ": " + titel + "\n" +
    "# " + (de ? "einzeln" : "on its own") + ": ansible-playbook -i inventory.ini " + datei + "\n---\n" +
    "- name: " + ynString((de ? "Teil " : "Part ") + nr + " · " + titel) + "\n" +
    "  hosts: " + host + "\n" +
    (host === "localhost" ? "  connection: local\n  gather_facts: false\n" : "  gather_facts: true\n") +
    "  tasks:\n";

  const nimm = (titel, host, text, slug, back) => {
    const nr = teile.length + 1;
    const datei = String(nr).padStart(2, "0") + "-" + slug + ".yml";
    teile.push({datei:datei, host:host, titel:titel, back:!!back});
    dateien.push({name:datei, text:kopf(nr, titel, host, datei) + text});
  };

  const schleife = (label) =>
    '      loop: "{{ teams }}"\n      loop_control:\n        label: "{{ item.' + (label || "ns") + ' }}"\n';

  /* ---- Werteliste ---- */
  const eintrag = (u, ns, lvl, pss, cpu, mem, pods, mail) =>
    "  - user: " + u + "\n    ns: " + ns + "\n    level: " + lvl + "\n    pss: " + pss + "\n" +
    (oidc ? "    email: " + mail + "\n" : "") +
    "    cpu: \"" + cpu + "\"\n    mem: \"" + mem + "\"\n    pods: " + pods + "\n" +
    (o.linux ? "    ssh_key: \"ssh-ed25519 AAAA...ERSETZEN " + u + "\"\n" : "");

  dateien.push({name:"group_vars/all.yml", text:
    "# " + (de ? "Die einzige Datei, die du je Benutzer anfasst." : "The only file you touch per user.") + "\n" +
    "# " + (de ? "Alle Playbooks lesen ausschließlich diese Liste." : "Every playbook reads only this list.") + "\n" +
    "---\n" +
    "k8s_api: \"" + o.api + "\"\n" +
    "cert_expiration_seconds: " + (o.days * 86400) + "\n" +
    "arbeitsverzeichnis: out\n\n" +
    "teams:\n" +
    eintrag(o.user, o.ns, TENANT_ROLE[o.level], o.pss, o.cpu, o.mem, o.pods, o.email) + "\n" +
    "# " + (de ? "weitere nach demselben Muster:" : "further ones follow the same shape:") + "\n" +
    eintrag("mkl", "team-mkl", "view", o.pss, "2", "4Gi", 10, "mkl@" + domainOf(o.api))
      .split("\n").map(z => z ? "# " + z : "").join("\n")});

  /* ---- 1. Namespaces und Grenzen ---- */
  let ns = '    - name: "Namespace mit Sicherheitsstufe"\n' +
    "      kubernetes.core.k8s:\n        state: present\n        definition:\n" +
    "          apiVersion: v1\n          kind: Namespace\n          metadata:\n" +
    '            name: "{{ item.ns }}"\n            labels:\n' +
    '              kubernetes.io/metadata.name: "{{ item.ns }}"\n' +
    '              pod-security.kubernetes.io/enforce: "{{ item.pss }}"\n' +
    '              pod-security.kubernetes.io/warn: "{{ item.pss }}"\n' +
    '              pod-security.kubernetes.io/audit: "{{ item.pss }}"\n' + schleife();
  if (o.quota){
    ns += '\n    - name: "ResourceQuota"\n' +
      "      kubernetes.core.k8s:\n        state: present\n        definition:\n" +
      "          apiVersion: v1\n          kind: ResourceQuota\n          metadata:\n" +
      '            name: quota\n            namespace: "{{ item.ns }}"\n          spec:\n            hard:\n' +
      '              requests.cpu: "{{ item.cpu }}"\n              requests.memory: "{{ item.mem }}"\n' +
      '              limits.cpu: "{{ item.cpu }}"\n              limits.memory: "{{ item.mem }}"\n' +
      '              pods: "{{ item.pods }}"\n              persistentvolumeclaims: "10"\n' +
      '              services.loadbalancers: "1"\n' + schleife();
    ns += '\n    # ' + (de ? "Ohne Vorgabewerte lehnt die Quota jeden Pod ohne requests ab."
                           : "Without defaults the quota rejects every pod that has no requests.") + "\n" +
      '    - name: "LimitRange"\n' +
      "      kubernetes.core.k8s:\n        state: present\n        definition:\n" +
      "          apiVersion: v1\n          kind: LimitRange\n          metadata:\n" +
      '            name: vorgaben\n            namespace: "{{ item.ns }}"\n          spec:\n            limits:\n' +
      "              - type: Container\n                default:\n                  cpu: 200m\n                  memory: 256Mi\n" +
      "                defaultRequest:\n                  cpu: 50m\n                  memory: 64Mi\n" +
      '                max:\n                  cpu: "2"\n                  memory: 2Gi\n' + schleife();
  }
  if (o.netpol){
    ns += '\n    - name: "NetworkPolicy: alles verbieten"\n' +
      "      kubernetes.core.k8s:\n        state: present\n        definition:\n" +
      "          apiVersion: networking.k8s.io/v1\n          kind: NetworkPolicy\n          metadata:\n" +
      '            name: default-deny\n            namespace: "{{ item.ns }}"\n          spec:\n' +
      "            podSelector: {}\n            policyTypes:\n              - Ingress\n              - Egress\n" + schleife();
    ns += '\n    - name: "NetworkPolicy: intern und DNS erlauben"\n' +
      "      kubernetes.core.k8s:\n        state: present\n        definition:\n" +
      "          apiVersion: networking.k8s.io/v1\n          kind: NetworkPolicy\n          metadata:\n" +
      '            name: erlaubt-intern-und-dns\n            namespace: "{{ item.ns }}"\n          spec:\n' +
      "            podSelector: {}\n            policyTypes:\n              - Ingress\n              - Egress\n" +
      "            ingress:\n              - from:\n                  - podSelector: {}\n" +
      "            egress:\n              - to:\n                  - podSelector: {}\n" +
      "              - to:\n                  - namespaceSelector:\n                      matchLabels:\n" +
      "                        kubernetes.io/metadata.name: kube-system\n" +
      "                ports:\n                  - protocol: UDP\n                    port: 53\n" +
      "                  - protocol: TCP\n                    port: 53\n" + schleife();
  }
  if (o.pin){
    ns += '\n    # ' + (de ? "Wirkt nur mit dem Admission-Plugin PodNodeSelector im API-Server."
                           : "Only takes effect with the PodNodeSelector admission plugin in the API server.") + "\n" +
      '    - name: "Namespace an Nodes binden"\n' +
      "      kubernetes.core.k8s:\n        state: present\n        definition:\n" +
      "          apiVersion: v1\n          kind: Namespace\n          metadata:\n" +
      '            name: "{{ item.ns }}"\n            annotations:\n' +
      '              scheduler.alpha.kubernetes.io/node-selector: "' + o.pool + '"\n' + schleife();
  }
  nimm(de ? "Namespaces" : "Namespaces", "localhost", ns, "namespaces");

  /* ---- 2. Rechte ---- */
  nimm(de ? "Rechte" : "Rights", "localhost",
    '    # ' + (de ? "RoleBinding auf eine ClusterRole: die Regeln gelten nur in diesem Namespace."
                   : "A RoleBinding onto a ClusterRole: the rules apply only in this namespace.") + "\n" +
    '    - name: "RoleBinding je Team"\n' +
    "      kubernetes.core.k8s:\n        state: present\n        definition:\n" +
    "          apiVersion: rbac.authorization.k8s.io/v1\n          kind: RoleBinding\n          metadata:\n" +
    '            name: "{{ item.user }}-{{ item.level }}"\n            namespace: "{{ item.ns }}"\n' +
    "          roleRef:\n            kind: ClusterRole\n" +
    '            name: "{{ item.level }}"\n            apiGroup: rbac.authorization.k8s.io\n' +
    "          subjects:\n" + subjekt + "\n" + schleife("user"),
    "rbac");

  /* ---- 3. Identität ---- */
  if (cert){
    nimm(de ? "Zertifikate" : "Certificates", "localhost",
      '    - name: "Arbeitsverzeichnis"\n' +
      "      ansible.builtin.file:\n" +
      '        path: "{{ arbeitsverzeichnis }}"\n        state: directory\n        mode: "0700"\n\n' +
      '    - name: "Privater Schlüssel je Benutzer"\n' +
      "      community.crypto.openssl_privatekey:\n" +
      '        path: "{{ arbeitsverzeichnis }}/{{ item.user }}.key"\n        size: 4096\n        mode: "0600"\n' + schleife("user") +
      '\n    # ' + (de ? "CN wird zum Benutzernamen, O zur Gruppe." : "CN becomes the user name, O the group.") + "\n" +
      '    - name: "Zertifikatsanfrage je Benutzer"\n' +
      "      community.crypto.openssl_csr:\n" +
      '        path: "{{ arbeitsverzeichnis }}/{{ item.user }}.csr"\n' +
      '        privatekey_path: "{{ arbeitsverzeichnis }}/{{ item.user }}.key"\n' +
      '        common_name: "{{ item.user }}"\n        organization_name: "{{ item.ns }}"\n' +
      '        mode: "0644"\n' + schleife("user") +
      '\n    - name: "Anfrage im Cluster einreichen"\n' +
      "      kubernetes.core.k8s:\n        state: present\n        definition:\n" +
      "          apiVersion: certificates.k8s.io/v1\n          kind: CertificateSigningRequest\n" +
      '          metadata:\n            name: "{{ item.user }}"\n          spec:\n' +
      "            request: \"{{ lookup('file', arbeitsverzeichnis + '/' + item.user + '.csr') | b64encode }}\"\n" +
      "            signerName: kubernetes.io/kube-apiserver-client\n" +
      "            expirationSeconds: " + (o.days * 86400) + "\n" +
      "            usages:\n              - client auth\n" + schleife("user") +
      '\n    - name: "Anfrage freigeben"\n' +
      '      ansible.builtin.command: "kubectl certificate approve {{ item.user }}"\n' +
      "      changed_when: true\n" + schleife("user") +
      '\n    - name: "Auf die Unterschrift warten"\n' +
      "      kubernetes.core.k8s_info:\n" +
      "        api_version: certificates.k8s.io/v1\n        kind: CertificateSigningRequest\n" +
      '        name: "{{ item.user }}"\n' +
      "      register: csr_stand\n" +
      "      until: csr_stand.resources[0].status.certificate is defined\n" +
      "      retries: 10\n      delay: 2\n" + schleife("user") +
      '\n    - name: "Zertifikat ablegen"\n' +
      "      ansible.builtin.copy:\n" +
      '        content: "{{ item.resources[0].status.certificate | b64decode }}"\n' +
      '        dest: "{{ arbeitsverzeichnis }}/{{ item.item.user }}.crt"\n        mode: "0644"\n' +
      '      loop: "{{ csr_stand.results }}"\n' +
      '      loop_control:\n        label: "{{ item.item.user }}"\n',
      "certificates");
  } else if (!oidc){
    nimm(de ? "ServiceAccounts" : "Service accounts", "localhost",
      '    - name: "ServiceAccount je Team"\n' +
      "      kubernetes.core.k8s:\n        state: present\n        definition:\n" +
      "          apiVersion: v1\n          kind: ServiceAccount\n          metadata:\n" +
      '            name: "{{ item.user }}"\n            namespace: "{{ item.ns }}"\n' + schleife("user") +
      '\n    - name: "Token erzeugen"\n' +
      '      ansible.builtin.command: >-\n        kubectl create token {{ item.user }} -n {{ item.ns }}\n' +
      "        --duration=" + (o.days * 24) + "h\n" +
      "      register: sa_token\n      changed_when: true\n" + schleife("user"),
      "serviceaccounts");
  }

  /* ---- 4. kubeconfig ---- */
  if (!oidc){
    dateien.push({name:"templates/kubeconfig.j2", text:
      "apiVersion: v1\nkind: Config\nclusters:\n  - name: cluster\n    cluster:\n" +
      "      server: https://{{ k8s_api }}\n      certificate-authority-data: {{ cluster_ca.stdout }}\n" +
      "users:\n  - name: {{ item.user }}\n    user:\n" +
      (cert
        ? "      client-certificate-data: {{ lookup('file', arbeitsverzeichnis + '/' + item.user + '.crt') | b64encode }}\n" +
          "      client-key-data: {{ lookup('file', arbeitsverzeichnis + '/' + item.user + '.key') | b64encode }}\n"
        : "      token: {{ (sa_token.results | selectattr('item.user', 'equalto', item.user) | first).stdout }}\n") +
      "contexts:\n  - name: {{ item.user }}\n    context:\n      cluster: cluster\n" +
      "      user: {{ item.user }}\n      namespace: {{ item.ns }}\n" +
      "current-context: {{ item.user }}\n"});

    nimm(de ? "kubeconfigs" : "kubeconfigs", "localhost",
      '    # ' + (de ? "Die CA aus der eigenen kubeconfig — funktioniert bei kubeadm, k3s und verwaltet."
                     : "The CA from your own kubeconfig — works with kubeadm, k3s and managed.") + "\n" +
      '    - name: "CA des Clusters lesen"\n' +
      "      ansible.builtin.command: >-\n" +
      "        kubectl config view --raw --minify\n" +
      "        -o jsonpath={.clusters[0].cluster.certificate-authority-data}\n" +
      "      register: cluster_ca\n      changed_when: false\n" +
      '\n    - name: "kubeconfig je Benutzer schreiben"\n' +
      "      ansible.builtin.template:\n        src: templates/kubeconfig.j2\n" +
      '        dest: "{{ arbeitsverzeichnis }}/{{ item.user }}.kubeconfig"\n        mode: "0600"\n' + schleife("user"),
      "kubeconfigs");
  }

  /* ---- 5. Linux-Konten ---- */
  if (o.linux && !oidc){
    nimm(de ? "Linux-Konten" : "Linux accounts", "k8s_control_plane",
      '    - name: "Konto ohne Kennwort"\n' +
      "      ansible.builtin.user:\n" +
      '        name: "{{ item.user }}"\n        shell: /bin/bash\n        password: "!"\n        create_home: true\n' +
      "      become: true\n" + schleife("user") +
      '\n    - name: "SSH-Schlüssel hinterlegen"\n' +
      "      ansible.posix.authorized_key:\n" +
      '        user: "{{ item.user }}"\n        key: "{{ item.ssh_key }}"\n        exclusive: true\n' +
      "      become: true\n" +
      "      when: item.ssh_key is defined and 'ERSETZEN' not in item.ssh_key\n" + schleife("user") +
      '\n    - name: "Verzeichnis .kube"\n' +
      "      ansible.builtin.file:\n" +
      '        path: "/home/{{ item.user }}/.kube"\n        state: directory\n' +
      '        owner: "{{ item.user }}"\n        group: "{{ item.user }}"\n        mode: "0700"\n' +
      "      become: true\n" + schleife("user") +
      '\n    - name: "kubeconfig ins Heimatverzeichnis"\n' +
      "      ansible.builtin.copy:\n" +
      '        src: "{{ arbeitsverzeichnis }}/{{ item.user }}.kubeconfig"\n' +
      '        dest: "/home/{{ item.user }}/.kube/config"\n' +
      '        owner: "{{ item.user }}"\n        group: "{{ item.user }}"\n        mode: "0600"\n' +
      "      become: true\n" + schleife("user"),
      "linux-users");
  }

  /* ---- 6. Abnahme ---- */
  nimm(de ? "Abnahme" : "Acceptance", "localhost",
    '    # ' + (de ? "Beide Prüfungen lassen das Playbook scheitern, wenn die Grenze nicht hält."
                   : "Both checks fail the playbook if the boundary does not hold.") + "\n" +
    '    - name: "Darf im eigenen Namespace arbeiten"\n' +
    "      ansible.builtin.command: >-\n" +
    "        kubectl auth can-i list pods -n {{ item.ns }} --as=" + alsWer.replace(/"/g, "") + "\n" +
    "      register: darf\n      changed_when: false\n" +
    "      failed_when: darf.stdout is not search('yes')\n" + schleife() +
    '\n    - name: "Darf nicht an kube-system"\n' +
    "      ansible.builtin.command: >-\n" +
    "        kubectl auth can-i get secrets -n kube-system --as=" + alsWer.replace(/"/g, "") + "\n" +
    "      register: darf_nicht\n      changed_when: false\n" +
    "      failed_when: darf_nicht.stdout is not search('no')\n" + schleife() +
    '\n    - name: "Übersicht"\n' +
    "      ansible.builtin.command: \"kubectl get rolebindings -A -o wide\"\n" +
    "      register: uebersicht\n      changed_when: false\n" +
    '\n    - name: "Übersicht ausgeben"\n' +
    "      ansible.builtin.debug:\n        var: uebersicht.stdout_lines\n",
    "verify");

  /* ---- 7. Rückbau ---- */
  nimm(de ? "Rückbau" : "Teardown", "localhost",
    '    # ' + (de ? "Löscht alles, was die Playbooks oben anlegen."
                   : "Deletes everything the playbooks above create.") + "\n" +
    '    - name: "RoleBinding entfernen"\n' +
    "      kubernetes.core.k8s:\n        state: absent\n" +
    "        api_version: rbac.authorization.k8s.io/v1\n        kind: RoleBinding\n" +
    '        name: "{{ item.user }}-{{ item.level }}"\n        namespace: "{{ item.ns }}"\n' + schleife("user") +
    (cert
      ? '\n    - name: "Zertifikatsanfrage entfernen"\n' +
        "      kubernetes.core.k8s:\n        state: absent\n" +
        "        api_version: certificates.k8s.io/v1\n        kind: CertificateSigningRequest\n" +
        '        name: "{{ item.user }}"\n' + schleife("user")
      : "") +
    '\n    # ' + (de ? "ACHTUNG: löscht alles im Namespace, PVCs eingeschlossen."
                     : "WARNING: deletes everything in the namespace, PVCs included.") + "\n" +
    '    - name: "Namespace entfernen"\n' +
    "      kubernetes.core.k8s:\n        state: absent\n        api_version: v1\n        kind: Namespace\n" +
    '        name: "{{ item.ns }}"\n' + schleife(),
    "teardown", true);

  /* ---- site.yml, Inventar, README ---- */
  const aktiv = teile.filter(x => !x.back), rueck = teile.filter(x => x.back);
  dateien.unshift({name:"site.yml", text:
    "# " + (de ? "Benutzer und Namespaces aus group_vars/all.yml anlegen"
               : "Create users and namespaces from group_vars/all.yml") + "\n" +
    "#   ansible-playbook -i inventory.ini site.yml\n" +
    "# " + (de ? "Nur einen Benutzer" : "A single user") + ":\n" +
    "#   ansible-playbook -i inventory.ini site.yml -e 'teams=[{\"user\":\"bge\",\"ns\":\"team-admin\"," +
    "\"level\":\"edit\",\"pss\":\"restricted\",\"cpu\":\"4\",\"mem\":\"8Gi\",\"pods\":20}]'\n" +
    "#\n# " + (de ? "Der Rückbau steht am Ende und ist bewusst auskommentiert."
                 : "The teardown sits at the end and is deliberately commented out.") + "\n---\n" +
    aktiv.map(x => "- import_playbook: " + x.datei + "\n").join("") +
    rueck.map(x => "\n# " + (de ? "Rückbau, löscht was oben entsteht" : "Teardown, deletes what is created above") +
                   ":\n# - import_playbook: " + x.datei + "\n").join("")});

  dateien.push({name:"inventory.ini", text:
    "; " + (de ? "Nur nötig, wenn Linux-Konten angelegt werden." : "Only needed when Linux accounts are created.") + "\n" +
    "[k8s_control_plane]\nk8s-cp1\n\n[k8s_workers]\nk8s-w1\nk8s-w2\n\n[k8s_all:children]\nk8s_control_plane\nk8s_workers\n"});

  dateien.push({name:"README.md", text:
    "# " + (de ? "Benutzer und Namespaces in Serie" : "Users and namespaces in bulk") + "\n\n" +
    (de ? "Alle Playbooks laufen über die Liste `teams` in `group_vars/all.yml`. Um einen weiteren\nBenutzer anzulegen, kommt dort ein Eintrag dazu — an den Playbooks ändert sich nichts.\n"
        : "Every playbook loops over the `teams` list in `group_vars/all.yml`. To add another user you\nadd an entry there — the playbooks stay untouched.\n") + "\n" +
    "```sh\nansible-galaxy collection install kubernetes.core community.crypto ansible.posix\npip install kubernetes\nansible-playbook -i inventory.ini site.yml --check --diff\n```\n\n" +
    "| " + (de ? "Datei" : "File") + " | hosts | " + (de ? "Inhalt" : "Contents") + " |\n|---|---|---|\n" +
    teile.map(x => "| `" + x.datei + "` | `" + x.host + "` | " +
      (x.back ? (de ? "**Rückbau** — " : "**Teardown** — ") : "") + x.titel + " |\n").join("") + "\n" +
    (de
      ? "## Was zu beachten ist\n\n" +
        "- Die Schlüssel und kubeconfigs landen unter `out/`. Das Verzeichnis enthält vollständige\n" +
        "  Zugänge — nach der Übergabe löschen und nicht ins Repository legen.\n" +
        "- `ssh_key` je Eintrag ersetzen. Solange dort ERSETZEN steht, überspringt das Playbook den Schritt.\n" +
        "- Die Abnahme lässt den Lauf **scheitern**, wenn ein Benutzer an `kube-system` kommt.\n" +
        "- Ein zweiter Lauf ändert nichts: Namespaces, Rollen und Schlüssel entstehen nur einmal.\n" +
        (oidc ? "- Bei der Anmeldung per Kennwort fehlt hier die Benutzerliste des Anmeldedienstes.\n" +
                "  Die Einträge in Dex müssen weiterhin von Hand gepflegt werden.\n" : "")
      : "## Things to know\n\n" +
        "- Keys and kubeconfigs land under `out/`. That directory holds complete access — delete it\n" +
        "  after handover and keep it out of the repository.\n" +
        "- Replace `ssh_key` per entry. While it still says ERSETZEN the playbook skips that step.\n" +
        "- The acceptance play **fails** the run if a user can reach `kube-system`.\n" +
        "- A second run changes nothing: namespaces, roles and keys are created once.\n" +
        (oidc ? "- With password sign-in the sign-in service's user list is missing here.\n" +
                "  The Dex entries still have to be maintained by hand.\n" : ""))});

  return dateien;
}

function ansibleBundle(){
  /* Serienbetrieb hat eine eigene Form — Schleife statt fester Werte. */
  if (CLUSTER_MODE === "tenant" && tenantOpts(TENANT).batch) return tenantBatchBundle();
  const de = LANG === "de";
  const modus = t(CLUSTER_TAB_LABEL[CLUSTER_MODE] || CLUSTER_TAB_LABEL.install);
  const teile = ansiblePlays();
  teile.forEach(x => { x.datei = String(x.nr).padStart(2, "0") + "-" + x.slug + ".yml"; });

  const dateien = teile.map(x => ({name:x.datei, text:
    "# " + modus + " — " + (de ? "Teil " : "Part ") + x.nr + ": " + x.titel + "\n" +
    "# hosts: " + x.host + "\n" +
    "# " + (de ? "einzeln laufen lassen" : "run on its own") + ": ansible-playbook -i inventory.ini " + x.datei + "\n" +
    "---\n" + x.text}));

  const rueck = teile.filter(x => x.back);
  dateien.unshift({name:"site.yml", text:
    "# " + modus + " — " + (de ? "alles der Reihe nach" : "everything in order") + "\n" +
    "#   ansible-playbook -i inventory.ini site.yml\n" +
    "# " + (de ? "Nur ein Teil" : "A single part") + ":\n" +
    "#   ansible-playbook -i inventory.ini " + (teile[0] ? teile[0].datei : "01-tasks.yml") + "\n" +
    (rueck.length
      ? "#\n# " + (de ? "Der Rückbau steht am Ende und ist bewusst auskommentiert." :
                         "The teardown sits at the end and is deliberately commented out.") + "\n"
      : "") +
    "---\n" +
    teile.filter(x => !x.back).map(x => "- import_playbook: " + x.datei + "\n").join("") +
    rueck.map(x => "\n# " + (de ? "Rückbau, löscht was oben entsteht" : "Teardown, deletes what is created above") +
                   ":\n# - import_playbook: " + x.datei + "\n").join("")});

  dateien.push({name:"inventory.ini", text:
    "; " + (de ? "Namen durch die eigenen ersetzen." : "Replace the names with your own.") + "\n" +
    "[k8s_control_plane]\nk8s-cp1\n\n[k8s_workers]\nk8s-w1\nk8s-w2\n\n" +
    "[k8s_new_node]\n; " + (de ? "nur beim Hinzufuegen eines Knotens" : "only when adding a node") + "\n; k8s-w3\n\n" +
    "[k8s_all:children]\nk8s_control_plane\nk8s_workers\n"});

  dateien.push({name:"README.md", text:
    "# " + modus + "\n\n" +
    (de ? "Erzeugt mit dem k8s-wizard. Ein Playbook je Rolle, `site.yml` ruft sie der Reihe nach auf.\n"
        : "Generated with the k8s wizard. One playbook per role; `site.yml` calls them in order.\n") + "\n" +
    "| " + (de ? "Datei" : "File") + " | hosts | " + (de ? "Inhalt" : "Contents") + " |\n|---|---|---|\n" +
    teile.map(x => "| `" + x.datei + "` | `" + x.host + "` | " +
      (x.back ? (de ? "**Rückbau** — " : "**Teardown** — ") : "") + x.abschnitte.join(", ") + " |\n").join("") + "\n" +
    (de
      ? "## Vor dem ersten Lauf\n\n" +
        "```sh\nansible-galaxy collection install kubernetes.core\npip install kubernetes\n```\n\n" +
        "## Was du noch anfassen musst\n\n" +
        "- Platzhalter in Großbuchstaben — `<TOKEN>`, `<HASH>`, `NODE-1`, `HIER-DAS-KENNWORT` — ersetzen.\n" +
        "- Der Rückbau steht in einer eigenen Datei und ist in `site.yml` auskommentiert. Er löscht, was die übrigen Teile anlegen.\n" +
        "- Erst mit `--check --diff` probieren.\n\n" +
        "## Wie es gebaut ist\n\n" +
        "YAML-Manifeste laufen über `kubernetes.core.k8s` und sind wiederholbar. Alles andere steht als\n" +
        "`shell`-Aufgabe genau so da, wie es im Terminal stünde — samt `sudo`, damit die Zeilen auch ohne\n" +
        "`become` stimmen. Lesende Befehle tragen `changed_when: false`.\n"
      : "## Before the first run\n\n" +
        "```sh\nansible-galaxy collection install kubernetes.core\npip install kubernetes\n```\n\n" +
        "## What you still have to touch\n\n" +
        "- Replace the placeholders in capitals — `<TOKEN>`, `<HASH>`, `NODE-1`, `HIER-DAS-KENNWORT`.\n" +
        "- The teardown sits in a file of its own and is commented out in `site.yml`. It deletes what the other parts create.\n" +
        "- Try it with `--check --diff` first.\n\n" +
        "## How it is built\n\n" +
        "YAML manifests run through `kubernetes.core.k8s` and are repeatable. Everything else appears as a\n" +
        "`shell` task exactly as it would in the terminal — `sudo` included, so the lines are right without\n" +
        "`become`. Read-only commands carry `changed_when: false`.\n")});

  return dateien;
}

/* Ein tar aus dem Stand: 512-Byte-Kopf je Datei, Inhalt auf 512 aufgefuellt,
   am Ende zwei Nullbloecke. Kein Packen, keine Bibliothek. */
function tarBytes(dateien){
  const enc = new TextEncoder();
  const bloecke = [];
  const zeit = Math.floor(Date.now() / 1000);
  dateien.forEach(f => {
    const daten = enc.encode(f.text);
    const kopf = new Uint8Array(512);
    const setz = (pos, s) => { for (let i = 0; i < s.length; i++) kopf[pos + i] = s.charCodeAt(i) & 0xff; };
    const oktal = (n, len) => {
      let s = n.toString(8);
      while (s.length < len - 1) s = "0" + s;
      return s + "\0";
    };
    setz(0, f.name);
    setz(100, "0000644\0");
    setz(108, "0000000\0");
    setz(116, "0000000\0");
    setz(124, oktal(daten.length, 12));
    setz(136, oktal(zeit, 12));
    setz(148, "        ");          /* Pruefsumme zunaechst acht Leerzeichen */
    setz(156, "0");
    setz(257, "ustar\0" + "00");
    let summe = 0;
    for (let i = 0; i < 512; i++) summe += kopf[i];
    let ps = summe.toString(8);
    while (ps.length < 6) ps = "0" + ps;
    setz(148, ps + "\0 ");
    bloecke.push(kopf, daten);
    const rest = (512 - (daten.length % 512)) % 512;
    if (rest) bloecke.push(new Uint8Array(rest));
  });
  bloecke.push(new Uint8Array(1024));
  let laenge = 0;
  bloecke.forEach(b => { laenge += b.length; });
  const alles = new Uint8Array(laenge);
  let pos = 0;
  bloecke.forEach(b => { alles.set(b, pos); pos += b.length; });
  return alles;
}

function clusterMarkdown(){
  const de = LANG === "de";
  if (CLUSTER_MODE === "tenant") return tenantMarkdown();
  if (CLUSTER_MODE === "metallb") return metallbMarkdown();
  const o = clusterOpts(CLUSTER);
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
  return m + guideMarkdown(clusterGuide(CLUSTER));
}

function tenantMarkdown(){
  const o = tenantOpts(TENANT), de = LANG === "de";
  let m = "# " + (de ? "Benutzer und Namespace einrichten" : "Setting up a user and a namespace") + "\n\n";
  m += "| " + (de ? "Angabe" : "Setting") + " | " + (de ? "Wert" : "Value") + " |\n|---|---|\n";
  [[de?"Benutzer":"User", o.user],
   ["Namespace", o.ns],
   [de?"Rechte":"Rights", TENANT_ROLE[o.level]],
   [de?"Anmeldung":"Sign-in", o.identity === "cert" ? (de?"Client-Zertifikat":"client certificate") : "ServiceAccount"],
   ["Pod Security Standard", o.pss],
   [de?"API-Adresse":"API address", o.api],
   [de?"Quota":"Quota", o.quota ? o.cpu + " CPU / " + o.mem + " / " + o.pods + " Pods" : (de?"keine":"none")],
   ["NetworkPolicy", o.netpol ? (de?"ja":"yes") : (de?"nein":"no")],
   [de?"Linux-Konto":"Linux account", o.linux ? (de?"ja":"yes") : (de?"nein":"no")]
  ].forEach(r => { m += "| " + r[0] + " | `" + r[1] + "` |\n"; });
  m += "\n";
  return m + guideMarkdown(tenantGuide(TENANT));
}

function metallbMarkdown(){
  const o = metallbOpts(METALLB), de = LANG === "de";
  let m = "# " + (de ? "MetalLB einrichten" : "Setting up MetalLB") + "\n\n";
  m += "| " + (de ? "Angabe" : "Setting") + " | " + (de ? "Wert" : "Value") + " |\n|---|---|\n";
  [[de?"Adressbereich":"Address range", o.range],
   [de?"Betriebsart":"Mode", o.mode === "l2" ? "L2 (ARP)" : "BGP"],
   ["Installation", o.install === "helm" ? "Helm" : "Manifest " + o.version],
   ["autoAssign", o.autoAssign ? "true" : "false"],
   [de?"Ingress-Controller":"Ingress controller", o.ingress ? firstAddr(o.range) : (de?"nicht gesetzt":"not set")]
  ].concat(o.mode === "bgp" ? [[de?"Router":"Router", o.peer + " (AS " + o.peerAsn + ")"],
                               [de?"Cluster-AS":"Cluster AS", String(o.myAsn)]] : [])
   .forEach(r => { m += "| " + r[0] + " | `" + r[1] + "` |\n"; });
  m += "\n";
  return m + guideMarkdown(metallbGuide(METALLB));
}

/* Alle Anleitungen haben dieselbe Form, also genuegt ein Umsetzer. */
function guideMarkdown(guide){
  let m = "";
  guide.forEach((s, i) => {
    m += "## " + (i+1) + ". " + t(s.h) + " — " + t(CLUSTER_ROLE[s.role]) + "\n\n";
    (s.p||[]).forEach(x => { m += t(x) + "\n\n"; });
    if (s.table){
      m += "| " + s.table[0].map(t).join(" | ") + " |\n|" + s.table[0].map(() => "---").join("|") + "|\n";
      s.table.slice(1).forEach(r => { m += "| " + r.map(t).join(" | ") + " |\n"; });
      m += "\n";
    }
    (s.p2||[]).forEach(x => { m += t(x) + "\n\n"; });
    (s.r||[]).forEach(x => { m += "> **" + (x.lvl === "err" ? "Achtung" : "Hinweis") + "** — " + x.m + "\n\n"; });
    (s.items||[]).forEach(it => { m += "```sh\n" + it.c + "\n```\n\n" + t(it.d) + "\n\n"; });
  });
  return m;
}

const CLUSTER_TABS = {install:"tabInstall", tenant:"tabTenant", metallb:"tabMetallb"};
const CLUSTER_TAB_LABEL = {
  install:"Installation|Installation",
  tenant: "Benutzer & Namespace|Users & namespaces",
  metallb:"MetalLB|MetalLB"
};
const CLUSTER_DESC = {
  install:"Erzeugt eine Anleitung mit kubeadm — für einen neuen Cluster oder für einen Knoten, der zu einem laufenden dazukommt. Jeder Abschnitt sagt, auf welcher Maschine er auszuführen ist. Klick kopiert den Befehl.|Builds a kubeadm guide — for a new cluster or for a node joining a running one. Every section says which machine it runs on. Click copies the command.",
  tenant: "Richtet einen abgegrenzten Arbeitsbereich ein: eigener Namespace, eigene Anmeldung, begrenzte Rechte — und den passenden Linux-Benutzer auf dem Hauptserver. Klick kopiert den Befehl.|Sets up a bounded workspace: its own namespace, its own sign-in, limited rights — and the matching Linux user on the control plane. Click copies the command.",
  metallb:"Gibt Services vom Typ LoadBalancer eine echte Adresse aus dem eigenen Netz — die Rolle, die in der Cloud der Anbieter übernimmt. Klick kopiert den Befehl.|Gives services of type LoadBalancer a real address from your own network — the role the provider plays in the cloud. Click copies the command."
};
function clusterTexts(){
  Object.keys(CLUSTER_TABS).forEach(m => {
    $(CLUSTER_TABS[m]).textContent = t(CLUSTER_TAB_LABEL[m]);
    $(CLUSTER_TABS[m]).setAttribute("aria-pressed", CLUSTER_MODE === m);
  });
  $("clusterMd").textContent = LANG === "de" ? "Anleitung" : "Guide";
  $("clusterYml").textContent = "Ansible";
  $("clusterDesc").textContent = t(CLUSTER_DESC[CLUSTER_MODE] || CLUSTER_DESC.install);
}

function setClusterMode(mode){
  CLUSTER_MODE = mode;
  renderCluster();
}

function renderCluster(){ clusterTexts(); renderClusterFields(); renderClusterOut(); }

Object.keys(CLUSTER_TABS).forEach(m => {
  $(CLUSTER_TABS[m]).addEventListener("click", () => setClusterMode(m));
});

$("clusterBtn").addEventListener("click", () => {
  if (togglePanel("clusterPanel")) renderCluster();
});
$("clusterClose").addEventListener("click", () => { $("clusterPanel").hidden = true; });
$("clusterFields").addEventListener("input", e => {
  if (!e.target.dataset.cl) return;
  clusterStateOf()[e.target.dataset.cl] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
  renderClusterOut();
});
$("clusterFields").addEventListener("change", e => {
  if (!e.target.dataset.cl) return;
  clusterStateOf()[e.target.dataset.cl] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
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
  download(clusterMarkdown(), clusterModeOf().file, "text/markdown");
});
$("clusterYml").addEventListener("click", () => {
  download(tarBytes(ansibleBundle()), clusterModeOf().tar, "application/x-tar");
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
    /* Auch die Anleitungsschritte samt Befehlen sind auffindbar. */
    const stp = (sec.steps||[]).map(st =>
      [t(st.h)].concat((st.p||[]).map(t), st.code ? [t(st.code)] : []).join(" ")).join(" ");
    idx.push({g:"wiki", title:t(sec.h), sub:LANG === "de" ? "Speicher" : "Storage",
      text:[t(sec.h), body, tbl, stp].join(" "), body:(body || stp).slice(0, 220),
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
    const sec = $("storageWiki").querySelector('[data-sec="' + a.i + '"]');
    if (sec) sec.scrollIntoView({behavior:"smooth", block:"start"});
    return;
  }
  if (a.type === "cheat"){
    $("wikiPanel").hidden = false; setWikiTab("cheat");
    const sec = $("cheatWiki").querySelector('[data-sec="' + a.i + '"]');
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
  clusterTexts();
  if (!$("clusterPanel").hidden) renderCluster();
  profileTexts();
  setWikiTab(WIKI_TAB);
  render();
}
$("langDe").addEventListener("click", ()=>setLang("de"));
$("langEn").addEventListener("click", ()=>setLang("en"));

setLang("de");