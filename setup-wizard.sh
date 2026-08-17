#!/usr/bin/env bash
#
# setup-wizard.sh — Menuegesteuertes Installations- und Konfigurationsskript
#
# Bedienung:
#   ./setup-wizard.sh                  # Menue starten
#   ./setup-wizard.sh --list           # verfuegbare Module anzeigen
#   ./setup-wizard.sh --install kubectl,helm
#   ./setup-wizard.sh --dry-run        # nichts ausfuehren, nur protokollieren
#
# Eigene Befehle: siehe modules.d/ (wird beim Start automatisch eingelesen)

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_NAME="$(basename -- "${BASH_SOURCE[0]}")"
VERSION="1.0.0"

# ---------------------------------------------------------------------------
# Globale Einstellungen
# ---------------------------------------------------------------------------
DRY_RUN=0
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/setup-wizard"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/setup-wizard"
CONFIG_FILE="$CONFIG_DIR/settings.conf"
LOG_FILE="$STATE_DIR/wizard-$(date +%Y%m%d-%H%M%S).log"

mkdir -p "$STATE_DIR" "$CONFIG_DIR"

# Einstellungen mit Standardwerten (werden aus CONFIG_FILE ueberschrieben)
SET_COMPLETION=1      # Shell-Completion fuer kubectl/helm einrichten
SET_ALIASES=1         # Aliase k, kgp, kaf ... anlegen
SET_KUBECONFIG_PERM=1 # ~/.kube/config auf 0600 setzen
SET_EDITOR="nano"     # KUBE_EDITOR

# ---------------------------------------------------------------------------
# Hilfsfunktionen: Ausgabe und Logging
# ---------------------------------------------------------------------------
log() { printf '%s  %s\n' "$(date +%H:%M:%S)" "$*" >>"$LOG_FILE"; }

die() {
  printf '\033[31mFehler:\033[0m %s\n' "$*" >&2
  log "ABBRUCH: $*"
  exit 1
}

# Gibt einen Hinweistext aus, wenn --dry-run aktiv ist (sonst nichts).
# Liefert immer 0, damit die Verwendung in Zuweisungen mit 'set -e' sicher ist.
dry_tag() { (( DRY_RUN )) && printf '%s' "$1"; return 0; }

info() { printf '\033[36m·\033[0m %s\n' "$*"; }
ok()   { printf '\033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '\033[33m!\033[0m %s\n' "$*"; }

# Fuehrt einen Shell-Befehl aus, protokolliert ihn und respektiert --dry-run.
run_cmd() {
  local cmd="$1"
  log "\$ $cmd"
  if (( DRY_RUN )); then
    log "  (dry-run: nicht ausgefuehrt)"
    return 0
  fi
  bash -c "$cmd" >>"$LOG_FILE" 2>&1
}

# ---------------------------------------------------------------------------
# System erkennen
# ---------------------------------------------------------------------------
SUDO=""
PM=""
ARCH=""
DISTRO_NAME="unbekannt"
APT_UPDATED=0

detect_system() {
  if [[ $EUID -ne 0 ]]; then
    if command -v sudo >/dev/null 2>&1; then
      SUDO="sudo"
    else
      warn "Weder root noch sudo vorhanden — Systeminstallationen werden fehlschlagen."
    fi
  fi

  local pm
  for pm in apt-get dnf yum pacman zypper apk; do
    if command -v "$pm" >/dev/null 2>&1; then PM="$pm"; break; fi
  done
  [[ -n "$PM" ]] || warn "Kein bekannter Paketmanager gefunden."

  case "$(uname -m)" in
    x86_64|amd64)  ARCH="amd64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    armv7l)        ARCH="arm" ;;
    *)             ARCH="$(uname -m)" ;;
  esac

  if [[ -r /etc/os-release ]]; then
    # shellcheck disable=SC1091
    DISTRO_NAME="$(. /etc/os-release && printf '%s' "${PRETTY_NAME:-$NAME}")"
  fi

  log "System: $DISTRO_NAME | PM: ${PM:-none} | Arch: $ARCH | sudo: ${SUDO:-nein}"
}

# Installiert Distributionspakete ueber den erkannten Paketmanager.
pkg_install() {
  local pkgs="$*"
  case "$PM" in
    apt-get)
      if (( ! APT_UPDATED )); then
        run_cmd "$SUDO apt-get update -qq" && APT_UPDATED=1
      fi
      run_cmd "$SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y $pkgs"
      ;;
    dnf)    run_cmd "$SUDO dnf install -y $pkgs" ;;
    yum)    run_cmd "$SUDO yum install -y $pkgs" ;;
    pacman) run_cmd "$SUDO pacman -S --noconfirm --needed $pkgs" ;;
    zypper) run_cmd "$SUDO zypper --non-interactive install $pkgs" ;;
    apk)    run_cmd "$SUDO apk add --no-cache $pkgs" ;;
    *)      log "Kein Paketmanager — '$pkgs' uebersprungen"; return 1 ;;
  esac
}

