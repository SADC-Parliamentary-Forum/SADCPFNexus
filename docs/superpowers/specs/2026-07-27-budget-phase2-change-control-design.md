# Budget Phase 2 Slice B — Mid-year Change Control

**System:** SADC PF Nexus  
**Module:** Budget Management & Budgetary Control  
**Slice:** Phase 2 B — Transfers, revisions, supplementary, contingency  
**Date:** 2026-07-27  
**Status:** Approved for implementation (Approach 1)

---

## Decisions locked

| Topic | Choice |
|-------|--------|
| Scope | Full set: transfer, revision, supplementary, contingency |
| Approvals | Finance for transfers & small revisions; SG for large revisions, supplementary, contingency |
| Small revision | Configurable % of line `original_allocation` (default 10%) |
| Contingency | Dedicated contingency budget lines → target lines |
| Supplementary | Increase existing and/or create new active lines |
| Architecture | Change-request packs + apply engine on Phase 1 spine |

---

## Architecture

See Design §1 in conversation. Services: `BudgetChangeRequestService`, `BudgetChangeApplyService`. Setting: `revision_finance_ceiling_pct`.

### Status machine

```
draft → pending_finance → pending_sg → approved → applied
                 ↘ returned / rejected
```

### Apply effects

- **transfer:** decrease source `revised_allocation` (or current approved), increase target; net zero
- **revision:** set target line `revised_allocation` = current ± delta
- **supplementary:** increase and/or create lines with new allocations
- **contingency:** like transfer from `is_contingency` source lines only

Availability check after projected apply must not go negative.

---

## Data model

### Extend `budget_control_settings`

- `revision_finance_ceiling_pct` decimal default 10

### Extend `budget_lines`

- `is_contingency` boolean default false

### `budget_change_requests`

- tenant_id, financial_year_id, budget_id
- type: transfer|revision|supplementary|contingency
- title, status, justification
- requires_sg boolean
- prepared_by, submitted_at
- finance_decided_by/at, finance_comments
- sg_decided_by/at, sg_comments
- applied_at, applied_by
- rejected_reason

### `budget_change_items`

- budget_change_request_id
- source_budget_line_id nullable
- target_budget_line_id nullable
- new_line_code/name/category/funding_source_id nullable (supplementary create)
- amount (signed meaning depends on type; always positive magnitude with direction via source/target)
- notes, sort_order

---

## APIs

- `GET/POST /budget/changes`
- `GET/PUT /budget/changes/{id}`
- `POST /budget/changes/{id}/submit`
- `POST /budget/changes/{id}/finance-decide` (approve|return|reject)
- `POST /budget/changes/{id}/sg-decide` (approve|return|reject)
- `POST /budget/changes/{id}/apply`

## Web

- `/budget/changes`, `/budget/changes/[id]`, `/budget/changes/create`
- Nav under Finance

## Testing

- Transfer apply updates both lines; availability ok
- Small revision Finance-only; large requires SG
- Contingency rejects non-contingency source
- Supplementary creates line
- Apply blocked when insufficient available
