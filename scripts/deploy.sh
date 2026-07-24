#!/usr/bin/env bash
#
# Production deploy script for SADC PF Nexus (CloudPanel / Docker Compose host).
#
# What it does, in order:
#   1. Verifies it's running from the correct app directory on the correct branch
#   2. Takes a timestamped Postgres backup
#   3. Stashes any server-local uncommitted changes (e.g. .env) so `git pull` is clean
#   4. Fast-forwards to the requested ref (default: origin/main)
#   5. Restores the stashed local changes
#   6. Installs Composer dependencies (no-dev, optimized autoload)
#   7. Runs pending migrations
#   8. Reseeds roles/permissions only (idempotent — never touches demo/user data)
#   9. Clears + rebuilds Laravel config/route caches, restarts php + queue containers
#  10. Rebuilds the web (Next.js) image with --no-cache and restarts it
#  11. Runs post-deploy health checks and reports pass/fail
#
# Safety notes:
#   - Refuses to run outside a git repo whose remote matches SADCPFNexus, to avoid
#     being copy-pasted onto the wrong host/app by mistake.
#   - Never runs `db:seed` (full) or `migrate:fresh` — those touch demo/user data
#     and are explicitly out of scope for a production deploy.
#   - Never echoes the contents of .env or any secret.
#   - Uses `set -euo pipefail` so any failed step aborts the script rather than
#     silently continuing into a half-deployed state.
#   - The web container is briefly down during its rebuild (documented, existing
#     behavior — see DOCKER.md). The API stays up throughout.
#
# Usage:
#   ./scripts/deploy.sh                 # deploy origin/main
#   ./scripts/deploy.sh some-other-ref  # deploy a specific branch/tag/ref
#
# Run this FROM the app directory on the server (e.g.
# ~/htdocs/nexus.sadcpf.org/app), as the app's own unprivileged user — it does
# not require and will not attempt to use sudo.

set -euo pipefail

REF="${1:-origin/main}"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
BACKUP_DIR="$HOME/backups/databases"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$1"; }
die() { printf '\n\033[1;31mERROR:\033[0m %s\n' "$1" >&2; exit 1; }

# --- 1. Sanity checks -------------------------------------------------------

[ -f "docker-compose.yml" ] && [ -f "docker-compose.prod.yml" ] \
  || die "Must be run from the app root (docker-compose.yml not found here)."

git remote get-url origin 2>/dev/null | grep -qi "SADCPFNexus" \
  || die "This doesn't look like the SADCPFNexus repo (check 'git remote -v')."

command -v docker >/dev/null || die "docker not found on PATH."
docker compose version >/dev/null 2>&1 || die "docker compose plugin not available."

log "Pre-flight checks passed. Deploying ref: $REF"

# --- 2. Backup the database before touching anything ------------------------

log "Backing up database to $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"
DB_USER="$(docker exec sadcpf_postgres printenv POSTGRES_USER)"
DB_NAME="$(docker exec sadcpf_postgres printenv POSTGRES_DB)"
BACKUP_FILE="$BACKUP_DIR/pre-deploy-$TIMESTAMP.sql.gz"
docker exec sadcpf_postgres pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$BACKUP_FILE"
[ -s "$BACKUP_FILE" ] || die "Backup file is empty — aborting before touching the database."
log "Backup OK: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# --- 3-5. Stash local state, pull, restore local state -----------------------

log "Stashing server-local changes (.env, etc.) before pulling"
STASHED=0
if ! git diff --quiet || ! git diff --cached --quiet; then
  git stash push -u -m "deploy.sh pre-pull ($TIMESTAMP)"
  STASHED=1
fi

log "Fetching and fast-forwarding to $REF"
git fetch origin
git merge --ff-only "$REF" \
  || die "Fast-forward failed — the server branch has diverged from $REF. Resolve manually, do not force-push here."

if [ "$STASHED" -eq 1 ]; then
  log "Restoring server-local changes"
  git stash pop
fi

[ -f ".env" ] || die ".env is missing after deploy — restore it from backup before continuing."

# --- 6-9. API: dependencies, migrations, permissions, caches, restart -------

log "Installing Composer dependencies (no-dev)"
docker exec sadcpf_php composer install --no-dev --optimize-autoloader --no-interaction

log "Running pending migrations"
docker exec sadcpf_php php artisan migrate --force

log "Reseeding roles/permissions + workflows (idempotent, no demo/user data touched)"
docker exec sadcpf_php php artisan db:seed --class="Database\\Seeders\\RolesAndPermissionsSeeder" --force
docker exec sadcpf_php php artisan db:seed --class="Database\\Seeders\\WorkflowSeeder" --force

log "Rebuilding Laravel caches"
docker exec sadcpf_php php artisan config:clear
docker exec sadcpf_php php artisan route:clear
docker exec sadcpf_php php artisan view:clear
docker exec sadcpf_php php artisan config:cache
docker exec sadcpf_php php artisan route:cache

log "Restarting php + queue containers"
$COMPOSE restart php queue

# FPM can take >3s after restart before the healthcheck flips to healthy.
for i in $(seq 1 30); do
  if docker ps --filter name=sadcpf_php --format '{{.Status}}' | grep -qi healthy; then
    break
  fi
  sleep 2
done
docker ps --filter name=sadcpf_php --format '{{.Status}}' | grep -qi healthy \
  || die "php container did not report healthy after restart — check 'docker logs sadcpf_php'."

# --- 10. Web: rebuild and restart -------------------------------------------

log "Stopping web container for rebuild"
$COMPOSE stop web

log "Rebuilding web image (--no-cache) — this can take several minutes"
$COMPOSE build --no-cache web

log "Starting web container"
$COMPOSE up -d web

sleep 5

# --- 11. Post-deploy health checks ------------------------------------------

log "Running health checks"

API_STATUS=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8000/up || echo "000")
WEB_STATUS=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ || echo "000")

echo "  API  (/up):  HTTP $API_STATUS"
echo "  Web  (/):    HTTP $WEB_STATUS"

if [ "$API_STATUS" != "200" ]; then
  die "API health check failed (expected 200, got $API_STATUS). Check 'docker logs sadcpf_php'. Database backup is at $BACKUP_FILE if rollback is needed."
fi

# Web root correctly 307s to /login when unauthenticated — that's healthy, not a failure.
if [ "$WEB_STATUS" != "200" ] && [ "$WEB_STATUS" != "307" ]; then
  die "Web health check failed (expected 200 or 307, got $WEB_STATUS). Check 'docker logs sadcpf_web'."
fi

log "Deploy complete. Now at $(git rev-parse --short HEAD) ($(git log -1 --format=%s))"
echo "Backup for this deploy: $BACKUP_FILE"
