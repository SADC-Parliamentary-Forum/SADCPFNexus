# Budget reports pack design

**Date:** 2026-07-27  
**Stream:** A — read-only Budget reports  
**Status:** Implemented in worktree `budget-phase1-foundation` (not committed)

## Approaches considered

1. **Dedicated report service + controller** under `/budget/reports/*` with a tabbed UI at `/budget/reports` — thin read models over existing Phase 1–2 tables. *(Chosen)*
2. Extend existing control/change/cycle controllers with report actions — faster, but mixes write workflows with reporting.
3. Materialized report tables / warehouse — premature for current scale; Nexus owns commitments, not GL.

## Design

- **Auth:** same tenant-scoped Sanctum auth as other budget GETs (Finance Controller and authenticated finance users can read).
- **Utilisation:** reuse `BudgetAvailabilityService` (`available = approved − actual − commitments`); expose `% utilised`; roll up by `line` | `department` | `funding_source`; filters: FY, department, funding source.
- **Commitment ageing:** open `BudgetReservation` rows (active statuses, not released); age from `reserved_at` (fallback `created_at`); buckets 0–30 / 31–60 / 61–90 / 90+; include `source_type` / `source_key`.
- **Change-request register:** read `BudgetChangeRequest` + items; total amount; dates; synthetic approver path from prepare → submit → finance → SG → apply.
- **Cycle status:** read `BudgetCycle` + guideline key dates + submission counts by status.
- **UI:** `/budget/reports` tabs; sidebar + Budget Control link; no new write flows.
