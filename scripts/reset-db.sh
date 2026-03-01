#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
SEEDS_DIR="${ROOT_DIR}/db/seeds"

if [ -f "${ENV_FILE}" ]; then
  set -a
  source "${ENV_FILE}"
  set +a
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found. Please install PostgreSQL client tools."
  exit 1
fi

if [ -z "${POSTGRES_DB:-}" ] || [ -z "${POSTGRES_USER:-}" ] || [ -z "${DATABASE_URL:-}" ]; then
  echo "POSTGRES_DB, POSTGRES_USER, and DATABASE_URL must be set."
  exit 1
fi

psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

"${ROOT_DIR}/scripts/apply-migrations.sh"

for file in "${SEEDS_DIR}"/*.sql; do
  [ -e "${file}" ] || continue
  echo "Applying seed ${file}"
  psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${file}"
done

echo "Database reset complete."