# Laedt eine Datei herunter und legt sie ausfuehrbar unter /usr/local/bin ab.
install_binary() {
  local url="$1" name="$2" tmp
  tmp="$(mktemp -d)"
  run_cmd "curl -fsSL '$url' -o '$tmp/$name'" || { rm -rf "$tmp"; return 1; }
  run_cmd "$SUDO install -m 0755 '$tmp/$name' /usr/local/bin/$name"
  rm -rf "$tmp"
}

# Entpackt ein tar.gz und installiert eine Datei daraus nach /usr/local/bin.
install_from_tgz() {
  local url="$1" member="$2" name="$3" tmp
  tmp="$(mktemp -d)"
  run_cmd "curl -fsSL '$url' -o '$tmp/pkg.tgz'" || { rm -rf "$tmp"; return 1; }
  run_cmd "tar -xzf '$tmp/pkg.tgz' -C '$tmp'" || { rm -rf "$tmp"; return 1; }
  run_cmd "$SUDO install -m 0755 '$tmp/$member' /usr/local/bin/$name"
  rm -rf "$tmp"
}

# ---------------------------------------------------------------------------
# Modulregistrierung
#
#   register_module <id> <label> <beschreibung> <test-befehl> <installfunktion>
#
# <test-befehl> prueft, ob das Modul bereits installiert ist (Exit 0 = ja).
# ---------------------------------------------------------------------------
MODULE_IDS=()
declare -A MOD_LABEL MOD_DESC MOD_CHECK MOD_INSTALL

register_module() {
  local id="$1"
  MODULE_IDS+=("$id")
  MOD_LABEL["$id"]="$2"
  MOD_DESC["$id"]="$3"
  MOD_CHECK["$id"]="$4"
  MOD_INSTALL["$id"]="$5"
}

module_installed() {
  local id="$1"
  bash -c "${MOD_CHECK[$id]}" >/dev/null 2>&1
}

# --- Beispielmodule: Kubernetes-Werkzeuge ----------------------------------

inst_kubectl() {
  local ver
  ver="$(curl -fsSL https://dl.k8s.io/release/stable.txt 2>/dev/null || echo v1.31.0)"
  install_binary "https://dl.k8s.io/release/${ver}/bin/linux/${ARCH}/kubectl" kubectl
}

inst_helm() {
  local tmp
  tmp="$(mktemp -d)"
  run_cmd "curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 -o '$tmp/get-helm-3'" \
    || { rm -rf "$tmp"; return 1; }
  run_cmd "chmod +x '$tmp/get-helm-3' && $SUDO '$tmp/get-helm-3'"
  rm -rf "$tmp"
}

inst_k9s() {
  local arch_tag="Linux_amd64"
  [[ "$ARCH" == "arm64" ]] && arch_tag="Linux_arm64"
  install_from_tgz \
    "https://github.com/derailed/k9s/releases/latest/download/k9s_${arch_tag}.tar.gz" \
    "k9s" "k9s"
}

