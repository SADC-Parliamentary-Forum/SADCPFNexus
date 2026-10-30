#!/usr/bin/env bash
# Restore drill — restore the latest backup into a throwaway database, prove it is
# complete, time it, then drop the throwaway database.
# Never touches the live database. Does NOT invent credentials.
#
# Source: the newest run from scripts/ops/backup.sh ($BACKUP_ROOT/<stamp>/db.dump).
# If there is none, a fresh dump is taken first (without row counts to compare).
#
# Checks:
#   - pg_restore completes with no errors
#   - every table in the backup's row-counts.tsv exists in the restore
#   - each table's restored row count equals the count recorded at backup time
#     (backup.sh takes both from one exported snapshot, so they must match exactly)
#
# Usage (from the app root on the host):
#   bash scripts/ops/restore-drill.sh
set -euo pipefail

[ -f "$HOME/.nexus-backup.env" ] && . "$HOME/.nexus-backup.env"

BACKUP_ROOT="${BACKUP_ROOT:-$HOME/backups/nexus}"
CONTAINER="${POSTGRES_CONTAINER:-sadcpf_postgres}"
DRILL_DB="sadcpfnexus_restore_drill"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

USER_NAME="$(docker exec "$CONTAINER" printenv POSTGRES_USER)"
SOURCE_DB="$(docker exec "$CONTAINER" printenv POSTGRES_DB)"

RUN_DIR="$(ls -1d "$BACKUP_ROOT"/2*/ 2>/dev/null | tail -1 || true)"
RUN_DIR="${RUN_DIR%/}"
if [ -z "$RUN_DIR" ] || [ ! -s "$RUN_DIR/db.dump" ]; then
  echo "==> No backup found under $BACKUP_ROOT; taking a fresh dump of $SOURCE_DB"
  RUN_DIR="${TMPDIR:-/tmp}/nexus-restore-drill-$STAMP"
  mkdir -p "$RUN_DIR"
  docker exec "$CONTAINER" pg_dump -U "$USER_NAME" -d "$SOURCE_DB" -Fc > "$RUN_DIR/db.dump"
fi
echo "==> Using backup $RUN_DIR ($(du -h "$RUN_DIR/db.dump" | cut -f1))"

drop_drill_db() {
  docker exec "$CONTAINER" psql -U "$USER_NAME" -d postgres -qc "DROP DATABASE IF EXISTS $DRILL_DB;" >/dev/null
}
trap drop_drill_db EXIT

echo "==> Creating throwaway database $DRILL_DB"
drop_drill_db
docker exec "$CONTAINER" psql -U "$USER_NAME" -d postgres -qc "CREATE DATABASE $DRILL_DB OWNER $USER_NAME;"

echo "==> Restoring"
START=$(date +%s)
docker exec -i "$CONTAINER" pg_restore -U "$USER_NAME" -d "$DRILL_DB" --no-owner --exit-on-error < "$RUN_DIR/db.dump"
ELAPSED=$(( $(date +%s) - START ))
echo "    restore took ${ELAPSED}s"

echo "==> Counting rows in the restore"
RESTORED="$(mktemp)"
docker exec "$CONTAINER" psql -U "$USER_NAME" -d "$DRILL_DB" -AtF $'\t' -c "
  SELECT table_name,
         (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name" > "$RESTORED"
echo "    $(wc -l < "$RESTORED") tables, $(awk -F'\t' '{s+=$2} END {print s+0}' "$RESTORED") rows"

FAILED=0
if [ -f "$RUN_DIR/row-counts.tsv" ]; then
  echo "==> Comparing with row counts recorded at backup time"
  MISMATCH="$(awk -F'\t' '
    NR==FNR { got[$1]=$2; next }
    !($1 in got) { printf "    MISSING  %s (expected %s rows)\n", $1, $2; next }
    got[$1] != $2 { printf "    DIFFERS  %s: backup %s, restored %s\n", $1, $2, got[$1] }
  ' "$RESTORED" "$RUN_DIR/row-counts.tsv")"
  if [ -n "$MISMATCH" ]; then
    echo "$MISMATCH"
    FAILED=1
  else
    echo "    all $(wc -l < "$RUN_DIR/row-counts.tsv") tables match"
  fi
else
  echo "==> No row-counts.tsv for this backup; skipped comparison"
fi
rm -f "$RESTORED"

echo "==> Drill finished at $STAMP: restore ${ELAPSED}s, $([ "$FAILED" -eq 0 ] && echo PASS || echo MISMATCHES)"
echo "Record the date, backup used and measured duration in docs/ops/backup-restore.md."
echo "This script does not sign the operator checklist."
exit "$FAILED"
