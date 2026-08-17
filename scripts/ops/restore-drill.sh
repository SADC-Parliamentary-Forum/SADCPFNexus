#!/usr/bin/env bash
# Restore drill — dump, restore into a throwaway database, smoke-check, drop.
# Does NOT run against production. Does NOT invent credentials.
# Usage (from repo root, with compose Postgres up):
#   bash scripts/ops/restore-drill.sh
set -euo pipefail

CONTAINER="${POSTGRES_CONTAINER:-sadcpf_postgres}"
USER_NAME="${POSTGRES_USER:-sadcpf}"
SOURCE_DB="${POSTGRES_DB:-sadcpfnexus}"
DRILL_DB="sadcpfnexus_restore_drill"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORKDIR="${RESTORE_DRILL_DIR:-${TMPDIR:-/tmp}/nexus-restore-drill}"
DUMP="$WORKDIR/pg_$STAMP.sql.gz"

mkdir -p "$WORKDIR"
echo "==> Dumping $SOURCE_DB from $CONTAINER"
docker exec "$CONTAINER" pg_dump -U "$USER_NAME" "$SOURCE_DB" | gzip > "$DUMP"
ls -lh "$DUMP"

echo "==> Creating throwaway database $DRILL_DB"
docker exec "$CONTAINER" psql -U "$USER_NAME" -d postgres -c "DROP DATABASE IF EXISTS $DRILL_DB;"
docker exec "$CONTAINER" psql -U "$USER_NAME" -d postgres -c "CREATE DATABASE $DRILL_DB OWNER $USER_NAME;"

echo "==> Restoring dump into $DRILL_DB"
gunzip -c "$DUMP" | docker exec -i "$CONTAINER" psql -U "$USER_NAME" "$DRILL_DB" >/dev/null

echo "==> Smoke: migrations table exists"
docker exec "$CONTAINER" psql -U "$USER_NAME" -d "$DRILL_DB" -c "SELECT COUNT(*) AS migration_rows FROM migrations;"

echo "==> Dropping throwaway database"
docker exec "$CONTAINER" psql -U "$USER_NAME" -d postgres -c "DROP DATABASE $DRILL_DB;"

echo "==> Drill completed at $STAMP"
echo "Record date, dump path ($DUMP), and measured duration in docs/ops/backup-restore.md"
echo "This script does not sign the operator checklist."
