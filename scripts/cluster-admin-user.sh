#!/usr/bin/env bash
#
# cluster-admin-user.sh — legt einen Kubernetes-Benutzer mit allen Rechten
# (ClusterRole cluster-admin) an und gibt am Ende eine fertige kubeconfig aus.
# Mit "delete" wird derselbe Benutzer wieder vollständig entfernt.
#
#   ./cluster-admin-user.sh [create|delete] [benutzername]
#
# Ohne Argumente fragt das Skript nur den Benutzernamen ab und legt ihn an.
#
# Voraussetzungen: kubectl (als bestehender Admin, z. B. mit admin.conf) und openssl.
# Der Benutzer wird durch ein von der Cluster-CA signiertes x509-Client-Zertifikat
# repräsentiert; die Rechte hängen an einer ClusterRoleBinding auf cluster-admin.
#
set -euo pipefail

VALID_DAYS="${VALID_DAYS:-365}"          # Gültigkeit des Zertifikats in Tagen
OUT_DIR="${OUT_DIR:-.}"                    # Ablageort der erzeugten kubeconfig

die(){ echo "Fehler: $*" >&2; exit 1; }
info(){ echo "  $*" >&2; }

command -v kubectl >/dev/null 2>&1 || die "kubectl nicht gefunden."

ACTION="${1:-}"
USER_NAME="${2:-}"

# Aktion bestimmen: Standard ist "create".
case "$ACTION" in
  create|delete) ;;
  "")            ACTION="create" ;;
  -h|--help|help)
    grep '^#' "$0" | sed 's/^# \{0,1\}//; 1d'
    exit 0 ;;
  *)
    # Erstes Argument ist kein Verb → als Benutzername deuten.
    USER_NAME="$ACTION"; ACTION="create" ;;
esac

# Benutzernamen abfragen, falls nicht übergeben.
if [ -z "$USER_NAME" ]; then
  printf 'Benutzername: ' >&2
  read -r USER_NAME
fi
[ -n "$USER_NAME" ] || die "Kein Benutzername angegeben."

# Nur DNS-taugliche Namen erlauben (Kleinbuchstaben, Ziffern, Bindestrich).
echo "$USER_NAME" | grep -Eq '^[a-z0-9]([-a-z0-9]*[a-z0-9])?$' \
  || die "Ungültiger Benutzername '$USER_NAME' (nur Kleinbuchstaben, Ziffern, Bindestrich)."

CSR_NAME="${USER_NAME}-csr"
CRB_NAME="${USER_NAME}-cluster-admin"
KUBECONFIG_OUT="${OUT_DIR%/}/${USER_NAME}.kubeconfig"

# ---------------------------------------------------------------- delete
if [ "$ACTION" = "delete" ]; then
  info "Entferne Rechte und Objekte für '$USER_NAME' …"
  kubectl delete clusterrolebinding "$CRB_NAME" --ignore-not-found
  kubectl delete csr "$CSR_NAME" --ignore-not-found
  rm -f "$KUBECONFIG_OUT"
  info "Erledigt. Die Bindung ist weg — der Benutzer hat damit sofort keine Rechte mehr."
  info "Hinweis: Ein bereits ausgestelltes Zertifikat lässt sich in Kubernetes nicht"
  info "widerrufen; die Rechte hängen aber ausschließlich an der gelöschten Bindung."
  exit 0
fi

# ---------------------------------------------------------------- create
command -v openssl >/dev/null 2>&1 || die "openssl nicht gefunden."

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

info "Erzeuge Schlüssel und Zertifikatsantrag (CSR) …"
openssl genrsa -out "$WORK/user.key" 4096 >/dev/null 2>&1
openssl req -new -key "$WORK/user.key" -out "$WORK/user.csr" -subj "/CN=${USER_NAME}"

# Vorhandene CSR gleichen Namens entfernen, damit ein erneuter Lauf sauber ist.
kubectl delete csr "$CSR_NAME" --ignore-not-found >/dev/null 2>&1 || true

info "Reiche die CSR bei der Cluster-CA ein …"
cat <<EOF | kubectl apply -f -
apiVersion: certificates.k8s.io/v1
kind: CertificateSigningRequest
metadata:
  name: ${CSR_NAME}
spec:
  request: $(base64 < "$WORK/user.csr" | tr -d '\n')
  signerName: kubernetes.io/kube-apiserver-client
  expirationSeconds: $((VALID_DAYS * 86400))
  usages:
    - client auth
EOF

info "Genehmige die CSR …"
kubectl certificate approve "$CSR_NAME"

info "Warte auf das signierte Zertifikat …"
CERT=""
for _ in $(seq 1 30); do
  CERT="$(kubectl get csr "$CSR_NAME" -o jsonpath='{.status.certificate}' 2>/dev/null || true)"
  [ -n "$CERT" ] && break
  sleep 1
done
[ -n "$CERT" ] || die "Kein Zertifikat erhalten — läuft ein Signer im Cluster?"
echo "$CERT" | base64 -d > "$WORK/user.crt"

info "Binde '$USER_NAME' an die ClusterRole cluster-admin …"
kubectl create clusterrolebinding "$CRB_NAME" \
  --clusterrole=cluster-admin --user="$USER_NAME" \
  --dry-run=client -o yaml | kubectl apply -f -

# Cluster-Koordinaten aus der aktuellen (Admin-)kubeconfig übernehmen.
CLUSTER_NAME="$(kubectl config view --raw --minify -o jsonpath='{.clusters[0].name}')"
SERVER="$(kubectl config view --raw --minify -o jsonpath='{.clusters[0].cluster.server}')"
[ -n "$SERVER" ] || die "Server-Adresse nicht aus der aktuellen kubeconfig lesbar."
CA_DATA="$(kubectl config view --raw --minify -o jsonpath='{.clusters[0].cluster.certificate-authority-data}')"
if [ -n "$CA_DATA" ]; then
  echo "$CA_DATA" | base64 -d > "$WORK/ca.crt"
else
  CA_FILE="$(kubectl config view --raw --minify -o jsonpath='{.clusters[0].cluster.certificate-authority}')"
  [ -n "$CA_FILE" ] || die "Cluster-CA nicht aus der aktuellen kubeconfig lesbar."
  cp "$CA_FILE" "$WORK/ca.crt"
fi

info "Schreibe kubeconfig nach $KUBECONFIG_OUT …"
rm -f "$KUBECONFIG_OUT"
kubectl config set-cluster "$CLUSTER_NAME" \
  --server="$SERVER" --certificate-authority="$WORK/ca.crt" \
  --embed-certs=true --kubeconfig="$KUBECONFIG_OUT" >/dev/null
kubectl config set-credentials "$USER_NAME" \
  --client-certificate="$WORK/user.crt" --client-key="$WORK/user.key" \
  --embed-certs=true --kubeconfig="$KUBECONFIG_OUT" >/dev/null
kubectl config set-context "${USER_NAME}@${CLUSTER_NAME}" \
  --cluster="$CLUSTER_NAME" --user="$USER_NAME" --kubeconfig="$KUBECONFIG_OUT" >/dev/null
kubectl config use-context "${USER_NAME}@${CLUSTER_NAME}" --kubeconfig="$KUBECONFIG_OUT" >/dev/null
chmod 600 "$KUBECONFIG_OUT"

echo >&2
info "Fertig. Benutzer '$USER_NAME' hat jetzt cluster-admin-Rechte."
info "Testen:  KUBECONFIG=$KUBECONFIG_OUT kubectl get nodes"
info "Löschen: $0 delete $USER_NAME"
echo "$KUBECONFIG_OUT"
