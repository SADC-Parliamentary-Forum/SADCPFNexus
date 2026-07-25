# Deploy & rollback

Primary path: [`scripts/deploy.sh`](../../scripts/deploy.sh) on the CloudPanel / Docker Compose host.

## Deploy

```bash
# From the app root on the server (as the unprivileged app user)
./scripts/deploy.sh              # origin/main
./scripts/deploy.sh some-ref     # branch / tag / commit
```

What the script does (aborts on first failure):

1. Pre-flight (repo identity, Compose files, Docker available)
2. Timestamped Postgres dump under `$HOME/backups/databases/pre-deploy-*.sql.gz`
3. Stash / restore server-local files (e.g. `.env`) around a fast-forward pull
4. Composer install (no-dev), `migrate --force`
5. Idempotent `RolesAndPermissionsSeeder` + `WorkflowSeeder` only — **never** full `DatabaseSeeder` / `DemoDataSeeder`
6. Rebuild Laravel caches; restart `php` + `queue`
7. Rebuild `web` (`--no-cache`) and restart it (brief web downtime)
8. Health checks: API `/up` → 200; web `/` → 200 or 307

See also [DOCKER.md](../../DOCKER.md#deploying-to-production-cloudpanel).

## Rollback (code)

Prefer redeploying a known-good ref rather than force-pushing:

```bash
./scripts/deploy.sh <previous-good-sha-or-tag>
```

That still takes a **new** pre-deploy DB backup before changing code. If the bad release only broke the web image / frontend, you can rebuild `web` alone after checking out the good ref (see DOCKER.md manual Compose commands).

## Rollback (database)

Use only when a migration or data write corrupted production and a code-only rollback is insufficient.

1. Put the site in maintenance; stop `queue` workers.
2. Locate the pre-deploy dump printed by the failed/bad deploy (`Backup for this deploy: …`).
3. Follow [backup-restore.md](./backup-restore.md) restore steps (prefer restore into a new DB name, verify, then cut over).
4. Redeploy the matching code ref with `./scripts/deploy.sh <ref>`.
5. Smoke: `GET /api/v1/auth/ping`, web login, one list endpoint.

## Forbidden during rollback

- `php artisan migrate:fresh`
- Full `db:seed` / `DemoDataSeeder`
- Force-pushing `main` from the server
- Restoring a **demo** dump over production

## Notes

- Blue/green cutover is **out of Slice 1** — documented as future work in [REMAINING_WORK.md](../../REMAINING_WORK.md).
- Measured RTO/RPO require a restore drill; targets are in [backup-restore.md](./backup-restore.md).
