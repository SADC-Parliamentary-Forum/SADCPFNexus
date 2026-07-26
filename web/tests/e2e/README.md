# Web Playwright E2E

## Prerequisites

1. Seeded API: `cd api && php artisan migrate:fresh --seed` then `php artisan serve` (port **8000**).
2. Web app: `cd web && npm run dev` (port **3000**).
3. Browsers once: `cd web && npx playwright install --with-deps`.

Default base URL is `http://localhost:3000`. Override with `PLAYWRIGHT_BASE_URL`.

Seeded login users (see `tests/e2e/global.setup.ts`):

| Role  | Email             | Password     |
|-------|-------------------|--------------|
| Admin | admin@sadcpf.org  | Admin@2024!  |
| Staff | staff@sadcpf.org  | Staff@2024!  |

Auth storage is written to `playwright/.auth/{admin,staff}.json` by the `setup` project.

## Auth fixture skip policy

If setup cannot authenticate (API down, wrong credentials, empty seed), role fixtures are written empty and the setup step still **passes**. Specs that call `skipWithoutAuth('staff'|'admin')` **skip** instead of failing. Documented in:

- `tests/e2e/helpers/auth.ts`
- `tests/e2e/sa-procurement-smokes.spec.ts`
- `tests/e2e/global.setup.ts` (soft-fail login)

Public routes such as `/tender-notices` do not require fixtures.

## Commands

```bash
cd web

# Full suite
npx playwright test

# Salary Advance + Procurement critical-path smokes only
npm run test:smokes:sa-proc
# equivalent:
npx playwright test tests/e2e/sa-procurement-smokes.spec.ts

# By project
npm run test:staff
npm run test:admin
npm run test:auth

# Remote / documented env
PLAYWRIGHT_BASE_URL=https://your-web-host npx playwright test tests/e2e/sa-procurement-smokes.spec.ts
```

## Smoke coverage (`sa-procurement-smokes.spec.ts`)

1. Salary Advances nav + dashboard/list (staff)
2. Apply/create + eligibility banner area (staff)
3. Procurement list + create (staff)
4. Public `/tender-notices`
5. Procurement settings or register (admin; role-based skip)

These smokes are UI load checks only — no payroll vendor integration and no consolidation enablement.
