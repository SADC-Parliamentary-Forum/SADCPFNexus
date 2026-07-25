# Salary Advance Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close Salary Advance demo/policy gaps: enriched eligibility + outstanding exposure blocking, deduction authority, formal Finance certify, payment + full-EOM recovery via BCRE ledger, employee transparency, FORM-002 PDF — under current “one advance, full repayment” policy.

**Architecture:** Extend existing `SalaryAdvanceRequest` + `/finance/advances` + `BalanceRegisterService` (BCRE). Add policy versions and finance review rows. Do not greenfield a parallel module. Multi-month instalments stay disabled under policy v1.

**Tech Stack:** Laravel API, BCRE, WorkflowService, DomPDF (Barryvdh), Next.js App Router web, PHPUnit (+ Playwright smoke where routes exist).

**Spec:** `docs/superpowers/specs/2026-07-25-salary-advance-design.md`

---

## Assumptions / Decisions (locked 2026-07-25)

| # | Decision |
|---|----------|
| 1 | **Salary basis:** v1 uses **confirmed / applicable monthly net** (`net_confirmed`). Snapshot net on submit. Gross/basic = future policy options only. |
| 2 | **Workflow:** Finance-first (no Supervisor). |
| 3 | **Principal:** Retain Principal/Senior Admin review; **ON by default** (`admin_review_required=true`). Finance certify → Director → SG. |
| 4 | **BCRE:** Create register on **payment**, not approve. |
| 5 | **Scope:** B Phase 1 — implement now. |
| 6 | **Permissions:** Separate `salary_advance.*`; seed roles; keep `finance.*` fallbacks for compatibility. |

**Do not commit** unless the user explicitly asks — prefer uncommitted changes for parent review.

---

## File map (Phase 1)

| Area | Create / Modify |
|------|-----------------|
| Policy | Migration + `SalaryAdvancePolicyVersion` model + seeder |
| Schema | Migration extend `salary_advance_requests`; create `salary_advance_finance_reviews` |
| Domain service | Create `api/app/Modules/Finance/Services/SalaryAdvanceService.php` |
| Controller | Modify `SalaryAdvanceController` — certify, payment, recovery, ledger, pdf, queues |
| BCRE | Modify `BalanceRegisterService` / model hooks — register on payment, not approve |
| Workflow | Modify `WorkflowSeeder` salary_advance steps: Director → SG |
| Permissions | Modify `RolesAndPermissionsSeeder` — `salary_advance.*` |
| PDF | Create `resources/views/pdf/salary_advance_form_002.blade.php` |
| Routes | Modify `api/routes/api.php` |
| Web API client | Modify `web/lib/api.ts` |
| Web UI | Modify advances list/create/detail; add certify + payment/recovery actions |
| Notifications | Fix deep link `/finance/advances/{id}` |
| Tests | Extend/create Finance salary advance lifecycle tests |

---

### Task 1: Policy versions table + seed v1

**Files:**
- Create: `api/database/migrations/2026_07_25_140000_create_salary_advance_policy_versions_table.php`
- Create: `api/app/Models/SalaryAdvancePolicyVersion.php`
- Create: `api/database/seeders/SalaryAdvancePolicySeeder.php`
- Test: `api/tests/Feature/Finance/SalaryAdvancePolicyTest.php`

- [ ] **Step 1: Write failing test** — active policy returns 50% / concurrent 1 / full_eom / **net_confirmed** / **admin_review_required=true**

```php
public function test_active_policy_v1_seeded(): void
{
    $this->seed(\Database\Seeders\SalaryAdvancePolicySeeder::class);
    $p = \App\Models\SalaryAdvancePolicyVersion::query()->where('active', true)->first();
    $this->assertNotNull($p);
    $this->assertEquals(50, (float) $p->max_salary_percentage);
    $this->assertEquals(1, (int) $p->max_concurrent_advances);
    $this->assertTrue((bool) $p->full_repayment_required);
    $this->assertEquals('full_eom', $p->recovery_rule);
    $this->assertEquals('net_confirmed', $p->salary_basis);
    $this->assertTrue((bool) $p->admin_review_required);
    $this->assertTrue((bool) $p->finance_certification_required);
}
```

- [ ] **Step 2: Run** `cd api && php artisan test --filter=SalaryAdvancePolicyTest` — expect FAIL

- [ ] **Step 3: Implement migration + model + seeder**

Columns: `id`, `tenant_id` nullable, `version`, `effective_from`, `effective_to`, `max_salary_percentage`, `salary_basis`, `max_concurrent_advances`, `full_repayment_required`, `recovery_rule`, `final_approver_role`, `finance_certification_required`, `admin_review_required`, `configuration` json, `approved_by`, `active`, timestamps.

