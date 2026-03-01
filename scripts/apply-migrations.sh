#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
MIGRATIONS_DIR="${ROOT_DIR}/db/migrations"

if [ -f "${ENV_FILE}" ]; then
  set -a
  source "${ENV_FILE}"
  set +a
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found. Please install PostgreSQL client tools."
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set."
  exit 1
fi

for file in "${MIGRATIONS_DIR}"/*.sql; do
  echo "Applying ${file}"
  psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${file}"
done

echo "Migrations applied successfully."
