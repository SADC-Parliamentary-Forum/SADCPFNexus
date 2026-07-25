# M&E Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship production-critical M&E Phase 1 — settings + idempotent PIF intake, extended lifecycle, and the web surfaces that unlock the existing MandE API (intake, report wizard, review, strategy/frameworks, settings, basic reports).

**Architecture:** Extend existing `api/app/Modules/MAndE` and models; never write approved PIF columns. Auto-intake is tenant-configurable (default on). Programme Manager review setting exists (default off). Non-PIF / follow-ups / donor builder remain Phase 2+.

**Tech Stack:** Laravel 12 API, Next.js App Router web, existing `mandeApi`, Sanctum permissions, PHPUnit + Playwright.

**Spec:** `docs/superpowers/specs/2026-07-25-mande-results-monitoring-design.md`

---

## File map (Phase 1)

| Area | Create / Modify |
|------|-----------------|
| Settings | Create migration `me_settings` or tenant JSON; `MeSettingsService`; `MeSettingsController`; routes |
| Intake | Create `MeIntakeService`; modify `ProgrammeService::approve`; tests |
| Status | Migration add columns; modify `MeActivityReport`, `Programme::getMeStatusAttribute` |
| Return/SoD | Modify `MeReviewService` / controller return+accept |
| Web nav | Modify `Sidebar.tsx`, `auth.ts` |
| Web pages | Create intake, activity-reports list/detail/create, review-queue, strategic-plan, results, settings, reports |
| Client | Extend `mandeApi` for settings / not-reportable / enriched return |

---

### Task 1: M&E settings store + API

**Files:**
- Create: `api/database/migrations/2026_07_25_120000_create_me_settings_table.php`
- Create: `api/app/Models/MeSetting.php`
- Create: `api/app/Modules/MAndE/Services/MeSettingsService.php`
- Create: `api/app/Http/Controllers/Api/V1/MAndE/MeSettingsController.php`
- Modify: `api/routes/api.php` (mande group)
- Test: `api/tests/Feature/MAndE/MeSettingsTest.php`

- [ ] **Step 1: Write failing test** for default settings and update by admin

```php
public function test_defaults_and_admin_can_update(): void
{
    $tenant = Tenant::factory()->create();
    [$http] = $this->asRole('System Admin', $tenant); // use existing helper pattern from TestCase

    $http->getJson('/api/v1/mande/settings')
        ->assertOk()
        ->assertJsonPath('data.auto_intake', true)
        ->assertJsonPath('data.report_due_days', 14)
        ->assertJsonPath('data.programme_manager_review', false);

    $http->putJson('/api/v1/mande/settings', [
        'auto_intake' => false,
        'report_due_days' => 21,
        'programme_manager_review' => true,
    ])->assertOk()
      ->assertJsonPath('data.auto_intake', false)
      ->assertJsonPath('data.report_due_days', 21);
}
```

- [ ] **Step 2: Run test — expect FAIL** (route missing)

Run: `cd api && php artisan test --filter=MeSettingsTest`

- [ ] **Step 3: Implement migration + model + service + controller + routes**

Table `me_settings`: `id`, `tenant_id` unique, `auto_intake` bool default true, `report_due_days` int default 14, `programme_manager_review` bool default false, timestamps.

`MeSettingsService::forTenant($id)` upserts defaults; `update($tenantId, array $data)`.

Routes: `GET/PUT mande/settings` middleware `permission:mande.admin` for PUT; GET requires `mande.view`.

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit** `feat(mande): add tenant M&E settings API`

---

### Task 2: Idempotent intake on PIF approve

**Files:**
- Create: `api/app/Modules/MAndE/Services/MeIntakeService.php`
- Modify: `api/app/Modules/Programmes/Services/ProgrammeService.php` (after `notifyMeOfPifApproval`)
- Test: `api/tests/Feature/MAndE/MeIntakeIdempotencyTest.php`

- [ ] **Step 1: Failing test** — approve twice / ensureForProgramme twice → one report

```php
public function test_approve_creates_single_report_shell_when_auto_intake_on(): void
{
    // create submitted programme, admin approves, assert MeActivityReport count 1
    // call ensureForProgramme again, still count 1
}
public function test_approve_skips_create_when_auto_intake_off(): void
{
    // set auto_intake false, approve, count 0
}
```