Seed version `2026.1` active.

- [ ] **Step 4: Run test — PASS**

---

### Task 2: Extend advance schema + finance reviews

**Files:**
- Create: `api/database/migrations/2026_07_25_140100_extend_salary_advance_for_lifecycle.php`
- Create: `api/app/Models/SalaryAdvanceFinanceReview.php`
- Modify: `api/app/Models/SalaryAdvanceRequest.php` fillable/casts/relations

- [ ] **Step 1: Migration** add columns per spec §5.1; create `salary_advance_finance_reviews` per §5.3; FK `policy_version_id`

- [ ] **Step 2: Update model** relations `policyVersion()`, `financeReviews()`, balance register morph

---

### Task 3: SalaryAdvanceService — eligibility + exposure

**Files:**
- Create: `api/app/Modules/Finance/Services/SalaryAdvanceService.php`
- Modify: `SalaryAdvanceController::eligibility` / `submit`
- Test: `api/tests/Feature/Finance/SalaryAdvanceEligibilityExposureTest.php`

- [ ] **Step 1: Failing tests** — BCRE balance block; approved-unpaid block; max = 50% of **net**

- [ ] **Step 2: Implement service** — `activePolicy`, `salarySnapshot`, `maxEligible`, `exposureSummary`, `assertCanSubmit`, lock + recheck

- [ ] **Step 3: Wire controller**; under v1 force `repayment_months=1`

- [ ] **Step 4: Tests PASS**

---

### Task 4: Deduction authority on submit

- [ ] **Step 1: Failing test** — submit without confirmation → 422
- [ ] **Step 2: Persist** `sa-deduction-auth-v1` + timestamp; require on submit
- [ ] **Step 3: Web** — checkbox binds to API field

---

### Task 5: Finance certify / return / not eligible

- [ ] **Step 1: Failing tests** — staff cannot; finance can; no self-certify; writes finance_reviews
- [ ] **Step 2: Endpoints** finance-certify / finance-return / mark-not-eligible
- [ ] **Step 3: Queue list** `GET ?queue=certify` for `salary_advance.certify` / view
- [ ] **Step 4: Tests PASS**

---

### Task 6: Realign workflow seeder + approve hooks

- [ ] **Step 1: Failing test** — after certify + Principal + SG approve → `approved_for_payment`, no BalanceRegister
- [ ] **Step 2: Seeder** Director → SG; remove Supervisor; remove BCRE from `onWorkflowApproved`
- [ ] **Step 3: Support `approved_amount` ≤ max

---

### Task 7: Record payment + create BCRE disbursement

- [ ] **Step 1: Failing test** — record-payment creates register + disbursement + status paid
- [ ] **Step 2: Implement** idempotent payment; full-EOM installment (= full amount, 1 month)

---

### Task 8: Schedule + record recovery; close; unblock

- [ ] **Step 1–3:** schedule-recovery, record-recovery, close; partial → reconciliation_required

---

### Task 9: Ledger + FORM-002 PDF

- [ ] Ledger JSON + DomPDF Parts A–C; auth tests

---

### Task 10: Web UX + `salary_advance.*` permissions

- [ ] Seed permissions; role grants; controller gates
- [ ] Client methods + UI (no multi-month under full_eom); fix notification URL

---

### Task 11: Regression suite + readiness notes

- [ ] `php artisan test --filter=SalaryAdvance`
- [ ] Fix SoD + IDOR regressions

---

## Spec coverage checklist

| Spec Phase 1 item | Task |
|-------------------|------|
| Policy version seed (net, principal ON) | 1 |
| Schema + finance reviews | 2 |
| Eligibility enrichment + exposure | 3 |
| Deduction authority | 4 |
| Finance certify | 5 |
| Workflow realign; no BCRE on approve | 6 |
| Payment + BCRE | 7 |
| Recovery + close | 8 |
| Ledger + FORM-002 | 9 |
| Employee/Finance UX + permissions + link fix | 10 |
| Tests | 3–11 |

---

## Deploy notes

- Run migrations + `SalaryAdvancePolicySeeder`
- Reseed `WorkflowSeeder` + `RolesAndPermissionsSeeder`
- Existing `approved` advances without payment: Finance should use payment endpoint or one-time data fix
- Do **not** enable consolidation fields
- Do **not** deploy to production from this session

---

## Execution handoff

Design approved with locked decisions. Execute tasks inline (TDD). Prefer **no git commits** unless user requests.
