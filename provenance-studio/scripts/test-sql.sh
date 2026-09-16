#!/usr/bin/env bash
# Exécute les migrations puis test/sql/rls.sql sur un Postgres local.
#   DATABASE_URL=postgres://… npm run test:sql   → utilise cette base (vide !)
#   npm run test:sql                              → démarre un cluster temporaire
#                                                   (nécessite initdb/pg_ctl)
set -euo pipefail
cd "$(dirname "$0")/.."

# initdb refuse de tourner en root : on se rabat sur l'utilisateur postgres.
if [ -z "${DATABASE_URL:-}" ] && [ "$(id -u)" = "0" ] && id postgres >/dev/null 2>&1; then
  exec runuser -u postgres -- bash "$0" "$@"
fi

PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)}"
TMP=""

cleanup() {
  if [ -n "$TMP" ]; then
    "$PG_BIN/pg_ctl" -D "$TMP/data" stop -m immediate >/dev/null 2>&1 || true
    rm -rf "$TMP"
  fi
}
trap cleanup EXIT

if [ -z "${DATABASE_URL:-}" ]; then
  if [ -z "$PG_BIN" ] || [ ! -x "$PG_BIN/initdb" ]; then
    echo "Postgres introuvable : définissez DATABASE_URL ou PG_BIN." >&2
    exit 1
  fi
  TMP="$(mktemp -d)"
  PORT="${PGPORT_TEST:-54329}"
  "$PG_BIN/initdb" -D "$TMP/data" -U postgres --auth=trust >/dev/null
  "$PG_BIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -w start >/dev/null
  DATABASE_URL="postgresql://postgres@/postgres?host=$TMP&port=$PORT"
  psql "$DATABASE_URL" -q -c "create database provenance_test;"
  DATABASE_URL="postgresql://postgres@/provenance_test?host=$TMP&port=$PORT"
fi

psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -f test/sql/supabase-stubs.sql
for f in supabase/migrations/*.sql; do
  echo "→ $f"
  psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -f "$f"
done
psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -f test/sql/rls.sql
