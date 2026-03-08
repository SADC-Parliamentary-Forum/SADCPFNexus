# SADC PF Nexus

Paperless workflow platform for the **SADC Parliamentary Forum**: travel, leave, imprest, procurement, finance (payslips, salary advances), HR (timesheets), programmes (PIF), approvals, and reporting.

## Stack

| Area   | Tech |
|--------|------|
| **Mobile** | Flutter (Riverpod, go_router) — staff/approver app |
| **Web**    | Next.js — admin/desktop |
| **API**    | Laravel (Sanctum, Postgres) — REST API |
| **Infra**  | Docker Compose (postgres, redis, minio, meilisearch, php, nginx, web) |

## Quick start (Docker)

1. From repo root:
   ```bash
   cp env.docker.example .env
   docker-compose up --build -d
   ```
2. **Web:** http://localhost:3000  
3. **API:** http://localhost:8000/api/v1  

Demo logins (after seed): see [DOCKER.md](DOCKER.md).

## Docs

- **[DOCKER.md](DOCKER.md)** — Run stack, env, demo logins, hot-reload, re-seed, troubleshooting.
- **[REMAINING_WORK.md](REMAINING_WORK.md)** — What’s done, optional work, and UI-only/future scope (offline, support, governance, assets, HR).

## Mobile (Flutter)

- **Run (pick a device):**
  - No device / desktop: `cd mobile && flutter run -d chrome` or `flutter run -d windows`
  - Android: `flutter run -d android` (device or emulator)
  - iOS: `flutter run -d ios` (simulator or device)
- Build Android: `flutter build apk` (release signing: configure keystore in `mobile/android/app/build.gradle.kts`; see REMAINING_WORK.md).
- Build web: `flutter build web`. Build Windows: `flutter build windows`.

## API (Laravel)

- Run inside container: `docker-compose exec php php artisan serve` or use nginx on port 8000.
- Migrate: `docker-compose exec php php artisan migrate --force`
- Seed: `docker-compose exec php php artisan db:seed --force`
- Tests: `php artisan test` (feature tests for Auth, Admin, Leave, Travel; require PHP with SQLite for in-memory DB).

## Licence

Proprietary — SADC Parliamentary Forum.
