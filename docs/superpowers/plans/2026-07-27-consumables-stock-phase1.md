# Consumables / Stock Phase 1 Implementation Plan

> **For agentic workers:** Execute task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Production-useful Consumables/Stock Phase 1 on top of the existing Stock module, strictly separate from Fixed Assets.

**Architecture:** Extend Stock models/services; harden GRN `type=stock` to ledgered intake; add UoM/locations, stocktakes, reason codes, dashboard, alerts.

**Tech Stack:** Laravel API, Next.js web, Spatie permissions, existing AuditLog + NotificationService.

---

### Task 1: Design docs
- [x] Spec + this plan under `docs/superpowers/`

### Task 2: Migration + models
- [x] Create `2026_07_27_100000_consumables_stock_phase1.php`
- [x] Models: `StockUnit`, `StockLocation`, `Stocktake`, `StocktakeLine`; extend item/transaction

### Task 3: Services
- [x] Extend `StockService` (reason codes, GRN receive, low-stock alerts)
- [x] Add `StocktakeService`

### Task 4: API
- [x] Controllers + form requests + routes for units, locations, stocktakes, dashboard
- [x] Harden `GoodsReceiptService` stock handoff
- [x] Notification default for `stock.low_stock`

### Task 5: Web
- [x] API client types; dashboard; stocktakes; locations/units; item detail; sidebar; movement reason codes

### Task 6: Tests
- [x] Feature tests for phase1 behaviours; update GRN stock ledger assertion
- [x] Run `php artisan test --filter=Stock` — **29 passed**

### Task 7: Deliver summary (no commit unless asked)
- [x] Ready for parent review / commit when requested