# Budget Phase 2 Slice A1 — Annual Cycle Design

**System:** SADC PF Nexus  
**Module:** Budget Management & Budgetary Control  
**Slice:** Phase 2 A1 — Annual budget cycle through SG lock/activate  
**Date:** 2026-07-27  
**Status:** Approved for implementation (Approach 1)

---

## Decisions locked

| Topic | Choice |
|-------|--------|
| Stream | Annual budget cycle & institutional approvals |
| Depth | Through SG + lock/activate (FSC/EXCO/Plenary decision records later) |
| Line creation | Submissions are drafts; activation materialises `budget_lines` |
| Workflow | Hybrid: cycle status machine + optional HOD approval ticket on department submissions |
| Architecture | Cycle + submission packs + versioned items → activate Phase 1 spine |

---

## Product principle

Phase 1 answers: *Can I fund this activity?*  
Phase 2 A1 answers: *How did this year’s approved budget get assembled and locked?*

After SG lock, institutional lines become the same Phase 1 `budget_lines` used by PIF / Travel / Procurement.

---

## Architecture

### Services

- `BudgetCycleService` — open/close cycle, publish guidelines, stage transitions, SG approve, lock
- `BudgetSubmissionService` — CRUD packs/items; submit; optional HOD workflow; Finance return
- `BudgetActivationService` — on lock, create/update `budgets` + `budget_lines` for the FY; set cycle Active

### Stage machine (`budget_cycles.status`)

```
not_open → planning → department_preparation → submitted_to_finance
  → finance_review → management_review → sg_approved → active
```

Side paths: `returned_for_correction` (from finance_review back to department_preparation).  
Terminal later: `closed` / `archived` (not required for A1 UI beyond status field).

### Role gates (A1)

| Action | Who |
|--------|-----|
| Open cycle / publish guidelines | Finance Controller / finance.admin |
| Prepare & submit department pack | HOD (or Programme Manager for programme packs) |
| HOD approve ticket (optional) | Configured workflow approver |
| Finance review / return / consolidate | Finance Controller |
| Advance to Management / SG | Finance Controller |
| SG approve proposed budget | Secretary General |
| Lock & activate | Finance Controller after SG approved (or SG with finance.admin) |

---

## Data model

### `budget_cycles`

- tenant_id, financial_year_id (unique per tenant+FY)
- status (see above)
- opened_by, opened_at, locked_at, locked_by
- notes

### `budget_guidelines`

- budget_cycle_id
- submission_opens_on, department_deadline
- assumptions, inflation_rate, fx_assumptions (text/json)
- ceilings JSON nullable
- guidance_document_path nullable
- published_at, published_by

### `budget_submissions`

- budget_cycle_id, department_id nullable, programme_id nullable
- type: `department | programme | capital | revenue`
- title, status: `draft | pending_hod | submitted | returned | accepted | consolidated`
- prepared_by, submitted_at, returned_reason
- approval_request_id nullable (HOD workflow)
- motivation, attachments meta later

### `budget_submission_items`

- budget_submission_id
- funding_source_id nullable
- category, code nullable, name, description
- quantity, unit_rate, calculated_amount, requested_amount
- prior_year_amount nullable (display only; not auto-baseline)
- justification
- workplan_ref nullable
- sort_order

### `budget_cycle_approvals`

- budget_cycle_id
- stage (finance_review | management_review | sg_approved)
- decision: approved | returned
- decided_by, decided_at, comments
- approved_total nullable

On **lock**:

1. Ensure one institutional `budgets` row for the FY (`status=active`).
2. For each accepted/consolidated submission item, upsert `budget_lines` (code+budget_id unique where code present).
3. Set `original_allocation` / `amount_allocated` from approved requested_amount.
4. Mark cycle `active`, set locked_at.

---

## Out of scope (A1)

- Live FSC / EXCO / Plenary voting
- Transfers / revisions / supplementary / contingency
- Cashflow forecasting, scenario budgeting
- GL API, Imprest wiring, Fixed Assets

---

## APIs (suggested)

- `GET/POST /budget/cycles`
- `POST /budget/cycles/{id}/guidelines`
- `POST /budget/cycles/{id}/advance`
- `POST /budget/cycles/{id}/sg-approve`
- `POST /budget/cycles/{id}/lock`
- `GET/POST /budget/submissions`
- `POST /budget/submissions/{id}/submit`
- `POST /budget/submissions/{id}/return`

---

## Testing

- Open cycle for FY
- Create submission with items; submit
- Finance return / accept
- Advance through Management → SG approve
- Lock materialises budget_lines; availability uses new approved amounts
- SoD: staff cannot lock; requester cannot SG-approve
