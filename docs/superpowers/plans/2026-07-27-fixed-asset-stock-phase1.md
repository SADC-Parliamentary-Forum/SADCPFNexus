# Fixed Asset + Stock Phase 1 — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or executing-plans. Steps use checkbox syntax.

**Goal:** Close the FA/Stock register-of-record loop — capitalise/reject pending GRN asset drafts and ledger stock handoff inbounds.

**Architecture:** Add `AssetService` for capitalise/reject; extend AssetController + routes; fix `GoodsReceiptService::processHandoff` stock path to use `StockService::recordTransaction`; pending filter + confirm UI on `/assets`.

**Tech Stack:** Laravel API, PHPUnit, Next.js web, existing AuditLog / StockService patterns.

**Design:** `docs/superpowers/specs/2026-07-27-fixed-asset-stock-phase1-design.md`

**Workspace:** `.worktrees/budget-phase1-foundation` on `feat/fixed-asset-stock`

**Do not commit** unless the user asks. Do not commit `api/.ship-safe/context.json`.

---

## File map

| File | Role |
|------|------|
| `api/app/Modules/Assets/Services/AssetService.php` | Capitalise + reject pending |
| `api/app/Http/Controllers/Api/V1/Assets/AssetController.php` | status filter; capitalise/reject endpoints; QR helper reuse |
| `api/routes/api.php` | New routes before `{asset}` where needed |
| `api/app/Modules/Procurement/Services/GoodsReceiptService.php` | Stock handoff ledger |
| `api/tests/Feature/Assets/AssetCapitalisationTest.php` | New feature tests |
| `api/tests/Feature/Procurement/GoodsReceiptHandoffTest.php` | Assert inbound txn |
| `web/lib/api.ts` | `capitalise` / `rejectCapitalisation` + list status param |
| `web/app/(app)/assets/page.tsx` | Pending filter, badge, confirm/reject UI |
| `web/components/layout/Sidebar.tsx` | Pending nav child (optional) |

---

### Task 1: Failing capitalisation tests

**Files:**
- Create: `api/tests/Feature/Assets/AssetCapitalisationTest.php`

- [ ] **Step 1:** Write tests for capitalise pending, reject, forbidden, non-pending 422
- [ ] **Step 2:** Run tests — expect fail (route/method missing)
- [ ] **Step 3:** Implement `AssetService` + controller methods + routes
- [ ] **Step 4:** Add `?status=` filter on index
- [ ] **Step 5:** Re-run until green

### Task 2: Stock GRN handoff ledger

**Files:**
- Modify: `GoodsReceiptService.php`, `GoodsReceiptHandoffTest.php`

- [ ] **Step 1:** Extend test to assert `stock_transactions` inbound row + balance
- [ ] **Step 2:** Run — expect fail
- [ ] **Step 3:** Fix handoff: create item balance 0, then `recordTransaction` type `in`
- [ ] **Step 4:** Green

### Task 3: Web pending capitalisation UX

**Files:**
- Modify: `web/lib/api.ts`, `web/app/(app)/assets/page.tsx`, Sidebar

- [ ] **Step 1:** API client methods
- [ ] **Step 2:** Pending badge + filter + Capitalise / Reject actions
- [ ] **Step 3:** Smoke mentally against existing depreciation modal patterns

### Task 4: Verify

- [ ] Run `AssetCapitalisationTest`, `AssetsTest`, `StockTest`, `GoodsReceiptHandoffTest`
- [ ] Update `REMAINING_WORK.md` note for FA/Stock slice
- [ ] Do **not** commit
