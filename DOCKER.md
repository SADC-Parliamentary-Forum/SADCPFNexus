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

- **API setup** runs once: installs Composer deps, runs migrations, seeds the database (roles, demo tenant, users, travel/leave/imprest/procurement/finance/HR demo data).
- **Postgres** is on port 5432, **Redis** on 6379, **API** via nginx on **8000**, **Web** (Next.js) on **3000**.

## URLs

- Web app: http://localhost:3000  
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
