# Running SADC PF Nexus via Docker

## Prerequisites

- Docker and Docker Compose
- No hardcoded config: all URLs and secrets come from environment

## First-time setup

1. **Root env (for docker-compose variable substitution)**  
   From repo root:
   ```bash
   cp env.docker.example .env
   ```
   Edit `.env` if you need to change DB password, Redis password, or `NEXT_PUBLIC_API_URL`.

2. **API env (optional)**  
   The API container will create `api/.env` from `api/.env.docker.example` on first run if `api/.env` does not exist. To pre-create it:
   ```bash
   cp api/.env.docker.example api/.env
   ```
   Generate an app key when running outside Docker: `cd api && php artisan key:generate`

## Run the stack

```bash
docker-compose up --build -d
```

- The **php** container entrypoint runs on start: ensures `api/.env` exists, runs `composer install` if needed, `key:generate` if needed, then migrations and seeding (roles, demo tenant, users, travel/leave/imprest/procurement/finance/HR demo data). There is no separate api-setup service; php does not wait on a long-running step, so the stack comes up without blocking.
- **Postgres** is on port 5432, **Redis** on 6380 (host), **API** via nginx on **8000**, **Web** (Next.js) on **3000**.

## URLs

- Web app: http://localhost:3000 (or the port set in `WEB_PORT`, e.g. http://localhost:3001)  
- API base: http://localhost:8000/api/v1  

## Demo logins (after seed)

| Role   | Email             | Password     |
|--------|-------------------|--------------|
| Admin  | admin@sadcpf.org  | Admin@2024!  |
| Staff  | staff@sadcpf.org  | Staff@2024!  |
| HR     | hr@sadcpf.org     | HR@2024!     |
| Finance| finance@sadcpf.org| Finance@2024!|

## Configuration (no hardcoding)

- **Web**: API URL is set via `NEXT_PUBLIC_API_URL` in the root `.env` (default `http://localhost:8000/api/v1`). The browser uses this to call the API.
- **API**: Uses `api/.env` (or env vars passed by Compose): `APP_NAME`, `DB_*`, `REDIS_*`, etc.
- **Mobile**: Build with `--dart-define=API_BASE_URL=https://your-api/api/v1` for production; default is Android emulator host.

## Re-seed database

```bash
docker-compose exec php php artisan db:seed --force
```

## Run migrations only

```bash
docker-compose exec php php artisan migrate --force
```

## PHP 8.4 required

The API uses Composer dependencies that require **PHP >= 8.4**. The Docker image is built from `docker/php/Dockerfile` (PHP 8.4). If you see:

`Your Composer dependencies require a PHP version ">= 8.4.0". You are running 8.3.x`

then the running container is still using an old image. Rebuild and recreate:

```bash
docker compose build php --no-cache
docker compose up -d --force-recreate
```

Run Artisan and Composer **inside** the container (PHP 8.4), not on the host:

```bash
docker compose exec php php artisan ...
docker compose exec php composer ...
```

## "could not translate host name postgres to address"

On some Docker Desktop (Windows) setups, service-name DNS does not work. This project works around that by using **fixed IPs** on the Compose network (subnet `10.20.30.0/24`):

- **postgres:** `10.20.30.2` (php uses this as `DB_HOST`)
- **redis:** `10.20.30.3` (php uses this as `REDIS_HOST`)
- **php:** `10.20.30.4` (nginx connects to this for FastCGI)
- **minio:** `10.20.30.5`
- **meilisearch:** `10.20.30.6`
- **nginx:** `10.20.30.8`
- **web:** `10.20.30.9`

No hostname resolution is needed. If you see "Address already in use", run `docker compose down`, then `docker network prune -f`, then `docker compose up -d` so the network is recreated with the static subnet.

## Orphan container (sadcpf_api_setup)

If you see "Found orphan containers ([sadcpf_api_setup])", that image is from before the api-setup service was removed. Remove it with:

```bash
docker compose down --remove-orphans
docker compose up -d
```

Or remove the container once: `docker rm -f sadcpf_api_setup`

## Port already allocated (e.g. 3000, 6379, 9000)

If Docker reports "Bind for 0.0.0.0:3000 failed: port is already allocated", another process is using that port. Use a different host port via the root `.env`:

- **Web (3000):** `WEB_PORT=3001`
- **Redis (6379):** `REDIS_PORT=6380` (already default in this project)
- **MinIO (9000/9001):** `MINIO_API_PORT=19000` and `MINIO_CONSOLE_PORT=19001` (already default)

Then run `docker compose up -d` again.

## 502 Bad Gateway (nginx)

A 502 means nginx cannot reach the PHP-FPM backend. The **php** container runs composer install, key:generate, migrate and seed in its entrypoint before starting PHP-FPM; if that fails, php may exit or never become healthy.

1. **Check container status**
   ```bash
   docker compose ps -a
   ```
   If `sadcpf_php` is missing, exited, or restarting, run `docker compose logs php` and check for Composer, migration, or Postgres errors.

2. **Ensure api/.env exists** (php reads it; missing file can cause FPM to fail)
   ```bash
   cp api/.env.docker.example api/.env
   docker compose up -d --force-recreate php nginx
   ```
   (php entrypoint creates it from `.env.docker.example` if missing; compose overrides `DB_HOST`/`REDIS_HOST`.)

3. **Restart API stack** (optional)
   ```bash
   docker compose restart php nginx
   ```

## "500 Internal Server Error" for Docker API (e.g. containers/.../json)

If you see a 500 when running `docker compose up` (e.g. "request returned 500 Internal Server Error for API route ... containers/.../json"), this is **Docker Desktop** failing, not the app. It can happen when a container runs a long time (e.g. a step that never completed). In this project the long-running **api-setup** step was removed; **php** now runs composer/migrate/seed in its entrypoint so no service waits 30+ minutes. If you still see the 500:

- Restart Docker Desktop.
- Run `docker compose down` then `docker compose up -d` again.

## "Unsupported cipher or incorrect key length" (APP_KEY)

This happens when Laravel sees an empty or invalid `APP_KEY`. The **php** service does not use `env_file` so that the key generated by the entrypoint (`php artisan key:generate`) is read from `api/.env` on the volume. If you still see this after a fresh up:

1. Ensure the entrypoint ran: `docker compose logs php` should show "Application key set successfully".
2. Regenerate the key and restart:  
   `docker compose exec php php artisan key:generate --force`  
   then `docker compose restart php nginx`.
