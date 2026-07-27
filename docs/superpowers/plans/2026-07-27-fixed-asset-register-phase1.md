# Fixed Asset Register Phase 1 — Implementation Plan

> **For agentic workers:** Use TDD for critical domain rules. Steps use checkbox syntax.

**Goal:** Deliver PRD §113 Phase 1 Fixed Asset lifecycle on top of existing Assets + GRN capitalise handoff, keeping Stock separate.

**Architecture:** Evolve `assets` in place; add policy, history, disposal, verification, maintenance, depreciation-run tables; expand `AssetService` and web Fixed Assets nav.

**Tech Stack:** Laravel API, PHPUnit, Next.js App Router, existing AuditLog / permissions.

**Design:** `docs/superpowers/specs/2026-07-27-fixed-asset-register-design.md`  
**PRD:** `docs/superpowers/specs/2026-07-27-fixed-asset-register-prd.md`  
**Workspace:** `.worktrees/fixed-asset-register` on `feat/fixed-asset-register`

---

## File map

| Path | Responsibility |
|------|----------------|
| `api/database/migrations/2026_07_27_*_fixed_asset_phase1.php` | Schema |
| `api/app/Models/Asset*.php` | Eloquent models |
| `api/app/Modules/Assets/Services/*` | Domain services |
| `api/app/Http/Controllers/Api/V1/Assets/*` | HTTP |
| `api/routes/api.php` | Routes |
| `api/database/seeders/AssetCapitalisationPolicySeeder.php` | Default policy |
| `api/tests/Feature/Assets/*` | Feature tests |
| `web/components/layout/Sidebar.tsx` | Fixed Assets nav |
| `web/app/(app)/assets/**` | UI screens |
| `web/lib/api.ts` | Client types/APIs |

---

### Task 1: Schema + models

- [ ] Migration for policies, locations, histories, disposal, verification, maintenance, depreciation runs; alter `assets`
- [ ] Models + relationships
- [ ] Seeder: active capitalisation policy USD 250; default depreciation rates; sample locations

### Task 2: Capitalisation policy + one-per-unit intake (TDD)

- [ ] Failing tests: threshold classification; qty→N assets; tag unique; serial duplicate
- [ ] `AssetCapitalisationPolicyService`
- [ ] Extend GRN handoff `quantity`
- [ ] Extend capitalise to set `asset_class` from policy

### Task 3: Custody, transfer, return (TDD)

- [ ] Failing tests: assignment history immutable; transfer closes prior; return clears assignee
- [ ] `AssetService` assign/acknowledge/transfer/return
- [ ] Location history on location change

### Task 4: Disposal workflow (TDD)

- [ ] Failing tests: disposal gates; disposed not reassigned; no hard delete
- [ ] `AssetDisposalService` + controller

### Task 5: Verification, maintenance, warranty, depreciation run

- [ ] Services + controllers
- [ ] Depreciation run stores lines; does not post GL

### Task 6: Reports + offboarding check

- [ ] Register export endpoint
- [ ] Outstanding assets by user endpoint (profile/offboarding)

### Task 7: Web Phase 1 UI

- [ ] Expand Fixed Assets sidebar (§5)
- [ ] Dashboard, Register, Intake/Pending, My Assets, Transfers, Verification, Maintenance, Depreciation, Disposal, Reports, Settings
- [ ] Phase 2 stubs: Insurance, Fleet (placeholder pages)

### Task 8: Verify

- [ ] `php artisan test --filter=Asset`
- [ ] Regression: GoodsReceiptHandoffTest, AssetCapitalisationTest
- [ ] Do not commit unless asked
