#!/usr/bin/env bash
#
# Nightly backup for SADC PF Nexus (production host, run as sadcpf-nexus).
#
# Each run writes one directory under $BACKUP_ROOT/<UTC stamp>/ containing:
#   db.dump          pg_dump custom format (restore with pg_restore; see restore-drill.sh)
#   storage.tar.gz   api/storage/app (local-disk uploads: attachments, signatures, photos)
#   minio.tar.gz     MinIO data volume, only when the sadcpf_minio container exists
#   row-counts.tsv   exact per-table row counts taken right after the dump
#   MANIFEST         sizes + sha256 of every file above
# then prunes runs older than $RETAIN_DAYS and, if configured, ships the run offsite.
#
# Optional settings live in $HOME/.nexus-backup.env (never committed), e.g.
#   BACKUP_ROOT=/home/sadcpf-nexus/backups/nexus
#   RETAIN_DAYS=14
#   BACKUP_OFFSITE_COMMAND='rclone copy "$1" b2:sadcpf-nexus-backups/$(basename "$1")'
# BACKUP_OFFSITE_COMMAND is run with the run directory as $1. A failed offsite step
# fails the run (exit 1) but keeps the local copy.
#
# Usage:
#   bash scripts/ops/backup.sh            # take a backup now
#   bash scripts/ops/backup.sh --status   # show the latest run and what is on disk
#
# Cron (installed by .github/workflows/ops-backup.yml, task=install-cron):
#   30 1 * * * cd <app dir> && bash scripts/ops/backup.sh >> $HOME/backups/nexus/backup.log 2>&1

set -euo pipefail

[ -f "$HOME/.nexus-backup.env" ] && . "$HOME/.nexus-backup.env"

BACKUP_ROOT="${BACKUP_ROOT:-$HOME/backups/nexus}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"
PG_CONTAINER="${POSTGRES_CONTAINER:-sadcpf_postgres}"
PHP_CONTAINER="${PHP_CONTAINER:-sadcpf_php}"
MINIO_CONTAINER="${MINIO_CONTAINER:-sadcpf_minio}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RUN_DIR="$BACKUP_ROOT/$STAMP"

log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$1"; }
die() { log "ERROR: $1" >&2; exit 1; }

mkdir -p "$BACKUP_ROOT"

if [ "${1:-}" = "--status" ]; then
  echo "Backup root: $BACKUP_ROOT"
  if [ -f "$BACKUP_ROOT/last-success" ]; then
    echo "Last success: $(cat "$BACKUP_ROOT/last-success")"
  else
    echo "Last success: never"
  fi
  ls -1d "$BACKUP_ROOT"/2*/ 2>/dev/null | tail -5 | while read -r d; do
    echo "  $(du -sh "$d" | cut -f1)  $d"
  done
  df -h "$BACKUP_ROOT" | tail -1
  exit 0
fi

# Never let two runs (cron + manual) write at the same time.
exec 9>"$BACKUP_ROOT/.lock"
flock -n 9 || die "another backup is already running"

mkdir -p "$RUN_DIR"
trap 'rc=$?; [ $rc -ne 0 ] && log "backup FAILED (exit $rc); partial run left in $RUN_DIR"' EXIT

DB_USER="$(docker exec "$PG_CONTAINER" printenv POSTGRES_USER)"
DB_NAME="$(docker exec "$PG_CONTAINER" printenv POSTGRES_DB)"

# Hold one REPEATABLE READ transaction open and export its snapshot, so the dump and
# the row counts see exactly the same data (restore-drill.sh compares them).
coproc PSQL { docker exec -i "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -qAtX -F $'\t'; }
echo "BEGIN ISOLATION LEVEL REPEATABLE READ; SELECT pg_export_snapshot();" >&"${PSQL[1]}"
read -r -t 60 SNAPSHOT <&"${PSQL[0]}" || die "could not export a database snapshot"
SNAPSHOT="${SNAPSHOT%$'\r'}"

# The dump user is the image superuser, which bypasses RLS, so every row is included.
log "dumping database $DB_NAME (snapshot $SNAPSHOT)"
docker exec "$PG_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc -Z 6 --snapshot="$SNAPSHOT" > "$RUN_DIR/db.dump"
[ -s "$RUN_DIR/db.dump" ] || die "database dump is empty"
docker exec -i "$PG_CONTAINER" pg_restore --list < "$RUN_DIR/db.dump" > /dev/null \
  || die "database dump is not readable by pg_restore"

log "recording per-table row counts from the same snapshot"
cat >&"${PSQL[1]}" <<'SQL'
SELECT table_name,
       (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
\echo __END__
SQL
: > "$RUN_DIR/row-counts.tsv"
while IFS= read -r -t 600 line <&"${PSQL[0]}"; do
  line="${line%$'\r'}"
  [ "$line" = "__END__" ] && break
  printf '%s\n' "$line" >> "$RUN_DIR/row-counts.tsv"
done
[ "$line" = "__END__" ] || die "row count query did not finish"
printf 'COMMIT;\n\\q\n' >&"${PSQL[1]}"
wait "$PSQL_PID" 2>/dev/null || true
[ -s "$RUN_DIR/row-counts.tsv" ] || die "no row counts recorded"

log "archiving api/storage/app"
docker exec "$PHP_CONTAINER" tar -C /var/www/api/storage -czf - app > "$RUN_DIR/storage.tar.gz"
gzip -t "$RUN_DIR/storage.tar.gz" || die "storage archive is corrupt"

if docker ps --format '{{.Names}}' | grep -qx "$MINIO_CONTAINER"; then
  log "archiving MinIO data volume"
  docker run --rm --volumes-from "$MINIO_CONTAINER:ro" alpine:3.20 tar -C /data -czf - . > "$RUN_DIR/minio.tar.gz"
  gzip -t "$RUN_DIR/minio.tar.gz" || die "MinIO archive is corrupt"
fi

(
  cd "$RUN_DIR"
  for f in db.dump storage.tar.gz minio.tar.gz row-counts.tsv; do
    [ -f "$f" ] && printf '%s\t%s\t%s\n' "$(stat -c %s "$f")" "$(sha256sum "$f" | cut -d' ' -f1)" "$f"
  done
) > "$RUN_DIR/MANIFEST"

log "pruning runs older than $RETAIN_DAYS days"
find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -name '2*' -mtime +"$RETAIN_DAYS" -exec rm -rf {} +

if [ -n "${BACKUP_OFFSITE_COMMAND:-}" ]; then
  log "shipping offsite"
  bash -c "$BACKUP_OFFSITE_COMMAND" _ "$RUN_DIR" || die "offsite copy failed (local copy kept in $RUN_DIR)"
else
  log "WARNING: BACKUP_OFFSITE_COMMAND not set; this backup exists only on this host"
fi

echo "$STAMP" > "$BACKUP_ROOT/last-success"
log "backup OK: $RUN_DIR ($(du -sh "$RUN_DIR" | cut -f1))"
cat "$RUN_DIR/MANIFEST"
