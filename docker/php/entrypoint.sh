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
  php artisan key:generate --force 2>/dev/null || true
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
exec docker-php-entrypoint php-fpm
