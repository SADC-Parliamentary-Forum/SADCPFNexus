#!/bin/sh
set -e
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
# Clear config cache so Laravel reads fresh .env (and env) on next request
php artisan config:clear 2>/dev/null || true
# Export APP_KEY so PHP-FPM inherits it; Laravel env() will then see it even if .env/cache is wrong
APP_KEY=$(grep '^APP_KEY=' .env | cut -d= -f2-)
export APP_KEY
# Export REDIS_PASSWORD so Laravel can authenticate to Redis (session/cache/queue)
REDIS_PASSWORD=$(grep '^REDIS_PASSWORD=' .env | cut -d= -f2-)
if [ -z "$REDIS_PASSWORD" ] || [ "$REDIS_PASSWORD" = "null" ]; then REDIS_PASSWORD=secret; fi
export REDIS_PASSWORD
exec docker-php-entrypoint php-fpm
