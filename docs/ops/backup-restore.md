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

## Nightly backup (example)

`scripts/deploy.sh` already creates a pre-deploy DB dump. For scheduled backups on the VPS (as the app user):

```bash
# Example — adjust paths to match CloudPanel layout
BACKUP_DIR=~/backups/nexus
mkdir -p "$BACKUP_DIR"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
docker exec sadcpf_postgres pg_dump -U sadcpf sadcpfnexus | gzip > "$BACKUP_DIR/pg_$STAMP.sql.gz"
# Retain 14 days
find "$BACKUP_DIR" -name 'pg_*.sql.gz' -mtime +14 -delete
```

Object storage: use MinIO `mc mirror` or provider snapshot tooling.

## Restore procedure (Postgres)

1. Put the site in maintenance (stop `web` or show maintenance page).
2. Stop `queue` workers to avoid writes mid-restore.
3. Restore dump into a **new** database name first when possible; cut over after verification.
4. Example restore into existing DB (destructive):

```bash
gunzip -c ~/backups/nexus/pg_YYYYMMDD.sql.gz | docker exec -i sadcpf_postgres psql -U sadcpf sadcpfnexus
```

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

## Local throwaway drill script

From the repository root, with Compose Postgres running (does **not** target production and does **not** tick the checklist below):

```bash
bash scripts/ops/restore-drill.sh
```

| Variable | Default | Purpose |
|----------|---------|---------|
| `POSTGRES_CONTAINER` | `sadcpf_postgres` | Docker container name |
| `POSTGRES_USER` | `sadcpf` | Database role |
| `POSTGRES_DB` | `sadcpfnexus` | Source database to dump |
| `RESTORE_DRILL_DIR` | `/tmp/nexus-restore-drill` | Where the gzipped dump is written |

The script dumps the source database, restores into `sadcpfnexus_restore_drill`, counts `migrations` rows, then drops the throwaway database.

## Drill checklist (operator)

- [ ] Date/time of last successful restore drill
- [ ] Measured RTO / RPO
- [ ] Gaps found (permissions, missing buckets, wrong `.env`)
