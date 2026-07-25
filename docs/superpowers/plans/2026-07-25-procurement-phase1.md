# Procurement Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Locked 2026-07-25 — user Proceed  
**Approval:** User approved recommended defaults on 2026-07-25 (≤10k direct / ≤100k RFQ / >100k tender; budget hard-gate; derived stars; GRN draft handoff; Scope B extend; COI + soft split; nav children). Do not touch Salary Advance.

**Goal:** Close PRD §79 Phase 1 mandatory gaps on the existing Procurement / RFQ / Supplier module (budget hard-gate, threshold alignment, PIF transfer UI, structured stars, COI, split warning, GRN→FA/Stock draft handoff, nav/register/settings) without rewriting working RFQ/PO/portal flows.

**Architecture:** Extend `api/app/Modules/Procurement` + existing web `/procurement/*` and PIF programme APIs. Single SADC PF Core policy snapshot on requests; `BudgetReservation` becomes the Phase 1 budget-confirmation gate; stars derive from `VendorPerformanceEvaluation`; FA/Stock remain separate registers fed by confirmed GRN handoff drafts.

**Tech Stack:** Laravel (API), Next.js App Router (web), existing DomPDF/audit/Spatie permissions patterns. **Do not modify Salary Advance files or nav.**

**Spec:** `docs/superpowers/specs/2026-07-25-procurement-rfq-supplier-design.md`

---

## File map (Phase 1)

| Area | Create / Modify |
|------|-----------------|
| Thresholds | Modify `api/config/procurement.php` |
| Request policy fields | Create migration; modify `ProcurementRequest` model |
| Budget gate | Modify `ProcurementService` (`approve`, `issueRfq`, `award`); web budget UI |
| PIF UI | Modify PIF edit/detail procurement section; optional `web/app/(app)/procurement/intake/page.tsx` |
| Stars | Modify `Vendor` / `VendorPerformanceEvaluation`; vendor detail UI; gate `VendorRating` writes |
| COI | Create migration + model; wire assess/award |
| Split warning | Modify `ProcurementService::submit` (+ create) |
| GRN handoff | Modify `GoodsReceiptService`; Asset migration FKs; stock create via `StockService` |
| Nav / settings / register | Modify `Sidebar.tsx`; create settings + register pages |
| Tests | Extend `api/tests/Feature/Procurement/*`; add focused new test classes |
| Client | Modify `web/lib/api.ts` |

---

### Task 1: Align threshold config defaults

**Files:**
- Modify: `api/config/procurement.php`
- Test: `api/tests/Feature/Procurement/RfqInitiationTest.php` (and any hard-coded 500000 / 50000 expectations)

- [ ] **Step 1: Write/adjust failing assertions for new defaults**

In a new or existing test, assert `config('procurement.direct_purchase_limit') === 10000`, `quotation_limit === 100000`, `tender_threshold === 100000`.

- [ ] **Step 2: Update config**

```php
'direct_purchase_limit' => env('PROCUREMENT_DIRECT_LIMIT', 10_000),
'quotation_limit'       => env('PROCUREMENT_QUOTATION_LIMIT', 100_000),
'tender_threshold'      => env('PROCUREMENT_TENDER_THRESHOLD', 100_000),
'minimum_quotes_required' => 3,
'split_lookback_days'   => env('PROCUREMENT_SPLIT_LOOKBACK_DAYS', 30),
```

Document rule in comment: **≤ direct → approved-supplier/direct; ≤ quotation_limit → RFQ (min 3 quotes); > quotation_limit → tender.**

- [ ] **Step 3: Fix tests that assumed 5k/50k/500k**

Search `api/tests` for `500_000`, `50000`, `5_000`, `50_000` procurement assertions; update to new bands.

- [ ] **Step 4: Run procurement RFQ/award tests**

```bash
cd api && php artisan test --filter=RfqInitiationTest
cd api && php artisan test --filter=ProcurementAwardTest
```

Expected: PASS

- [ ] **Step 5: Commit** (only when user asked / stream allows)

```bash
git add api/config/procurement.php api/tests/Feature/Procurement
git commit -m "fix(procurement): align threshold defaults to 10k/100k policy bands"
```

---

### Task 2: Policy snapshot + suggested method on request

**Files:**
- Create: `api/database/migrations/2026_07_25_100001_add_policy_fields_to_procurement_requests.php`
- Modify: `api/app/Models/ProcurementRequest.php`
- Modify: `api/app/Modules/Procurement/Services/ProcurementService.php`
- Test: `api/tests/Feature/Procurement/ProcurementMethodPolicyTest.php` (create)

- [ ] **Step 1: Failing test — suggested method from value**

