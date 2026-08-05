#!/usr/bin/env bash
# lapa-casa-hostel/scripts/health-check.sh
# ventana6
#
# Verifica que los servicios publicos esten respondiendo. Pensado para
# correr a mano despues de un deploy, o desde un cron/monitor externo
# (UptimeRobot, GitHub Actions, etc.) -- sale con codigo distinto de 0 si
# algo esta mal, para que un pipeline lo pueda usar como gate.
#
# Uso:
#   BACKEND_URL=https://api.lapacasahostel.com \
#   LANDING_URL=https://lapacasahostel.com \
#   ./scripts/health-check.sh
#
# Por defecto apunta a localhost (desarrollo).

set -uo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"
LANDING_URL="${LANDING_URL:-http://localhost:8080}"

FAILED=0

check() {
  local name="$1"
  local url="$2"
  local expect_status="${3:-200}"

  local status
  status=$(curl -sS -o /tmp/health-check-body.txt -w "%{http_code}" --max-time 10 "$url" 2>/tmp/health-check-error.txt)

  if [[ "$status" == "$expect_status" ]]; then
    echo "OK   $name ($url) -> $status"
  else
    echo "FAIL $name ($url) -> $status (esperado $expect_status)"
    cat /tmp/health-check-body.txt 2>/dev/null | head -c 300
    echo
    FAILED=1
  fi
}

echo "== Backend =="
check "health"        "${BACKEND_URL}/health"
check "ready"         "${BACKEND_URL}/ready"
check "root"          "${BACKEND_URL}/"
check "rooms"         "${BACKEND_URL}/api/v1/rooms"
check "ical export"   "${BACKEND_URL}/api/v1/ical/export"

echo
echo "== Landing =="
check "landing" "${LANDING_URL}/"

echo
echo "== Health extendido (informativo, no falla el script) =="
curl -sS --max-time 10 "${BACKEND_URL}/api/health" | (command -v jq >/dev/null 2>&1 && jq . || cat)

echo
if [[ "$FAILED" -eq 0 ]]; then
  echo "Todos los checks pasaron."
  exit 0
else
  echo "Uno o mas checks fallaron." >&2
  exit 1
fi
