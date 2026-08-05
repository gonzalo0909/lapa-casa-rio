#!/usr/bin/env bash
# lapa-casa-hostel/scripts/restore-db.sh
# ventana6
#
# Restaura un backup generado por backup-db.sh. DESTRUCTIVO -- sobrescribe
# datos existentes en la base de destino. Pide confirmacion explicita
# salvo que se pase --force (para uso en un pipeline no interactivo,
# usar con mucho cuidado y nunca contra el Supabase real de produccion
# sin haber confirmado el DATABASE_URL de destino primero).
#
# Uso:
#   DATABASE_URL="postgresql://...destino..." ./scripts/restore-db.sh backups/lapa-casa-hostel_20260803T120000Z.dump

set -euo pipefail

DUMP_FILE="${1:-}"
FORCE="${2:-}"

if [[ -z "$DUMP_FILE" || ! -f "$DUMP_FILE" ]]; then
  echo "Uso: $0 <archivo.dump> [--force]" >&2
  exit 1
fi

DATABASE_URL="${DATABASE_URL:-}"
if [[ -z "$DATABASE_URL" ]]; then
  echo "Falta DATABASE_URL (la base de DESTINO -- verificar dos veces que es la correcta)." >&2
  exit 1
fi

if ! command -v pg_restore >/dev/null 2>&1; then
  echo "pg_restore no esta instalado. Instalar postgresql-client." >&2
  exit 1
fi

# Se muestra el host (sin credenciales) para que quede clarisimo contra
# que base va a correr esto antes de confirmar.
TARGET_HOST=$(echo "$DATABASE_URL" | sed -E 's#.*@([^/]+)/.*#\1#')
echo "Destino: $TARGET_HOST"
echo "Archivo: $DUMP_FILE"

if [[ "$FORCE" != "--force" ]]; then
  read -r -p "Esto SOBRESCRIBE datos existentes en '$TARGET_HOST'. Escribir el host para confirmar: " CONFIRM_HOST
  if [[ "$CONFIRM_HOST" != "$TARGET_HOST" ]]; then
    echo "Confirmacion no coincide. Cancelado." >&2
    exit 1
  fi
fi

echo "Restaurando..."
pg_restore \
  --dbname="$DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --verbose \
  "$DUMP_FILE"

echo "Restauracion completa. Verificar con ./scripts/health-check.sh"