```php
public function test_suggested_method_bands(): void
{
    // ≤10000 → approved_supplier or direct
    // 10001–100000 → quotation
    // >100000 → tender
}
```

- [ ] **Step 2: Migration columns**

Add nullable: `suggested_method` (string), `policy_profile_key` (string, default `sadc_pf_core`), `policy_snapshot` (json), `method_override_reason` (text), `method_override_by` (fk users nullable), `method_override_at` (timestamp nullable), `split_justification` (text nullable), `programme_id` (nullable fk programmes) if not already present.

- [ ] **Step 3: Helper on service**

```php
public function suggestMethod(float $estimatedValue): string
{
    $direct = (float) config('procurement.direct_purchase_limit');
    $rfqMax = (float) config('procurement.quotation_limit');
    if ($estimatedValue <= $direct) {
        return 'approved_supplier';
    }
    if ($estimatedValue <= $rfqMax) {
        return 'quotation';
    }
    return 'tender';
}
```

On HOD approve or procurement approve (pick one — **lock: on first transition to `hod_approved`**), set `suggested_method`, copy current config into `policy_snapshot`, set `policy_profile_key`.

When actor sets `procurement_method` ≠ suggested, require `method_override_reason` and stamp override fields.

- [ ] **Step 4: Run new test + regression**

```bash
cd api && php artisan test --filter=ProcurementMethodPolicyTest
```

- [ ] **Step 5: Commit** when allowed

---

### Task 3: Budget confirmation hard gate + UI

**Files:**
- Modify: `api/app/Modules/Procurement/Services/ProcurementService.php` (`approve`, `issueRfq`, `award`)
- Modify: `api/tests/Feature/Procurement/BudgetReservationTest.php`
- Create: `web/app/(app)/procurement/budget/page.tsx`
- Modify: `web/app/(app)/procurement/[id]/page.tsx` — reserve / confirm actions using `budgetReservationsApi`
- Modify: `web/components/layout/Sidebar.tsx` — add Pending Budget Confirmation
- Modify: `web/lib/api.ts` if client helpers incomplete

- [ ] **Step 1: Failing test — approve without reservation rejected**

```php
public function test_procurement_approve_requires_active_budget_reservation(): void
{
    // create request → submit → hodApprove → approve() without reserve → 422
}
```

- [ ] **Step 2: Implement gate**

```php
protected function assertBudgetConfirmed(ProcurementRequest $request): void
{
    $active = $request->budgetReservations()
        ->whereNull('released_at')
        ->exists();
    if (!$active) {
        throw ValidationException::withMessages([
            'budget' => 'Finance budget confirmation is required before this action.',
        ]);
    }
}
```

Call from `approve`, `issueRfq`, and `award`. Ensure `BudgetReservation` relation exists on model.

Keep: HOD must precede reserve (existing). After reserve, status `budget_reserved`; `approve()` already accepts `budget_reserved` — tighten so `hod_approved` alone is **not** enough for `approve()`.

- [ ] **Step 3: Web budget queue**

List HOD-approved without active reservation + reserved awaiting procurement approve. Use existing `budgetReservationsApi` + procurement list filters.

Wire reserve form on request detail (budget_line, amount, currency, notes).

- [ ] **Step 4: Run tests**

```bash
cd api && php artisan test --filter=BudgetReservationTest
cd api && php artisan test --filter=ProcurementTest
```

- [ ] **Step 5: Commit** when allowed

---

### Task 4: PIF → Procurement transfer UI + Intake

**Files:**
- Modify: PIF edit/detail page under `web/app/(app)/pif/` that shows procurement items (Budget & Procurement section)
- Create: `web/app/(app)/procurement/intake/page.tsx`
- Modify: `Sidebar.tsx` — Procurement Intake
- Use existing: `programmeApi.sendToProcurement` in `web/lib/api.ts`
- Test: rely on `ProgrammeProcurementTransferTest`; add Playwright smoke if fixtures exist

- [ ] **Step 1: Locate PIF procurement items UI**

Find where `programme_procurement_items` are rendered; add multi-select + “Send to Procurement” modal (title, optional category). Only when programme approved/amended; disable already-linked items.

```tsx
await programmeApi.sendToProcurement(programmeId, {
  procurement_item_ids: selectedIds,
  request_title: title,
});
```

- [ ] **Step 2: Intake page**

List procurement requests that have `programme_id` set OR description matching generated PIF text; link to request + programme. Empty state explains batching (one transfer = one package; re-run with subset for separate lots).

- [ ] **Step 3: On transfer, set `programme_id` on created request**

Modify `ProgrammeService::sendToProcurement` to set `programme_id` => `$programme->id` (and budget_line from programme if available).

- [ ] **Step 4: Run**

