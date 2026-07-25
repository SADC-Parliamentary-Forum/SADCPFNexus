# SADCPF Nexus API

Laravel API for the SADC Parliamentary Forum Paperless System.

## Local / CI

```bash
composer install
cp .env.example .env   # or use .env.testing for PHPUnit
php artisan key:generate
php artisan migrate
php artisan test
```

PHPUnit forces `APP_ENV=testing` and `REQUIRE_PRIVILEGED_MFA=false`. The
`RequireMfaForPrivileged` middleware also no-ops in the testing environment so
security Feature tests never lock out privileged fixtures.

## Production seeding (CRITICAL)

Use structural data only — **never** demo seeders in production:

```bash
php artisan db:seed --class=ProductionSeeder
php artisan app:create-admin
```

`ProductionSeeder` loads tenant, roles/permissions, departments, portfolios,
lookups, asset categories, workflows, and supplier categories. It does **not**
create users.

**Do not run** any of the following in production:

- `php artisan db:seed` (full `DatabaseSeeder`)
- `DemoDataSeeder` / `ComprehensiveDataSeeder` / other demo module seeders
- `php artisan migrate:fresh --seed`

Deploy (`scripts/deploy.sh`) only reseeds `RolesAndPermissionsSeeder` and
`WorkflowSeeder` after migrations.

## Security-related env vars

| Variable | Purpose |
|----------|---------|
| `REQUIRE_PRIVILEGED_MFA` | When true (default in production), System Admin / SG / Finance / HR / Procurement must enable MFA before using the API |
| `EXTERNAL_WORKPLAN_TOKEN` | Shared secret for `GET /api/v1/external/workplan` via `X-External-Token` |
| `SENTRY_LARAVEL_DSN` | Optional. When set **and** `sentry/sentry-laravel` is installed, 5xx exceptions are forwarded. Empty DSN = log-only via `App\Support\Observability` |
| `SENTRY_DSN` | Fallback if `SENTRY_LARAVEL_DSN` is unset |

Do not install the Sentry Composer package until a project DSN exists.

## External workplan feed

`GET /api/v1/external/workplan` accepts either:

1. `X-External-Token: <EXTERNAL_WORKPLAN_TOKEN>`, or
2. Sanctum bearer for a System Admin **or** a user with the `workplan.external`
   permission (ordinary `workplan.view` is not enough).
