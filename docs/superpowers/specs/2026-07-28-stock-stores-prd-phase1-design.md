# Stock / Stores PRD Phase 1 — Design

**Date:** 2026-07-28  
**Scope:** Fill gaps to PRD §132 Production Critical without Fixed Assets merge.

## Assumptions

1. Parent/user approved full Phase 1 scope; interactive brainstorm approval waived for subagent delivery.
2. `current_balance` remains physical on-hand; available = on_hand − reserved − quarantined.
3. Existing ad-hoc `out` movements remain valid for emergency issues; request→issue is the preferred path.
4. GRN handoff accepts both legacy (`stock`/`fixed_asset`/`skip`) and gateway (`consumable`/`capital`/`controlled`/`direct_expense`) types.
5. Phase 2 nav stubs only (forecasting, event packs, offline stocktake, advanced barcode).

## Available quantity

```
available = max(0, current_balance - quantity_reserved - quantity_quarantined)
```

Issues and new reservations check `available` under `lockForUpdate`.

## Workflows

### Request → Approve → Reserve → Issue → Ack
1. Staff creates `stock_request` + lines.
2. Approver (`stock.manage`/`stock.admin`) approves → creates `stock_reservation` lines, increments `quantity_reserved`.
3. Issuer posts `stock_issue` voucher → ledger `out`, decrements reserved, optional recipient ack.
4. Reject/cancel releases reservations.

### Returns
`stock_return` → ledger `in` with reason_code `return`.

### Transfers
`stock_transfer`: draft → dispatched (out from source) → received (in at destination). Cancel only before dispatch.

### Quarantine / Write-off
- Quarantine increases `quantity_quarantined` (no ledger qty change).
- Write-off requires approval → ledger `out` with reason `write_off`; reduces balance and quarantine qty if applicable.

### Replenishment
`stock_replenishment_request` from low-stock / manual → visible to Procurement (`procurement.view`); optional link to procurement request.

### PIF availability
`GET /stock/availability?q=` and `POST /stock/availability/check` with item ids / search terms.

### Batches
Optional `stock_batches` per item (lot, expiry, qty). Issues prefer FEFO among non-expired active batches. Expired batches auto-count toward non-issuable (quarantine or blocked).

### UoM conversion
`stock_units.base_unit_id` + `conversion_factor` (qty_in_base = qty * factor).

### Stocktake harden
- `is_blind`: hide `system_qty` from count UI/API until completed/approved.
- Submit counts → if any variance ≠ 0 → status `pending_approval`; approve posts adjustments; zero-variance completes immediately.

### Classification gateway (GRN)
| Type | Destination |
|---|---|
| capital / controlled / fixed_asset | Fixed Asset Register |
| consumable / stock | Stock ledger |
| direct_expense / skip | No stock/FA create |

## Permissions added

- `stock.approve` — request / stocktake variance / write-off approval
- `stock.transfer` — transfer dispatch/receive (also granted via manage/admin)

## Testing

PHPUnit covering: ledger-only balance mutation, available math + reservation concurrency, request→issue, two-sided transfer, stocktake variance gate, GRN classification FA separation.