```bash
cd api && php artisan test --filter=ProgrammeProcurementTransferTest
```

- [ ] **Step 5: Commit** when allowed

---

### Task 5: Structured scorecard → derived stars

**Files:**
- Modify: `api/app/Models/Vendor.php` — `derived_star_rating` accessor from evaluations
- Modify: `api/app/Models/VendorPerformanceEvaluation.php` — document mapping; optional extra criteria columns if mapping five→PRD list is insufficient (Phase 1 may keep five dimensions)
- Modify: `api/app/Http/Controllers/Api/V1/Procurement/VendorController.php` — disable or 422 free-form overall star create that bypasses scorecard
- Modify: `web/app/(app)/procurement/vendors/[id]/page.tsx` — remove click-to-set overall stars; show derived stars; keep evaluation form
- Test: `api/tests/Feature/Procurement/VendorPerformanceStarsTest.php` (create)

- [ ] **Step 1: Failing test**

```php
public function test_derived_stars_from_evaluation_overall_score(): void
{
    // overall_score 90 → 5 stars; 70 → 4; etc. per mapping in design
    // POST vendor rating direct overall without evaluation → 422
}
```

Star mapping (lock):

| Overall score (0–100) | Stars |
|-----------------------|-------|
| ≥ 90 | 5 |
| ≥ 70 | 4 |
| ≥ 50 | 3 |
| ≥ 30 | 2 |
| > 0 | 1 |
| none | null |

- [ ] **Step 2: Implement accessor + gate**

Average latest N evaluations or mean of all — **lock: mean of all evaluations’ overall_score**.

- [ ] **Step 3: UI**

Replace interactive `StarPicker` for overall with read-only `StarDisplay` bound to `derived_star_rating`. Evaluation tab remains the only way to change scores.

- [ ] **Step 4: Run**

```bash
cd api && php artisan test --filter=VendorPerformanceStarsTest
cd api && php artisan test --filter=VendorsTest
```

- [ ] **Step 5: Commit** when allowed

---

### Task 6: Conflict of interest declarations

**Files:**
- Create: migration `procurement_coi_declarations`
- Create: `api/app/Models/ProcurementCoiDeclaration.php`
- Modify: quote assess endpoint + `award` to require declaration for actor
- Modify: RFQ detail UI — COI checkbox before assess/award
- Test: `api/tests/Feature/Procurement/ProcurementCoiTest.php`

Schema sketch:

```php
Schema::create('procurement_coi_declarations', function (Blueprint $t) {
    $t->id();
    $t->foreignId('tenant_id');
    $t->foreignId('procurement_request_id');
    $t->foreignId('user_id');
    $t->boolean('has_conflict');
    $t->text('notes')->nullable();
    $t->string('context'); // assess|award
    $t->timestamps();
    $t->unique(['procurement_request_id', 'user_id', 'context']);
});
```

- [ ] **Step 1: Failing tests** — assess/award without COI → 422; `has_conflict=true` without recusal notes → 422
- [ ] **Step 2: Implement model + service checks**
- [ ] **Step 3: Wire UI**
- [ ] **Step 4: Run award + new COI tests**
- [ ] **Step 5: Commit** when allowed

---

### Task 7: Anti-split warning on submit

**Files:**
- Modify: `ProcurementService` submit (and create-if-submit)
- Modify: web create/submit UX to show warnings + justification field
- Test: `api/tests/Feature/Procurement/SplitPurchaseWarningTest.php`

- [ ] **Step 1: Failing test** — two similar requests within lookback crossing RFQ threshold without justification → 422; with justification → OK + audit

Detection heuristics (Phase 1):

- same `tenant_id` + (`requester_id` OR same `programme_id`)
- status not in cancelled/rejected/withdrawn
- created within `split_lookback_days`
- same `category` OR similar title (`LIKE` first 20 chars) OR same budget_line on reservation
- sum(estimated_value) + current > `quotation_limit` while each alone ≤ limit (or crosses tender similarly)

- [ ] **Step 2: Implement warning payload + justification requirement**
- [ ] **Step 3: UI banner + textarea**
- [ ] **Step 4: Run tests**
- [ ] **Step 5: Commit** when allowed

---

### Task 8: GRN accept → FA / Stock draft handoff

**Files:**
- Create: migration add `purchase_order_id`, `procurement_request_id`, `goods_receipt_note_id` nullable to `assets`
- Modify: `api/app/Models/Asset.php` fillable
- Modify: `api/app/Modules/Procurement/Services/GoodsReceiptService.php`
- Use: `StockService::createItem` / `recordTransaction`
- Modify: `web/app/(app)/procurement/receipts/[id]/page.tsx` — handoff dialog on accept
- Test: `api/tests/Feature/Procurement/GoodsReceiptHandoffTest.php`