inst_kubectx() {
  install_binary "https://raw.githubusercontent.com/ahmetb/kubectx/master/kubectx" kubectx &&
  install_binary "https://raw.githubusercontent.com/ahmetb/kubectx/master/kubens"  kubens
}

inst_kind() {
  install_binary "https://kind.sigs.k8s.io/dl/latest/kind-linux-${ARCH}" kind
}

inst_minikube() {
  install_binary "https://storage.googleapis.com/minikube/releases/latest/minikube-linux-${ARCH}" minikube
}

inst_k3s() {
  local tmp
  tmp="$(mktemp -d)"
  run_cmd "curl -fsSL https://get.k3s.io -o '$tmp/k3s.sh'" || { rm -rf "$tmp"; return 1; }
  run_cmd "chmod +x '$tmp/k3s.sh' && $SUDO '$tmp/k3s.sh'"
  rm -rf "$tmp"
}

inst_docker() {
  local tmp
  tmp="$(mktemp -d)"
  run_cmd "curl -fsSL https://get.docker.com -o '$tmp/docker.sh'" || { rm -rf "$tmp"; return 1; }
  run_cmd "$SUDO sh '$tmp/docker.sh'"
  run_cmd "$SUDO usermod -aG docker '${SUDO_USER:-$USER}' || true"
  rm -rf "$tmp"
}

inst_jq()  { pkg_install jq; }
inst_yq()  { install_binary "https://github.com/mikefarah/yq/releases/latest/download/yq_linux_${ARCH}" yq; }
inst_base() {
  case "$PM" in
    apt-get) pkg_install curl ca-certificates git tar gzip ;;
    apk)     pkg_install curl ca-certificates git tar ;;
    *)       pkg_install curl git tar gzip ;;
  esac
}

register_module base     "Basiswerkzeuge" "curl, git, tar, ca-certificates"        "command -v curl && command -v git" inst_base
register_module kubectl  "kubectl"        "Kubernetes-CLI (stabile Version)"       "command -v kubectl"                inst_kubectl
register_module helm     "helm"           "Paketmanager fuer Kubernetes"           "command -v helm"                   inst_helm
register_module k9s      "k9s"            "Terminal-UI fuer Cluster"               "command -v k9s"                    inst_k9s
register_module kubectx  "kubectx/kubens" "Schnell Context und Namespace wechseln" "command -v kubectx"                inst_kubectx
register_module kind     "kind"           "Kubernetes in Docker (lokaler Cluster)" "command -v kind"                   inst_kind
register_module minikube "minikube"       "Lokaler Einzelknoten-Cluster"           "command -v minikube"               inst_minikube
register_module k3s      "k3s"            "Leichtgewichtige Kubernetes-Distro"     "command -v k3s"                    inst_k3s
register_module docker   "docker"         "Container-Runtime inkl. compose"        "command -v docker"                 inst_docker
register_module jq       "jq"             "JSON-Prozessor"                         "command -v jq"                     inst_jq
register_module yq       "yq"             "YAML-Prozessor"                         "command -v yq"                     inst_yq

