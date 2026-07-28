# Consumables / Stock & Stores Management — Phase 1 Design

**Date:** 2026-07-27  
**Branch:** `feat/consumables-stock`  
**Status:** Approved for implementation (parent directive: proceed after FA Phase 1)

---

## 1. Problem & separation rule

Fixed Assets and Consumables/Stock are **separate registers**. Paper, toner, stationery, and similar stores items live **only** in the Stock module — never in the `assets` table or FA register.

GRN routing choke point:

| Handoff `type` | Destination |
|----------------|-------------|
| `fixed_asset` | Fixed Asset Register |
| `stock` | Consumables / Stock module only |

---

## 2. Existing foundation (extend, do not replace)

Already present:

- `stock_categories`, `stock_items`, `stock_transactions` (immutable ledger via API)
- `StockService::recordTransaction()` with `lockForUpdate()` and non-negative balance
- Permissions: `stock.view/create/edit/issue/manage/admin`
- Web: register, movements, low-stock list, reports, categories
- GRN accept handoff API (stock path exists but **bypasses ledger** on main)

---

## 3. Gap analysis (Phase 1 targets)

| Capability | Before | Phase 1 |
|------------|--------|---------|
| Categories / items | Present | Keep; link optional UoM + location FKs |
| UoM | Free-text `unit` | Add `stock_units` master; keep free-text fallback |
| Locations | Free-text `storage_location` | Add `stock_locations` master; keep free-text fallback |
| Stock-in / GRN | Creates item with raw balance | Ledgered `in` via `StockService`; optional replenish existing SKU |
| Stock-out / issue | Present | Reason codes + stronger issue filters/history |
| Reorder | Flag + page | Notify stock managers when crossing below reorder |
| Stocktakes | Missing | Campaign + lines + complete → adjustment movements |
| Shortage / damaged / expired | Missing | `reason_code` on movements |
| Issue history | Movements list | Filters: type, reason_code, user, dept, date range + export |
| Dashboard | Thin KPIs on list | Dedicated dashboard API + UI |
| Permissions / audit | Solid | Extend audit events; keep FA untouched |

Out of scope for Phase 1: multi-bin qty, batch/lot/FEFO, barcode scanning, costing layers, mobile offline.

---

## 4. Architecture

```
Procurement GRN accept
        │
        ▼
GoodsReceiptService::processHandoff
   ├── fixed_asset → Asset::create (FA — do not change beyond stock clarity)
   └── stock → StockService::receiveFromGrn (create or replenish + ledgered in)

StockService (sole balance authority)
   ├── recordTransaction (lock + ledger + optional low-stock alert)
   ├── createItem / updateItem
   └── receiveFromGrn

StocktakeService
   ├── create / capture counts
   └── complete → variance adjustments via StockService
```

### Data additions

- **`stock_units`**: tenant-scoped UoM (`code`, `name`, `is_active`)
- **`stock_locations`**: tenant-scoped stores (`code`, `name`, `is_active`)
- **`stock_items`**: nullable `stock_unit_id`, `stock_location_id`
- **`stock_transactions`**: `reason_code`, nullable `stock_location_id`, `goods_receipt_note_id`
- **`stocktakes` / `stocktake_lines`**: physical count campaigns

### Reason codes

`receipt | issue | shortage | damaged | expired | stocktake | other`

---

## 5. API surface (new / extended)

Under `can:stock.view` (writes via Form Request / manage gates):

- `GET/POST /stock/units`, `PUT/DELETE /stock/units/{id}`
- `GET/POST /stock/locations`, `PUT/DELETE /stock/locations/{id}`
- `GET /stock/dashboard`
- `GET/POST /stock/stocktakes`, `GET /stock/stocktakes/{id}`, `PUT` lines, `POST .../complete`
- Transaction list filters: `reason_code`, `issued_to_user_id`, `issued_to_department_id`, `date_from`, `date_to`
- GRN handoff stock: ledgered `in`; optional `stock_item_id` to replenish

---

## 6. Web UI

- Dashboard `/stock/dashboard`
- Locations + Units under manage
- Stocktakes list + detail/count
- Item detail `/stock/[id]`
- Movement modal: reason codes + issued-to free text retained (dept/user IDs when available)
- Sidebar: Dashboard, Stocktakes, Locations, Units
- GRN accept: optional handoff classification when receipts UI is touched (stock vs FA)

---

## 7. Testing

- Feature: units/locations CRUD, stocktake variance → ledger, GRN stock creates transaction, low-stock alert dispatch, reason_code on out
- Existing Stock + GRN handoff tests updated for ledger assertion
- FA path remains green / unchanged behaviour

---

## 8. Non-goals / residuals

- Do not merge into FA
- Do not commit/push/deploy from this workstream unless asked
- Exclude ship-safe
- Rebase note: branch cut from main after FA Phase 1 commit (`e82906a` already on main)
