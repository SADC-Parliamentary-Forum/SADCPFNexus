#!/bin/sh
set -e

# ── Shared: export env vars so Laravel can read them in all container roles ──
_export_env() {
  APP_KEY=$(grep '^APP_KEY=' .env 2>/dev/null | cut -d= -f2-)
  export APP_KEY
  REDIS_PASSWORD=$(grep '^REDIS_PASSWORD=' .env 2>/dev/null | cut -d= -f2-)
  if [ -z "$REDIS_PASSWORD" ] || [ "$REDIS_PASSWORD" = "null" ]; then REDIS_PASSWORD=secret; fi
  export REDIS_PASSWORD
}

# ── CONTAINER_ROLE=worker → queue worker (php service already handles setup) ──
if [ "${CONTAINER_ROLE:-app}" = "worker" ]; then
  _export_env
  echo "[queue] Starting queue worker..."
  exec php artisan queue:work --sleep=3 --tries=3 --timeout=90 --max-time=3600
fi

# ── Default role: app (php-fpm + full setup) ─────────────────────────────────

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
# Run migrations and seed from this container (on same network as postgres)
migrate_ok=0
for i in 1 2 3 4 5 6 7 8 9 10; do
  if php artisan migrate --force 2>/dev/null; then
    migrate_ok=1
    break
  fi
  echo "Waiting for postgres... (attempt $i/10)"
  sleep 6
done
if [ "$migrate_ok" -eq 1 ]; then
  php artisan db:seed --force 2>/dev/null || true
fi
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
