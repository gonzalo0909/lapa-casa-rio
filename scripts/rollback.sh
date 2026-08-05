#!/usr/bin/env bash
# lapa-casa-hostel/scripts/rollback.sh
# ventana6
#
# Vuelve un servicio de Render al deploy anterior exitoso, via la API
# REST de Render (no via Deploy Hook -- rollback requiere listar deploys
# y necesita un API key con permiso de lectura/escritura sobre el
# servicio, no solo el hook de un solo uso).
#
# Uso:
#   RENDER_API_KEY=rnd_xxx RENDER_SERVICE_ID=srv-xxx ./scripts/rollback.sh
#
# RENDER_API_KEY: dashboard -> Account Settings -> API Keys.
# RENDER_SERVICE_ID: se ve en la URL del servicio en el dashboard, o con
#   curl -s -H "Authorization: Bearer $RENDER_API_KEY" https://api.render.com/v1/services | jq

set -euo pipefail

API_KEY="${RENDER_API_KEY:-}"
SERVICE_ID="${RENDER_SERVICE_ID:-}"

if [[ -z "$API_KEY" || -z "$SERVICE_ID" ]]; then
  echo "Faltan RENDER_API_KEY y/o RENDER_SERVICE_ID (ver docs/DEPLOY.md)." >&2
  exit 1
fi

echo "Buscando el ultimo deploy 'live' anterior al actual para $SERVICE_ID..."

DEPLOYS_JSON=$(curl -sS \
  -H "Authorization: Bearer $API_KEY" \
  "https://api.render.com/v1/services/${SERVICE_ID}/deploys?limit=20")

# El primer elemento es el deploy actual; se busca el siguiente con
# status "live" para volver a ese commit.
PREVIOUS_DEPLOY_ID=$(echo "$DEPLOYS_JSON" | node -e '
  const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
  const live = data.map(d => d.deploy).filter(d => d && d.status === "live");
  if (live.length < 2) { process.exit(1); }
  console.log(live[1].id);
')

if [[ -z "${PREVIOUS_DEPLOY_ID:-}" ]]; then
  echo "No se encontro un deploy 'live' anterior para hacer rollback." >&2
  exit 1
fi

echo "Deploy anterior encontrado: $PREVIOUS_DEPLOY_ID"
read -r -p "Confirmar rollback a este deploy? [y/N] " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "Cancelado."
  exit 0
fi

# Endpoint confirmado contra la documentacion publica de Render
# (POST /v1/services/{serviceId}/rollback, api-docs.render.com/reference/
# rollback-deploy) al escribir este script -- verificar que no haya
# cambiado si esto empieza a devolver 4xx.
curl -sS -X POST \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  "https://api.render.com/v1/services/${SERVICE_ID}/rollback" \
  -d "{\"deployId\": \"${PREVIOUS_DEPLOY_ID}\"}"

echo
echo "Rollback solicitado. Verificar en el dashboard de Render y con ./scripts/health-check.sh"