- [ ] **Step 1: Failing test**

```php
public function test_accept_grn_with_capital_handoff_creates_draft_asset(): void
{
    // accept with handoff lines → Asset exists with FKs, status draft/pending
}

public function test_accept_grn_with_stock_handoff_creates_stock_item(): void
{
    // StockItem linked to procurement_request_id / purchase_order_id
}
```

- [ ] **Step 2: Accept payload extension**

```json
{
  "handoff": [
    { "goods_receipt_item_id": 1, "type": "fixed_asset", "name": "...", "category": "..." },
    { "goods_receipt_item_id": 2, "type": "stock", "name": "...", "quantity": 10, "unit": "each", "stock_category_id": 1 }
  ]
}
```

Only process when GRN transitions to `accepted`. Never auto-approve assets into issued state.

- [ ] **Step 3: UI dialog** after successful accept (or as part of accept form)
- [ ] **Step 4: Run GoodsReceiptTest + HandoffTest**
- [ ] **Step 5: Commit** when allowed

---

### Task 9: Nav, Register, Settings, Analytics polish

**Files:**
- Modify: `web/components/layout/Sidebar.tsx` — add Intake, Budget, Register, Settings (permission-gated). **Do not touch Salary Advance entries.**
- Create: `web/app/(app)/procurement/register/page.tsx` — table + CSV export via reports endpoint or client CSV
- Create: `web/app/(app)/procurement/settings/page.tsx` — admin form for thresholds (API: add `GET/PUT /procurement/settings` gated by `procurement.admin`)
- Modify: `web/lib/auth.ts` route gates if needed
- Optional: rename Analytics label to Dashboard or add `/procurement/dashboard` alias

- [ ] **Step 1: Settings API**

Store overrides in `tenants.settings` JSON key `procurement` **or** read/write env-backed config via admin-only endpoint that updates a `procurement_settings` table — **lock: tenant settings JSON** to avoid server env writes from web.

```php
// GET returns effective thresholds (tenant override ?? config)
// PUT validates positive numbers and audit-logs
```

- [ ] **Step 2: Register page** listing key columns + export
- [ ] **Step 3: Sidebar children order**

Suggested order: Dashboard/Analytics → New Request → Requests → Intake → Budget Confirmation → RFQ → Vendors → POs → Receipts → Invoices → Contracts → Register → Settings → (Performance via Vendors).

- [ ] **Step 4: Manual smoke + e2e update** `web/tests/e2e/procurement.spec.ts`
- [ ] **Step 5: Commit** when allowed

---

### Task 10: Audit trail + verification sweep

**Files:**
- Grep new actions for `AuditLog::record`
- Run full procurement + programme transfer suite
- Update UAT notes only if asked (do not mass-check UAT boxes)

- [ ] **Step 1: Ensure audit events** for: budget confirm, method override, COI, split justification, PIF send (exists), GRN handoff, settings change, star-derivation N/A

- [ ] **Step 2: Full test run**

```bash
cd api && php artisan test tests/Feature/Procurement
cd api && php artisan test --filter=ProgrammeProcurement
```

- [ ] **Step 3: Spec checklist** — mark Phase 1 demo items Done in a short completion note under the plan (append section) when verified

- [ ] **Step 4: Stop** — do not start Phase 2 tender/committee work in this stream

---

## Explicitly deferred (Phase 2 / 3)

- Advanced tender portal, tender committee, sealed two-envelope
- Contract milestone management, procurement planning, catalogue
- Advanced split hard-blocks, automated compliance reminders
- Multi-donor full policy engine UI
- AI comparison / forecasting / anomaly detection
- Mobile parity for new Phase 1 screens

---

## Completion note (Locked 2026-07-25 — user Proceed)

**Phase 1 demo items status (verified 2026-07-25):**

| Item | Status |
|------|--------|
| Thresholds 10k/100k | Done |
| Policy snapshot + suggested method | Done |
| Budget hard-gate + Finance UI | Done |
| PIF transfer UI + Intake + programme_id | Done |
| Derived stars from scorecard | Done |
| COI declaration | Done |
| Soft anti-split warning | Done |
| GRN → draft FA/Stock handoff | Done |
| Nav: Intake, Budget, Register, Settings | Done |
| Settings API (tenant JSON) | Done |
| Salary Advance | Untouched |

Do not start Phase 2 tender/committee work in this stream.

## Dependencies / sequencing

1 → 2 → 3 (thresholds before method/budget gates)  
4 (PIF UI) independent after `programme_id` column from 2  
5, 6, 7 can parallel after 2  
8 after GRN baseline green  
9 anytime after 3 for budget nav  
10 last
