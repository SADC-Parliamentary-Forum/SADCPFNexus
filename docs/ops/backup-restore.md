# Backup & restore runbook

**Targets (initial — adjust after first drill):**

| Metric | Target | Notes |
|--------|--------|-------|
| RPO | ≤ 24 hours | Nightly Postgres dump + MinIO/object storage snapshots |
| RTO | ≤ 4 hours | Restore DB + restart Compose stack + smoke checks |

These are **planning targets**, not measured SLOs until a restore drill is recorded.

## What to back up

1. **PostgreSQL** — primary source of truth (`sadcpfnexus` / production DB name).
2. **Object storage** — MinIO / S3 buckets for uploads (leave docs, signatures, attachments).
3. **Secrets** — CloudPanel / host `.env` files (API + web). Store offline; never commit.
4. **Compose config** — `docker-compose.yml` + `docker-compose.prod.yml` are in git; server-only overrides are not.

## Nightly backup

`scripts/ops/backup.sh` (run on the host as `sadcpf-nexus`) writes one directory per run under
`~/backups/nexus/<UTC stamp>/`:

| File | Content |
|------|---------|
| `db.dump` | `pg_dump -Fc` of the production database (the dump user is the Postgres superuser, so RLS does not hide rows) |
| `row-counts.tsv` | Exact per-table row counts, taken from the **same exported snapshot** as the dump |
| `storage.tar.gz` | `api/storage/app` (local-disk uploads) |
| `minio.tar.gz` | MinIO data volume, only if `sadcpf_minio` is running |
| `MANIFEST` | Size and sha256 of each file |

Runs older than `RETAIN_DAYS` (default 14) are pruned. `~/backups/nexus/last-success` holds the stamp of the
latest good run. The pre-deploy dumps from `scripts/deploy.sh` (`~/backups/databases/`) are separate and not pruned.

Settings go in `~/.nexus-backup.env` on the host (never committed):

```bash
BACKUP_ROOT=/home/sadcpf-nexus/backups/nexus
RETAIN_DAYS=14
# Offsite copy: any command; the run directory is passed as $1. Unset = local only (logged as a WARNING).
BACKUP_OFFSITE_COMMAND='rclone copy "$1" offsite:sadcpf-nexus-backups/$(basename "$1")'
```

**Offsite is not configured yet.** Until `BACKUP_OFFSITE_COMMAND` is set, every backup lives on the same host as
the database. Choosing the destination (S3-compatible bucket, second server) is an operator decision.

Run it from GitHub → Actions → **Ops — backup & restore drill** (`.github/workflows/ops-backup.yml`):

| Task | Effect |
|------|--------|
| `install-cron` | Installs the nightly entry `30 1 * * *` (server time), logging to `~/backups/nexus/backup.log` |
| `backup` | Takes a backup now |
| `restore-drill` | Restores the latest backup into a throwaway database and compares row counts |
| `status` | Latest run, disk space, recent log lines, installed cron entry |

## Restore procedure (Postgres)

1. Put the site in maintenance (stop `web` or show maintenance page).
2. Stop `queue` workers to avoid writes mid-restore.
3. Restore dump into a **new** database name first when possible; cut over after verification.
4. Restore into a new database, verify, then swap names (the live database is never overwritten in place):

```bash
docker exec sadcpf_postgres psql -U sadcpf -d postgres -c "CREATE DATABASE sadcpfnexus_restored OWNER sadcpf;"
docker exec -i sadcpf_postgres pg_restore -U sadcpf -d sadcpfnexus_restored --no-owner --exit-on-error   < ~/backups/nexus/<STAMP>/db.dump
# verify (row counts vs <STAMP>/row-counts.tsv), stop php/queue/scheduler, then:
docker exec sadcpf_postgres psql -U sadcpf -d postgres   -c "ALTER DATABASE sadcpfnexus RENAME TO sadcpfnexus_old;"   -c "ALTER DATABASE sadcpfnexus_restored RENAME TO sadcpfnexus;"
```

   Pre-deploy dumps (`~/backups/databases/pre-deploy-*.sql.gz`) are plain SQL: restore those with
   `gunzip -c … | docker exec -i sadcpf_postgres psql -U sadcpf sadcpfnexus_restored`.
   Uploaded files: `docker exec -i sadcpf_php tar -C /var/www/api/storage -xzf - < <STAMP>/storage.tar.gz`.

5. Restart `php`, `queue`, `web`.
6. Smoke: `GET /api/v1/auth/ping`, web login, one list endpoint.

## Forbidden on production

- `php artisan migrate:fresh`
- `php artisan db:seed` (full `DatabaseSeeder` / `DemoDataSeeder`)
- Restoring a **demo** dump over production

Production bootstrap after empty DB:

```bash
php artisan migrate --force
php artisan db:seed --class=ProductionSeeder --force
php artisan app:create-admin
php artisan db:seed --class=WorkflowSeeder --force
```

## Restore drill

`scripts/ops/restore-drill.sh` (or the `restore-drill` workflow task) restores the newest `db.dump` into
`sadcpfnexus_restore_drill`, times the restore, compares every table's row count with that backup's
`row-counts.tsv`, then drops the throwaway database. It exits 1 on any missing table or differing count.
If no backup exists yet it takes a fresh dump first (and has nothing to compare against).
It never touches the live database and does **not** tick the checklist below.

## Drill log

| Date (UTC) | Backup used | DB restore | Row check | Gaps found |
|------------|-------------|------------|-----------|------------|
| 2026-10-30 09:09 | Nightly-format run of 2026-10-30 (db.dump 5.4 MB, storage 16 MB, MinIO 2.6 MB) | 22 s | PASS — 627/627 tables, 58,324 rows | No offsite copy (`BACKUP_OFFSITE_COMMAND` unset); file archives not restore-tested; full-stack RTO (maintenance, restart, smoke) not measured |

Run via the `ops-backup.yml` workflow ([backup](https://github.com/SADC-Parliamentary-Forum/SADCPFNexus/actions/runs/41031232365),
[restore-drill](https://github.com/SADC-Parliamentary-Forum/SADCPFNexus/actions/runs/41031320850)). The nightly cron was installed the same day,
so RPO is now ≤ 24 h, for backups on this host only. These are measurements, not operator sign-off.

## Drill checklist (operator)

- [ ] Date/time of last successful restore drill
- [ ] Measured RTO / RPO
- [ ] Gaps found (permissions, missing buckets, wrong `.env`)