- [ ] **Step 2: Implement `MeIntakeService::ensureForProgramme(Programme $p): MeActivityReport`**

Prefill from PIF: title, dates, responsible officer, planned participants, thematic if mappable; `created_by` = officer or system; `review_status=not_submitted`; unique on `programme_id` where deleted_at null (DB unique index partial or app-level lock).

- [ ] **Step 3: Hook into `ProgrammeService::approve`** after notify when settings.auto_intake

- [ ] **Step 4: Tests PASS + commit** `feat(mande): idempotent auto-intake on PIF approve`

---

### Task 3: Status extensions + me_status mapping

**Files:**
- Create migration adding: `not_reportable_reason`, `not_reportable_by`, `not_reportable_at`, `cancelled_reason`, `archived_at`, `intake_confirmed_at`, `report_due_at`, `return_section`, `return_required_action`, `correction_due_at`
- Modify: `MeActivityReport.php` constants + fillable
- Modify: `Programme.php` `getMeStatusAttribute`
- Modify: `MeReviewService` return/accept SoD
- Test: extend `ProgrammeMeStatusTest` + `MeReviewWorkflowTest`

- [ ] Implement + tests + commit `feat(mande): extend activity report lifecycle fields`

---

### Task 4: Web nav + mandeApi settings

**Files:**
- Modify: `web/components/layout/Sidebar.tsx` — Phase 1 children without EXTRA flag
- Modify: `web/lib/api.ts` — `mandeApi.getSettings`, `updateSettings`, `markNotReportable`
- Modify: `web/lib/auth.ts` — route ACL for new paths

- [ ] Commit `feat(web): expose Phase 1 M&E navigation`

---

### Task 5: Intake Queue page

**Files:**
- Create: `web/app/(app)/mande/intake/page.tsx` (and optional redirect from `pif-linkages`)
- Use `mandeApi.getPifLinkages({ unlinked: true })`
- Actions: Create report → `/mande/activity-reports/create?programme_id=`

- [ ] Commit `feat(web): M&E intake queue page`

---

### Task 6: Activity reports list + create/detail wizard

**Files:**
- Create: `web/app/(app)/mande/activity-reports/page.tsx`
- Create: `web/app/(app)/mande/activity-reports/mine/page.tsx`
- Create: `web/app/(app)/mande/activity-reports/create/page.tsx`
- Create: `web/app/(app)/mande/activity-reports/[id]/page.tsx`
- Sections with PIF prefill read-only; draft save via `updateReport`; submit via `submitReport`

- [ ] Commit `feat(web): M&E activity report list and wizard`

---

### Task 7: Review queue + evidence UI on report detail

**Files:**
- Create: `web/app/(app)/mande/review-queue/page.tsx`
- Enhance report detail with evidence list/upload/review and return/accept/close actions

- [ ] Commit `feat(web): M&E review queue and evidence actions`

---

### Task 8: Strategic plan + results framework pages

**Files:**
- Create: `web/app/(app)/mande/strategic-plan/page.tsx`
- Create: `web/app/(app)/mande/results/page.tsx`
- Wire existing `mandeApi` plan/framework methods

- [ ] Commit `feat(web): M&E strategic plan and results framework UI`

---

### Task 9: Settings + basic institutional reports pages

**Files:**
- Create: `web/app/(app)/mande/settings/page.tsx`
- Create: `web/app/(app)/mande/reports/page.tsx` (strategic report JSON → table + CSV download client-side)

- [ ] Commit `feat(web): M&E settings and basic reports`

---

### Task 10: Reminder command + regression tests

**Files:**
- Create: `api/app/Console/Commands/MeSendOverdueReportReminders.php`
- Schedule in `routes/console.php` or Kernel equivalent
- Playwright smoke: `web/tests/e2e/mande-intake.spec.ts` (staff/admin as available)
- Run: `php artisan test --filter=MAndE` and `ProgrammeMeStatusTest`

- [ ] Commit `feat(mande): overdue report reminders and regression coverage`

---

## Verification (Phase 1 done when)

1. Approve PIF with auto_intake on → one `MeActivityReport`; second ensure no duplicate
2. Web: Intake → create/open report → submit → return → accept
3. PIF badge `me_status` updates correctly
4. Settings toggle disables auto_intake
5. Existing MandE PHPUnit suite green
