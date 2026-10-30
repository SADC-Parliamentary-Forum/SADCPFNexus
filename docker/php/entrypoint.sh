#!/bin/sh
set -e

# Container roles (CONTAINER_ROLE):
#   app       (default) php-fpm. Dev: migrates on start. Production: refuses to
#             start until the schema is current — run the migrate role first.
#   worker    queue worker; waits for a current schema, never migrates.
#   scheduler Laravel scheduler (schedule:work); waits for a current schema.
#   migrate   one-shot deployment job: `php artisan migrate --force`, exits
#             non-zero on failure so the deployment stops.
#
# Startup flags (defaults depend on APP_ENV):
#   AUTO_MIGRATE  run migrations when the app container starts
#                 (default true outside production, false in production)
#   AUTO_SEED     run `db:seed` (DatabaseSeeder, includes demo data) after migrating
#                 (default true outside production; refused in production —
#                 bootstrap production with `php artisan db:seed --class=ProductionSeeder --force`)

ROLE="${CONTAINER_ROLE:-app}"
APP_ENV_EFFECTIVE="${APP_ENV:-local}"
if [ "$APP_ENV_EFFECTIVE" = "production" ]; then
  AUTO_MIGRATE="${AUTO_MIGRATE:-false}"
  AUTO_SEED="${AUTO_SEED:-false}"
else
  AUTO_MIGRATE="${AUTO_MIGRATE:-true}"
  AUTO_SEED="${AUTO_SEED:-true}"
fi

# ── Shared: export env vars so Laravel can read them in all container roles ──
_export_env() {
  APP_KEY=$(grep '^APP_KEY=' .env 2>/dev/null | cut -d= -f2-)
  export APP_KEY
  REDIS_PASSWORD=$(grep '^REDIS_PASSWORD=' .env 2>/dev/null | cut -d= -f2-)
  if [ -z "$REDIS_PASSWORD" ] || [ "$REDIS_PASSWORD" = "null" ]; then REDIS_PASSWORD=secret; fi
  export REDIS_PASSWORD
}

# Wait for the database; exit the container if it never becomes reachable.
_wait_for_database() {
  set +e
  php artisan schema:check --wait=120 >/dev/null
  status=$?
  set -e
  if [ "$status" -eq 2 ]; then
    echo "[$ROLE] FATAL: database unreachable." >&2
    exit 1
  fi
}

# Block until the schema has no pending migrations; exit non-zero otherwise
# so the orchestrator surfaces the failure instead of serving an old schema.
_require_current_schema() {
  set +e
  php artisan schema:check --wait=120
  status=$?
  set -e
  if [ "$status" -eq 2 ]; then
    echo "[$ROLE] FATAL: database unreachable." >&2
    exit 1
  fi
  if [ "$status" -ne 0 ]; then
    echo "[$ROLE] FATAL: schema is not current. Run the deployment migration job:" >&2
    echo "  docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm migrate" >&2
    exit 1
  fi
}

if [ "$ROLE" = "worker" ]; then
  _export_env
  _require_current_schema
  # OutboxService dispatches notification jobs to named queues; a worker without
  # --queue only drains "default" and would never deliver them.
  QUEUE_NAMES="${QUEUE_NAMES:-notifications-critical,notifications,default,notifications-digest}"
  echo "[queue] Starting queue worker (queues: $QUEUE_NAMES)..."
  exec php artisan queue:work --queue="$QUEUE_NAMES" --sleep=3 --tries=3 --timeout=90 --max-time=3600
fi

if [ "$ROLE" = "scheduler" ]; then
  _export_env
  _require_current_schema
  echo "[scheduler] Starting Laravel scheduler..."
  exec php artisan schedule:work
fi

if [ "$ROLE" = "migrate" ]; then
  _export_env
  _wait_for_database
  echo "[migrate] Running migrations..."
  php artisan migrate --force
  _require_current_schema
  echo "[migrate] Done."
  exit 0
fi

# ── Default role: app (php-fpm + setup) ──────────────────────────────────────

# Ensure .env exists
if [ ! -f .env ]; then
  cp -n .env.docker.example .env 2>/dev/null || cp .env.example .env 2>/dev/null || true
fi
# Install deps and app key so we don't depend on api-setup (avoids long block on first up)
if [ ! -f vendor/autoload.php ]; then
  composer install --no-interaction --prefer-dist
fi
if ! grep -q '^APP_KEY=base64:' .env 2>/dev/null; then
  php artisan key:generate --force || { echo "ERROR: key:generate failed. Ensure .env exists and is writable."; exit 1; }
fi
if ! grep -q '^APP_KEY=base64:' .env 2>/dev/null; then
  echo "ERROR: APP_KEY not set in .env after key:generate. Cannot start."
  exit 1
fi

if [ "$AUTO_SEED" = "true" ] && [ "$APP_ENV_EFFECTIVE" = "production" ]; then
  echo "[app] FATAL: AUTO_SEED=true is not allowed in production (DatabaseSeeder includes demo data)." >&2
  echo "  Bootstrap production explicitly: php artisan db:seed --class=ProductionSeeder --force" >&2
  exit 1
fi

if [ "$AUTO_MIGRATE" = "true" ]; then
  _wait_for_database
  # Errors are no longer suppressed: a failed migration stops the container (set -e).
  php artisan migrate --force
  if [ "$AUTO_SEED" = "true" ]; then
    # Dev demo seeding: report failures loudly but keep the dev stack usable.
    php artisan db:seed --force || echo "[app] WARNING: db:seed failed — demo data may be incomplete." >&2
  fi
fi
_require_current_schema

# Ensure www-data (PHP-FPM worker) can read all source files and write to storage.
# Volume files are owned by the host UID; fix on every start so restarts don't break this.
chmod -R o+rX /var/www/api 2>/dev/null || true
chown -R www-data:www-data storage bootstrap/cache 2>/dev/null || true
chmod -R 755 storage bootstrap/cache 2>/dev/null || true
# Clear config cache so Laravel reads fresh .env (and env) on next request
php artisan config:clear 2>/dev/null || true
# Export APP_KEY so PHP-FPM inherits it; Laravel env() will then see it even if .env/cache is wrong
_export_env
exec docker-php-entrypoint php-fpm
