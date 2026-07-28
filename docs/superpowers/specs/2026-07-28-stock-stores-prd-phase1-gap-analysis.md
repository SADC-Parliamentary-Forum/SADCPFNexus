# Stock / Stores PRD Phase 1 — Gap Analysis

**Date:** 2026-07-28  
**Baseline:** Consumables Phase 1 shipped at `aa4a363`  
**PRD:** `2026-07-28-consumables-stock-stores-prd.md` §132  
**Branch:** `feat/stock-stores-prd-phase1`

## Scorecard

| Capability | Before | After this pass |
|---|---|---|
| Item Catalogue | HAD | HAD |
| Categories | HAD | HAD |
| UoM (+ conversion) | PARTIAL (master only) | ADDED conversion_factor / base_unit_id |
| Stores/Locations | HAD | HAD |
| Procurement Intake | PARTIAL (binary handoff) | ADDED classification gateway |
| Receipts (partial/over/under/damaged) | PARTIAL | ADDED quantity_damaged → quarantine |
| Stock Ledger | HAD | HAD (+ return/transfer/write_off reasons) |
| Stock Requests | MISSING | ADDED |
| Approval | MISSING | ADDED (requests, stocktake variance, write-offs) |
| Reservations | MISSING | ADDED (available = on_hand − reserved − quarantined) |
| Issues (+ voucher/ack) | PARTIAL | ADDED vouchers + acknowledgement |
| Returns | MISSING | ADDED |
| Transfers (dispatch/receive) | MISSING | ADDED two-sided |
| Reorder Levels | HAD | HAD |
| Replenishment Requests → Procurement | MISSING | ADDED |
| PIF Stock Availability Check | MISSING | ADDED `/stock/availability` |
| Batch/Expiry | MISSING | ADDED stock_batches |
| Stocktakes | PARTIAL | HARDENED (blind + variance approval gate) |
| Adjustments | HAD | HAD |
| Damage/Expiry quarantine | MISSING | ADDED |
| Write-Off | MISSING | ADDED (approve then ledger) |
| Reports | HAD | HAD |
| Audit | HAD | HAD (extended events) |
| Permissions | HAD | ADDED `stock.approve`, `stock.transfer` |

## Non-negotiables preserved

- Stock ≠ Fixed Assets (consumable/direct_expense never create FA)
- Ledger is sole balance mutator
- Row locks on issue/reservation
- No ordinary negative stock
- Reserved + quarantined reduce available
- Stocktake variance requires approval before ledger adjustment
