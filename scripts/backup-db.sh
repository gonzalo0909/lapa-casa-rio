#!/usr/bin/env bash
# lapa-casa-hostel/scripts/backup-db.sh
# ventana6
#
# Backup del Supabase real (proyecto rpowardrcwnhbkzjsiok) via pg_dump
# directo contra DATABASE_URL. Supabase ya hace backups automaticos
# (checklist de Ventana 6), esto es para tener una copia local/portable
# ademas -- antes de una migracion riesgosa, antes de un deploy grande,
# o para restaurar en un Postgres local de desarrollo.
#
# Uso:
#   DATABASE_URL="postgresql://...supabase..." ./scripts/backup-db.sh [directorio_destino]
#
# Requiere pg_dump instalado (viene con el cliente de postgresql;
# `apt install postgresql-client` / `brew install postgresql`).

set -euo pipefail

DATABASE_URL="${DATABASE_URL:-}"
if [[ -z "$DATABASE_URL" ]]; then
  echo "Falta DATABASE_URL. Copiarla desde backend/.env o el dashboard de Supabase." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump no esta instalado. Instalar postgresql-client." >&2
  exit 1
fi

DEST_DIR="${1:-./backups}"
mkdir -p "$DEST_DIR"

TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
OUT_FILE="${DEST_DIR}/lapa-casa-hostel_${TIMESTAMP}.dump"

echo "Generando backup en formato custom (pg_restore-compatible): $OUT_FILE"
# Formato custom (-Fc): comprimido y permite restaurar tablas/objetos
# individuales con pg_restore, a diferencia de un dump plano en SQL.
pg_dump "$DATABASE_URL" -Fc --no-owner --no-privileges -f "$OUT_FILE"

SIZE=$(du -h "$OUT_FILE" | cut -f1)
echo "Backup completo: $OUT_FILE ($SIZE)"
echo "Restaurar con: ./scripts/restore-db.sh $OUT_FILE"

# Retencion simple: solo conserva los ultimos 14 backups locales para no
# llenar el disco -- Supabase mantiene su propia retencion por separado.
KEEP=14
ls -1t "${DEST_DIR}"/lapa-casa-hostel_*.dump 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm --
