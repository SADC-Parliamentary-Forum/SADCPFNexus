# Fixed Asset + Stock Phase 1 — Design

**System:** SADC PF Nexus  
**Module:** Fixed Asset Register + Consumables / Stock  
**Slice:** Phase 1 — Register-of-record closeout (capitalise pending FA + ledger-correct stock handoff)  
**Date:** 2026-07-27  
**Status:** Approved for implementation (autonomous; user chose stream B after Budget reports)

---

## Context (what already exists)

Both modules are substantially built — not greenfield:

| Area | Status |
|------|--------|
| Asset CRUD, categories, QR, financial fields, straight-line NBV accessor | Done |
| Asset movements, requests, print, add/edit UI | Done |
| Stock categories/items/transactions + StockService (locked balance) | Done |
| Stock web: items, movements, low-stock, reports, categories | Done |
| GRN → draft FA (`status=pending`) + stock create | Done (Procurement Phase 1) |
| **Confirm/capitalise pending FA into active register** | **Missing** |
| **Stock GRN handoff ledger entry (inbound transaction)** | **Missing** (balance set without `recordTransaction`) |
| Budget-line link on assets/stock | Out of scope (no existing product requirement for Phase 1) |
| Declining-balance NBV on API (UI already previews it) | Later |
| Disposal / revaluation / physical count workflows | Later |

Procurement design (`2026-07-25-procurement-rfq-supplier-design.md` D7) already states: FA/Stock remain registers of record after **officer confirmation**; no auto-capitalisation.

---

## Approaches considered

1. **Close the register-of-record loop (recommended)** — Add Asset capitalise/reject for `pending` GRN drafts; fix stock handoff to create item at zero + inbound `TYPE_IN` via `StockService`; pending queue UI. Smallest honest demo slice.
2. **Full AssetService rewrite + depreciation schedule engine** — Extract controller logic, period runs, declining balance, GL postings. Correct long-term; too large for this stream.
3. **Demo polish only** — Seeds, nav labels, PDF tweaks without confirmation. Does not fix the honesty gap vs Procurement D7.

**Choice:** Approach 1.

---

## Decisions locked

| Topic | Choice |
|-------|--------|
| Scope | Capitalise/reject pending assets + stock handoff ledger integrity + pending UI |
| Architecture | New `App\Modules\Assets\Services\AssetService` for confirm/reject; keep existing AssetController CRUD |
| Pending meaning | `status=pending` = awaiting FA officer capitalisation (from GRN or future intakes) |
| Confirm requirements | Valid category; `purchase_date`; `purchase_value` ≥ 0; optional useful life / salvage / method / asset_code rename |
| On confirm | `status=active`, compute/store NBV, generate QR, audit `assets.capitalised` |
| On reject | Soft outcome: `status=retired` + notes reason (preserve procurement FKs for audit); audit `assets.capitalisation_rejected` |
| Manual create | Remains `active` immediately (managers adding outside GRN) |
| Stock GRN handoff | Create item with `current_balance=0`, then `recordTransaction` type `in` for quantity |
| Budget link | Not in this slice |
| Permissions | Same as asset manage: `assets.admin` / `assets.manage` / system admin |

---

## Architecture

```
GRN accept (existing)
  ├─ fixed_asset → Asset(status=pending, FKs to PO/PR/GRN)
  └─ stock → StockItem(balance=0) + StockTransaction(type=in)

Asset officer (new)
  ├─ GET /assets?status=pending
  ├─ POST /assets/{id}/capitalise  → active + financials + QR
  └─ POST /assets/{id}/reject-capitalisation → retired + reason
```

Web:
- Assets inventory shows **Pending capitalisation** badge/filter
- Confirm modal (reuse depreciation field set) + Reject with reason
- Sidebar: add “Pending” child under Assets

---

## Data / API

### List filter
`GET /api/v1/assets?status=pending|active|…` (optional; default all)

### Capitalise
`POST /api/v1/assets/{asset}/capitalise`

Body:
```json
{
  "asset_code": "optional rename",
  "category": "required if changing; must be tenant category",
  "purchase_date": "YYYY-MM-DD",
  "purchase_value": 5000,
  "useful_life_years": 3,
  "salvage_value": 0,
  "depreciation_method": "straight_line",
  "notes": "optional"
}
```

Rules: only `pending`; tenant match; manager permission.

### Reject capitalisation
`POST /api/v1/assets/{asset}/reject-capitalisation`  
Body: `{ "reason": "required string" }`  
Only `pending`.

---

## Error handling

- Non-pending capitalise/reject → 422
- Wrong tenant → 404
- Insufficient permission → 403
- Invalid category → 422
- Stock inbound quantity ≤ 0 on handoff → skip transaction or 422 (quantity required when type=stock)

---

## Testing

- Feature: capitalise pending → active + value + audit
- Feature: cannot capitalise active
- Feature: reject pending → retired + reason
- Feature: staff cannot capitalise
- Feature: GRN stock handoff creates inbound transaction with matching balance_after
- Existing AssetsTest / StockTest / GoodsReceiptHandoffTest remain green (update stock handoff assertion)

---

## Out of scope (explicit)

- Budget line / commitment linkage
- Declining-balance server computation parity
- Period depreciation runs / journals
- Physical stocktake / cycle counts
- Mobile parity changes
- Auto-capitalise on GRN

---

## Assumptions

1. `pending` is reserved for FA capitalisation drafts (not overlapping asset-request statuses — those live on `asset_requests`).
2. Rejecting capitalisation retires the draft rather than hard-delete (audit / procurement trail).
3. Stock items created outside GRN may still set opening balance via create + optional later adjustment; only GRN path is corrected in this slice.
4. Existing straight-line NBV computation remains authoritative on the API for this slice.
