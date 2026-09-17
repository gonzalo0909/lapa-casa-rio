#!/usr/bin/env bash
# lapa-casa-hostel/scripts/rollback.sh
#
# Vuelve el proyecto de Vercel (lapa-frontend) al deploy
# anterior exitoso, via la API REST de Vercel.
#
# Backend/worker corren en Fly.io — ver docs/DEPLOY.md sección 9 para
# el rollback de esos dos.
#
# Uso:
#   VERCEL_TOKEN=xxx VERCEL_PROJECT_ID=prj_xxx ./scripts/rollback.sh
#
# VERCEL_TOKEN: dashboard → Account Settings → Tokens → Create.
# VERCEL_PROJECT_ID: dashboard → proyecto → Settings → General →
#   Project ID (empieza con "prj_"). O con:
#   curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
#     "https://api.vercel.com/v9/projects?limit=20" | jq '.[].id'
#
# El script lista los últimos 10 deploys "READY" (exitosos) del proyecto,
# y promueve a producción el segundo (el inmediatamente anterior al actual).
# Para elegir uno distinto, ajustar el índice en la línea "PREVIOUS_ID=".

set -euo pipefail

API_KEY="${VERCEL_TOKEN:-}"
PROJECT_ID="${VERCEL_PROJECT_ID:-}"

if [[ -z "$API_KEY" || -z "$PROJECT_ID" ]]; then
  echo "Faltan VERCEL_TOKEN y/o VERCEL_PROJECT_ID (ver docs/DEPLOY.md)." >&2
  exit 1
fi

echo "Buscando el último deploy 'READY' anterior al actual para $PROJECT_ID..."

DEPLOYS_JSON=$(curl -sS \
  -H "Authorization: Bearer $API_KEY" \
  "https://api.vercel.com/v6/deployments?projectId=${PROJECT_ID}&limit=10&state=READY&target=production")

# El primer elemento es el deploy actual; el segundo es el anterior.
PREVIOUS_ID=$(echo "$DEPLOYS_JSON" | node -e '
  const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
  const deploys = data.deployments || [];
  if (deploys.length < 2) { process.exit(1); }
  console.log(deploys[1].uid);
')

if [[ -z "${PREVIOUS_ID:-}" ]]; then
  echo "No se encontró un deploy anterior READY para hacer rollback." >&2
  echo "Verificar en el dashboard de Vercel → Deployments." >&2
  exit 1
fi

echo "Deploy anterior encontrado: $PREVIOUS_ID"
read -r -p "Confirmar rollback a este deploy? [y/N] " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "Cancelado."
  exit 0
fi

# Promover el deploy anterior a producción (Instant Rollback de Vercel).
curl -sS -X POST \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  "https://api.vercel.com/v9/projects/${PROJECT_ID}/promote/${PREVIOUS_ID}"

echo
echo "Rollback solicitado. Verificar en el dashboard de Vercel (Deployments)"
echo "y con ./scripts/health-check.sh una vez que el alias se propague."
