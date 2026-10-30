# AGENTS.md

## Cursor Cloud specific instructions

Monorepo: `api/` (Laravel 12 / PHP 8.4 REST API), `web/` (Next.js 16 admin/staff portal), `mobile/` (Flutter 3.29 app). `web` and `mobile` are pure clients of the `api`. See `README.md` and `DOCKER.md` for the product overview, demo logins, and standard commands.

### Pre-installed toolchain (baked into the environment)
PHP 8.4 (+pgsql, mbstring, xml, bcmath, redis, imap, gd, intl, zip, sqlite3), Composer, Node 22 + npm, PostgreSQL 16, Redis, and Flutter 3.29.3 (at `$HOME/flutter`, on `PATH` via `~/.bashrc`). The startup update script only refreshes project dependencies (`composer install`, `npm ci`, `flutter pub get`) — it does NOT install system packages or start services.

### Services are NOT auto-started on boot — start them manually
```bash
sudo service postgresql start
sudo service redis-server start
```
PostgreSQL data (including seeded demo data) persists across sessions. DB role `sadcpf` / password `secret`; databases `sadcpfnexus` (dev) and `sadcpfnexus_test` (feature tests). If the dev DB is empty or you need fresh demo data: `cd api && php artisan migrate:fresh --seed --force`.

### API (Laravel) — `api/`
- `api/.env` is generated from `.env.docker.example` with `DB_HOST`/`REDIS_HOST=127.0.0.1` and `REDIS_PASSWORD=null`. Gotcha: in a raw `.env` file the `TIMESHEET_PROJECTS` value MUST be quoted (the example ships it unquoted because docker-compose passes it as an env var, not via dotenv parsing). Unquoted, `php artisan` fails with "Encountered unexpected whitespace".
- Run: `php artisan serve --host=127.0.0.1 --port=8000` (health check: `http://localhost:8000/up`, API base: `http://localhost:8000/api/v1`).
- Tests: `php artisan test` (uses `api/.env.testing`, DB `sadcpfnexus_test`). Lint: `./vendor/bin/pint --test <paths>`. The tree is not fully Pint-clean historically; CI only enforces Pint on files changed vs base (see `.github/workflows/api.yml`).

### Web (Next.js) — `web/`
- Run: `cd web && npm run dev` → `http://localhost:3000`. The browser calls `/api/*`, which Next rewrites to `API_INTERNAL_URL` (default `http://localhost:8000/api/v1`) — so the API must be running on port 8000. No `web/.env` file is needed for local dev.
- Typecheck: `npx tsc --noEmit`. Build: `npm run build`. E2E: `npx playwright install chromium --with-deps` once, then `npx playwright test --project=<auth|staff|admin>` with the API+web servers running and DB seeded (see `web/playwright.config.ts`).
- `next dev` regenerates `web/AGENTS.md` and `web/CLAUDE.md` (Next.js 16 agent files) as untracked files — this is expected framework behavior.

### Mobile (Flutter) — `mobile/`
- Requires Flutter >= 3.29 / Dart >= 3.7 per the committed `mobile/pubspec.lock` (`drift_flutter` needs Dart >= 3.5). CI (`.github/workflows/mobile.yml`) pins 3.29.3.
- After `flutter pub get`, run codegen before analyze/test/run: `dart run build_runner build --delete-conflicting-outputs` (json_serializable, hive, drift).
- Analyze: `flutter analyze`. Tests: `flutter test`. Run on web: `flutter run -d web-server --web-port <port>` (no Android/iOS toolchain installed).

### Known pre-existing test issues (verified 2026-10-27)
- The two previously listed failures (`ExternalWorkplanAuthTest::test_workplan_view_alone…`, mobile `formatSaCurrency` NAD) now pass.
- Web `npm run test:unit`: 12 static UI-convention checks fail on `HEAD` as well (e.g. `native window.alert…`, `operational … gold chrome`, Procurement sidebar child count).
- `next build` refuses to run on a Next.js version with a published security advisory (`SecurityFatalError`); keep `next` patched (16.4.3 as of 2026-10-27).
- A single-process `php artisan test` over the whole suite can exhaust a 512 MB `memory_limit` in dompdf-heavy tests; run with `php -d memory_limit=2G artisan test`.
- `RefreshDatabase` re-running `migrate:fresh` on an already-populated test DB can exceed PostgreSQL's default `max_locks_per_transaction` (~600 tables); raise it (e.g. 1024) or use a freshly created empty test database.

### Operations notes
- `php artisan schema:check` (exit 0 current / 1 pending / 2 unreachable) gates container start; production migrates via `scripts/deploy.sh` or `docker compose … run --rm migrate`, never on start.
- `php artisan ops:health` reports scheduler heartbeat, DB, queues, notification backlog and storage (exit 0/1/2). The scheduler service is behind the `scheduler` Compose profile in production.