# --- Eigene Module aus modules.d/ nachladen --------------------------------
load_custom_modules() {
  local f
  shopt -s nullglob
  for f in "$SCRIPT_DIR"/modules.d/*.module "$SCRIPT_DIR"/modules.d/*.sh; do
    log "Lade Modul: $f"
    # shellcheck disable=SC1090
    source "$f" || warn "Modul konnte nicht geladen werden: $f"
  done
  shopt -u nullglob
}

# ---------------------------------------------------------------------------
# Konfiguration laden und speichern
# ---------------------------------------------------------------------------
load_settings() {
  [[ -r "$CONFIG_FILE" ]] || return 0
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
  log "Einstellungen geladen aus $CONFIG_FILE"
}

save_settings() {
  cat >"$CONFIG_FILE" <<EOF
# Automatisch erzeugt von $SCRIPT_NAME am $(date)
SET_COMPLETION=$SET_COMPLETION
SET_ALIASES=$SET_ALIASES
SET_KUBECONFIG_PERM=$SET_KUBECONFIG_PERM
SET_EDITOR="$SET_EDITOR"
EOF
  log "Einstellungen gespeichert nach $CONFIG_FILE"
}

# ---------------------------------------------------------------------------
# Dialog-Backend (whiptail oder dialog)
# ---------------------------------------------------------------------------
DIALOG=""
BACKTITLE="setup-wizard v$VERSION  ·  $DISTRO_NAME"

detect_dialog() {
  if command -v whiptail >/dev/null 2>&1; then
    DIALOG="whiptail"
  elif command -v dialog >/dev/null 2>&1; then
    DIALOG="dialog"
  else
    DIALOG=""
  fi
}

# Bietet an, whiptail nachzuinstallieren, wenn kein Backend da ist.
ensure_dialog() {
  detect_dialog
  [[ -n "$DIALOG" ]] && return 0

  warn "Weder 'whiptail' noch 'dialog' gefunden — beides wird fuer das Menue gebraucht."
  read -r -p "Jetzt installieren? [J/n] " answer
  case "${answer:-j}" in
    [JjYy]*)
      case "$PM" in
        apt-get|dnf|yum|zypper) pkg_install newt || pkg_install dialog ;;
        pacman)                 pkg_install libnewt || pkg_install dialog ;;
        apk)                    pkg_install newt || pkg_install dialog ;;
        *)                      die "Bitte 'whiptail' (Paket newt) manuell installieren." ;;
      esac
      detect_dialog
      [[ -n "$DIALOG" ]] || die "Installation fehlgeschlagen. Nutze --install / --list ohne Menue."
      ;;
    *) die "Ohne whiptail/dialog bitte --install oder --list verwenden." ;;
  esac
}

msgbox()  { "$DIALOG" --backtitle "$BACKTITLE" --title "$1" --msgbox  "$2" "${3:-14}" "${4:-70}"; }
yesno()   { "$DIALOG" --backtitle "$BACKTITLE" --title "$1" --yesno   "$2" "${3:-12}" "${4:-70}"; }
textbox() { "$DIALOG" --backtitle "$BACKTITLE" --title "$1" --scrolltext --textbox "$2" 24 90; }

# ---------------------------------------------------------------------------
# Menue: Pakete auswaehlen und installieren
# ---------------------------------------------------------------------------
menu_install() {
  local items=() id status rc selection
  for id in "${MODULE_IDS[@]}"; do
    if module_installed "$id"; then status="ON"; else status="OFF"; fi
    items+=("$id" "${MOD_LABEL[$id]} — ${MOD_DESC[$id]}" "$status")
  done

  set +e
  selection="$("$DIALOG" --backtitle "$BACKTITLE" \
    --title "Komponenten installieren" \
    --checklist "Leertaste waehlt aus, Tab springt zu den Knoepfen.\nBereits vorhandene Komponenten sind vorausgewaehlt." \
    22 78 12 --separate-output "${items[@]}" 3>&1 1>&2 2>&3)"
  rc=$?
  set -e
  (( rc != 0 )) && return 0

  local chosen=()
  while IFS= read -r line; do
    [[ -n "$line" ]] && chosen+=("$line")
  done <<<"$selection"

  if (( ${#chosen[@]} == 0 )); then
    msgbox "Nichts ausgewaehlt" "Es wurde keine Komponente ausgewaehlt." 8 60
    return 0
  fi

  local summary=""
  for id in "${chosen[@]}"; do summary+="  • ${MOD_LABEL[$id]}\n"; done
  if ! yesno "Bestaetigen" "Folgende Komponenten werden installiert:\n\n$summary\nFortfahren?" 18 70; then
    return 0
  fi

  install_modules "${chosen[@]}"
}

# Installiert die uebergebenen Modul-IDs mit Fortschrittsbalken.
install_modules() {
  local ids=("$@") total=${#ids[@]} failfile
  failfile="$(mktemp)"

  {
    local i=0 id pct
    for id in "${ids[@]}"; do
      pct=$(( i * 100 / total ))
      printf 'XXX\n%d\n%s\nKomponente %d von %d\nXXX\n' \
        "$pct" "${MOD_LABEL[$id]} wird installiert …" "$((i + 1))" "$total"
      log "=== Installiere ${MOD_LABEL[$id]} ($id) ==="
      if ! "${MOD_INSTALL[$id]}"; then
        log "FEHLGESCHLAGEN: $id"
        printf '%s\n' "$id" >>"$failfile"
      else
        log "ERFOLG: $id"
      fi
      i=$((i + 1))
    done
    printf 'XXX\n100\nFertig.\nXXX\n'
    sleep 1
  } | "$DIALOG" --backtitle "$BACKTITLE" --title "Installation laeuft" --gauge "Start …" 10 70 0

  local failed=()
  while IFS= read -r line; do [[ -n "$line" ]] && failed+=("$line"); done <"$failfile"
  rm -f "$failfile"

  if (( ${#failed[@]} == 0 )); then
    msgbox "Fertig" "Alle ${total} Komponenten wurden verarbeitet.\n\nProtokoll:\n$LOG_FILE" 12 70
  else
    local list=""
    for id in "${failed[@]}"; do list+="  • ${MOD_LABEL[$id]}\n"; done
    msgbox "Mit Fehlern beendet" "Nicht erfolgreich:\n\n$list\nDetails im Protokoll:\n$LOG_FILE" 16 70
  fi
}

# ---------------------------------------------------------------------------
# Menue: Einstellungen
# ---------------------------------------------------------------------------
menu_settings() {
  local rc selection items=()
  local c_on a_on p_on
  (( SET_COMPLETION ))      && c_on="ON" || c_on="OFF"
  (( SET_ALIASES ))         && a_on="ON" || a_on="OFF"
  (( SET_KUBECONFIG_PERM )) && p_on="ON" || p_on="OFF"

  items=(
    completion "Shell-Completion fuer kubectl und helm"        "$c_on"
    aliases    "Aliase anlegen (k, kgp, kgs, kaf, kdel)"       "$a_on"
    kubeperm   "Rechte von ~/.kube/config auf 0600 setzen"     "$p_on"
  )

  set +e
  selection="$("$DIALOG" --backtitle "$BACKTITLE" \
    --title "Einstellungen" \
    --checklist "Was soll eingerichtet werden?" \
    16 74 6 --separate-output "${items[@]}" 3>&1 1>&2 2>&3)"
  rc=$?
  set -e
  (( rc != 0 )) && return 0

  SET_COMPLETION=0; SET_ALIASES=0; SET_KUBECONFIG_PERM=0
  while IFS= read -r line; do
    case "$line" in
      completion) SET_COMPLETION=1 ;;
      aliases)    SET_ALIASES=1 ;;
      kubeperm)   SET_KUBECONFIG_PERM=1 ;;
    esac
  done <<<"$selection"

  # Editor per Radioliste
  local ed_nano="OFF" ed_vim="OFF" ed_micro="OFF"
  case "$SET_EDITOR" in
    nano)  ed_nano="ON" ;;
    vim)   ed_vim="ON" ;;
    micro) ed_micro="ON" ;;
  esac

  set +e
  local editor
  editor="$("$DIALOG" --backtitle "$BACKTITLE" \
    --title "Editor fuer 'kubectl edit'" \
    --radiolist "KUBE_EDITOR auswaehlen:" 13 60 3 \
    nano  "Einsteigerfreundlich" "$ed_nano" \
    vim   "Modal, maechtig"      "$ed_vim" \
    micro "Modern, einfach"      "$ed_micro" 3>&1 1>&2 2>&3)"
  rc=$?
  set -e
  (( rc == 0 )) && [[ -n "$editor" ]] && SET_EDITOR="$editor"

  save_settings
  apply_settings
  msgbox "Uebernommen" "Die Einstellungen wurden in ~/.bashrc geschrieben.\n\nNeue Shell oeffnen oder ausfuehren:\n  source ~/.bashrc" 12 70
}

# Schreibt einen verwalteten Block in ~/.bashrc (idempotent).
apply_settings() {
  local rcfile="$HOME/.bashrc"
  local begin="# >>> setup-wizard begin >>>"
  local end="# <<< setup-wizard end <<<"
  local block=""

  block+="$begin\n"
  block+="export KUBE_EDITOR=\"$SET_EDITOR\"\n"

  if (( SET_COMPLETION )); then
    block+="command -v kubectl >/dev/null 2>&1 && source <(kubectl completion bash)\n"
    block+="command -v helm    >/dev/null 2>&1 && source <(helm completion bash)\n"
  fi

  if (( SET_ALIASES )); then
    block+="alias k='kubectl'\n"
    block+="alias kgp='kubectl get pods'\n"
    block+="alias kgs='kubectl get svc'\n"
    block+="alias kaf='kubectl apply -f'\n"
    block+="alias kdel='kubectl delete'\n"
    block+="command -v kubectl >/dev/null 2>&1 && complete -o default -F __start_kubectl k\n"
  fi

  block+="$end"

  log "Schreibe Konfigurationsblock nach $rcfile"
  if (( DRY_RUN )); then
    log "(dry-run) Block waere:\n$(printf '%b' "$block")"
  else
    touch "$rcfile"
    # Alten Block entfernen, dann neu anhaengen
    sed -i "/^${begin}$/,/^${end}$/d" "$rcfile"
    printf '\n%b\n' "$block" >>"$rcfile"
  fi

  if (( SET_KUBECONFIG_PERM )) && [[ -f "$HOME/.kube/config" ]]; then
    run_cmd "chmod 600 '$HOME/.kube/config'"
  fi
}

# ---------------------------------------------------------------------------
# Menue: Status
# ---------------------------------------------------------------------------
menu_status() {
  local tmp id line
  tmp="$(mktemp)"
  {
    printf 'System        : %s\n' "$DISTRO_NAME"
    printf 'Kernel        : %s\n' "$(uname -r)"
    printf 'Architektur   : %s\n' "$ARCH"
    printf 'Paketmanager  : %s\n' "${PM:-keiner erkannt}"
    printf 'Rechte        : %s\n' "$([[ $EUID -eq 0 ]] && echo root || echo "Benutzer ($USER), sudo: ${SUDO:-nein}")"
    printf 'Protokoll     : %s\n' "$LOG_FILE"
    printf '\nKomponenten:\n'
    for id in "${MODULE_IDS[@]}"; do
      if module_installed "$id"; then
        printf '  [x] %-16s %s\n' "${MOD_LABEL[$id]}" "$(module_version "$id")"
      else
        printf '  [ ] %-16s nicht installiert\n' "${MOD_LABEL[$id]}"
      fi
    done
  } >"$tmp"
  textbox "Status" "$tmp"
  rm -f "$tmp"
}

module_version() {
  local id="$1" bin="$1"
  case "$id" in
    kubectl)  kubectl version --client -o yaml 2>/dev/null | awk '/gitVersion/{print $2; exit}' ;;
    helm)     helm version --short 2>/dev/null ;;
    docker)   docker --version 2>/dev/null ;;
    *)        command -v "$bin" 2>/dev/null || echo "installiert" ;;
  esac
}

# ---------------------------------------------------------------------------
# Hauptmenue
# ---------------------------------------------------------------------------
main_menu() {
  local choice rc
  while true; do
    set +e
    choice="$("$DIALOG" --backtitle "$BACKTITLE" \
      --title "Hauptmenue" \
      --menu "Was moechtest du tun?$(dry_tag '

*** DRY-RUN: es wird nichts veraendert ***')" \
      17 70 6 \
      1 "Komponenten installieren" \
      2 "Einstellungen anpassen" \
      3 "Status anzeigen" \
      4 "Protokoll ansehen" \
      5 "Beenden" 3>&1 1>&2 2>&3)"
    rc=$?
    set -e
    (( rc != 0 )) && return 0

    case "$choice" in
      1) menu_install ;;
      2) menu_settings ;;
      3) menu_status ;;
      4) textbox "Protokoll — $LOG_FILE" "$LOG_FILE" ;;
      5) return 0 ;;
    esac
  done
}

# ---------------------------------------------------------------------------
# Nicht-interaktive Modi
# ---------------------------------------------------------------------------
list_modules() {
  local id
  printf '%-12s %-18s %s\n' "ID" "NAME" "BESCHREIBUNG"
  for id in "${MODULE_IDS[@]}"; do
    printf '%-12s %-18s %s\n' "$id" "${MOD_LABEL[$id]}" "${MOD_DESC[$id]}"
  done
}

install_headless() {
  local ids_csv="$1" id total=0 failed=0
  IFS=',' read -r -a want <<<"$ids_csv"
  for id in "${want[@]}"; do
    [[ -n "${MOD_LABEL[$id]:-}" ]] || die "Unbekanntes Modul: $id (siehe --list)"
  done
  for id in "${want[@]}"; do
    total=$((total + 1))
    info "Installiere ${MOD_LABEL[$id]} …"
    if "${MOD_INSTALL[$id]}"; then
      ok "${MOD_LABEL[$id]}"
    else
      warn "${MOD_LABEL[$id]} fehlgeschlagen — siehe $LOG_FILE"
      failed=$((failed + 1))
    fi
  done
  info "Fertig: $((total - failed)) von $total erfolgreich. Protokoll: $LOG_FILE"
  (( failed == 0 ))
}

usage() {
  cat <<EOF
$SCRIPT_NAME v$VERSION — Installations- und Konfigurationsmenue

  $SCRIPT_NAME                     Menue starten
  $SCRIPT_NAME --list              verfuegbare Module anzeigen
  $SCRIPT_NAME --install a,b,c     Module ohne Menue installieren
  $SCRIPT_NAME --settings          Einstellungen aus der Konfigdatei anwenden
  $SCRIPT_NAME --dry-run           nichts ausfuehren, nur ins Protokoll schreiben
  $SCRIPT_NAME --help              diese Hilfe

Protokoll : $LOG_FILE
Konfig    : $CONFIG_FILE
Module    : $SCRIPT_DIR/modules.d/
EOF
}

# ---------------------------------------------------------------------------
# Einstieg
# ---------------------------------------------------------------------------
main() {
  local mode="menu" install_list=""

  while (( $# )); do
    case "$1" in
      --dry-run)  DRY_RUN=1 ;;
      --list)     mode="list" ;;
      --settings) mode="settings" ;;
      --install)  mode="install"; install_list="${2:-}"; shift
                  [[ -n "$install_list" ]] || die "--install braucht eine Liste, z. B. --install kubectl,helm" ;;
      --install=*) mode="install"; install_list="${1#*=}" ;;
      -h|--help)  usage; exit 0 ;;
      *)          die "Unbekannte Option: $1 (siehe --help)" ;;
    esac
    shift
  done

  log "Start $SCRIPT_NAME v$VERSION (Modus: $mode, dry-run: $DRY_RUN)"
  detect_system
  load_settings
  load_custom_modules
  BACKTITLE="setup-wizard v$VERSION  ·  $DISTRO_NAME$(dry_tag '  ·  DRY-RUN')"

  case "$mode" in
    list)     list_modules ;;
    install)  install_headless "$install_list" ;;
    settings) apply_settings; ok "Einstellungen angewendet (siehe ~/.bashrc)" ;;
    menu)     ensure_dialog; main_menu; clear; ok "Beendet. Protokoll: $LOG_FILE" ;;
  esac
}

main "$@"
