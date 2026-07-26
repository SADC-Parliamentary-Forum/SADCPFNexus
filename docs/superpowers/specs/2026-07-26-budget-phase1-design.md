# Budget Management Phase 1 — Design

**System:** SADC PF Nexus  
**Module:** Budget Management & Budgetary Control  
**Slice:** Phase 1 Foundation (availability + commitment engine)  
**Date:** 2026-07-26  
**Status:** Approved for implementation

---

## Decisions locked

| Topic | Choice |
|-------|--------|
| Scope | Foundation + availability engine; defer full annual prep / governance / variance workflows |
| Schema strategy | Evolve existing `budgets` / `budget_lines` / `budget_reservations` in place |
| PIF commitment | Created/confirmed at Finance certification only (no soft reserve on draft/submit) |
| Actuals | Manual Finance posting + CSV import (no live GL API) |
| Consumers wired | PIF + Travel + Procurement only (Imprest later) |
| Architecture | Approach 1 — evolve spine + commitment ledger columns/transactions |

---

## Product principle

```
Available = Current Approved Allocation − Actual Expenditure − Active Commitments
```

Nexus owns budgets, commitments, and reported actuals. The accounting GL remains authoritative for posted financial transactions.

---

## Architecture

### Module layout

- Services: `api/app/Modules/Budget/Services/`
- Controllers: `api/app/Http/Controllers/Api/V1/Budget/`
- Models: `api/app/Models/` (existing + new)
- Routes: `/api/v1/budget/*` (existing `/finance/budgets` remains as alias/compat)
- Web: `/budget/*` Phase 1 pages; `/finance/budget` redirects or aliases

### Core services (single authority)

1. **FinancialYearService** — Apr–Mar FY config, open/close
2. **FundingSourceService** — funding source master
3. **BudgetLineService** — line CRUD within budgets; activate lines
4. **BudgetAvailabilityService** — transactional availability checks (row lock)
5. **BudgetCommitmentService** — reserve / confirm / transfer / adjust / release / consume; idempotent
6. **BudgetActualService** — manual post + CSV import; Finance-only

Consumers (PIF, Travel, Procurement) **must** call these services. They must not compute balances independently.

---

## Data model (evolve in place)

### New: `financial_years`

- `tenant_id`, `code` (e.g. `2026/27`), `label`
- `starts_on` (default 1 Apr), `ends_on` (default 31 Mar)
- `status`: `planned | open | closing | closed | archived`
- Unique `(tenant_id, code)`

### New: `funding_sources`

- `tenant_id`, `code`, `name`, `type` (member_contributions, own_funds, donor_grant, project_funding, grant_donation, interest, contingency, other)
- Optional donor/agreement fields, currency, start/end, restrictions JSON, `is_active`

### Extend: `budgets`

- `financial_year_id` (nullable FK; backfill from `year` string where possible)
- `status`: `draft | active | revised | closed` (default `active` for existing)
- Keep `year` string for backward compatibility

### Extend: `budget_lines`

- `code` (nullable unique per budget)
- `name` (nullable; fall back to category/description)
- `funding_source_id` nullable FK
- `programme_id` nullable FK
- `department_id` nullable FK
- `original_allocation` (copy from `amount_allocated` on migrate)
- `revised_allocation` nullable
- `is_active` default true
- Optional: `gl_account_code`, `cost_centre`, `parent_line_id`
- Keep `amount_allocated` / `amount_spent` / generated `amount_remaining` for compat; availability service computes from commitments + actuals ledger when present

### Extend: `budget_reservations` → commitment spine

Add columns (keep table name):

- `budget_line_id` nullable FK → `budget_lines`
- `commitment_chain_id` uuid (shared across lineage)
- `parent_commitment_id` nullable self-FK
- `source_type` (pif, travel, procurement, po, contract, manual, other)
- `source_id` unsignedBigInteger
- `source_key` string unique per tenant (e.g. `PIF:123`) for idempotency
- `idempotency_key` nullable unique with tenant
- `original_amount`, `current_amount` (migrate from `reserved_amount`)
- `status`: `proposed | reserved | confirmed | partially_utilised | fully_utilised | released | cancelled | closed`
- Timestamps: `reserved_at`, `confirmed_at`, `released_at` (existing), `consumed_at`
- Keep legacy `budget_line` string as snapshot label; keep `procurement_request_id` / `travel_request_id` for existing queries

### New: `budget_commitment_transactions`

Append-only ledger:

- `budget_reservation_id` (commitment)
- `type`: `reserve | confirm | adjust | transfer | release | consume`
- `amount` (signed where useful; convention: positive reduces available for reserve/confirm)
- `balance_after`
- `actor_id`, `reason`, `meta` JSON
- Never overwrite commitment amounts without a transaction row

### New: `budget_actual_transactions`

- `tenant_id`, `budget_line_id`, `financial_year_id`
- `accounting_reference` (required), `transaction_date`, `posting_date`
- `amount`, `currency`, `base_currency_amount`, `fx_rate` nullable
- `vendor_payee`, `description`
- `source_module`, `source_id` nullable
- `import_batch`, `reconciliation_status` (`unmatched | matched | partial | duplicate | review`)
- `posted_by`

### Optional link: `programme_budget_lines.org_budget_line_id`

Nullable FK to org `budget_lines` so PIF activity envelopes can point at institutional lines without collapsing programme structure.

---

## Commitment lifecycle

Statuses: Proposed → Reserved → Confirmed → Partially/Fully Utilised → Released / Cancelled / Closed

### Lineage rule (non-negotiable)

PIF → Travel / Procurement → PO must **evolve** one chain (`commitment_chain_id` + `parent_commitment_id`), not stack independent commitments.

Example: PIF reserves 100k → Procurement transfers/adjusts to 100k → PO adjusts to 95k (releases 5k) → actuals consume.

### Idempotency

Unique on `(tenant_id, source_key)` and optional `(tenant_id, idempotency_key)`. Retries return existing commitment.

### Concurrency

Availability check + commit inside `DB::transaction` with `lockForUpdate()` on the budget line (or reservation aggregate). Second concurrent request must see insufficient funds.

### Overcommitment

Default: Finance-certified commitment cannot drive available below zero. Override requires explicit reason + authorised role + audit (Phase 1: block only; override API stub deferred).

---

## Consumer integration

### PIF

- Create/edit: Programme Officers select active `budget_line_id`(s) where configured; show availability from API.
- Finance certification (`PUT .../finance-review`): when status is `available` or `confirmed_with_conditions`, create/confirm commitment for certified amount (sum of linked org lines or programme total as policy). Insufficient funds → reject certification (allow status `unavailable` / `partially_available` without committing).
- Rejection/cancellation of programme: release open PIF commitments.
- Keep `budget_availability_status` enum; drive it from service where possible.

### Travel

- Require `budget_line_id` FK to org `budget_lines` when active budgets exist (nullable only for legacy).
- If linked to PIF with existing commitment covering travel: **transfer** portion of chain (do not create a second independent reservation).
- Standalone travel: confirm commitment on SG approve via `BudgetCommitmentService` (replace free-text `TravelBudgetReservationService` body).
- Cancel: release.

### Procurement

- `reserve-budget` accepts `budget_line_id` (+ optional label snapshot).
- If request linked to PIF: transfer/adjust parent commitment.
- Award/PO amount lower: adjust + release difference.
- `assertBudgetConfirmed` checks active commitment on chain, not free-text presence alone.

---

## Availability API shape

`GET /budget/lines/{id}/availability` and `POST /budget/availability/check`

Request: `budget_line_id`, `amount`, `currency`, optional `source_key`

Response:

```json
{
  "approved": 500000,
  "actual": 200000,
  "commitments": 250000,
  "available": 50000,
  "requested": 60000,
  "sufficient": false,
  "warnings": ["insufficient_funds"]
}
```

---

## Commitment API shape

- `POST /budget/commitments/reserve`
- `POST /budget/commitments/{id}/confirm`
- `POST /budget/commitments/{id}/adjust`
- `POST /budget/commitments/{id}/transfer`
- `POST /budget/commitments/{id}/release`
- `POST /budget/commitments/{id}/consume`

All require authenticated Finance (or system actor from consumer service with policy checks).

---

## Actuals

- `POST /budget/actuals` — single Finance post
- `POST /budget/actuals/import` — CSV (columns: accounting_reference, date, budget_line_code, amount, currency, …)
- Recompute / display line actuals from sum of actual transactions (sync `amount_spent` for legacy UI)

---

## Security & SoD

- Programme Officer: read own programme balances; select lines; cannot edit approved allocations or post actuals
- Finance Controller / Director Finance: masters, commitments, actuals, availability certify
- Requester cannot Finance-certify own PIF funds
- Audit all commitment and actual mutations via `AuditLog`

---

## Out of scope (Phase 1)

- Full annual budget preparation through Plenary
- Institutional governance approver portals
- Variance explanation workflow / configurable 20% triggers (basic report ok later)
- Cashflow forecasting, contingency authority matrix UI
- Automated accounting GL API
- Imprest wiring
- Fixed Asset / Stock (next modules after Budget foundation)

---

## Testing (must pass)

- FY Apr–Mar defaults
- Availability formula
- Commitment lifecycle + lineage transfer (no duplicate)
- Concurrent reserve (second fails)
- Idempotent retry
- PIF finance cert creates commitment; insufficient blocks confirm
- Travel from PIF transfers; standalone confirms
- Procurement reserve uses line FK; award saving releases
- Actual import updates available
- Existing Procurement/Travel/PIF regression filters green

---

## Acceptance (Slice A)

1. Financial years configurable; default Apr–Mar
2. Funding sources + budget lines active for selection
3. One availability service used by consumers
4. Commitment ledger with lineage + transactions
5. PIF Finance cert commits; cancel/reject releases
6. Travel + Procurement use commitment service (no silent duplicate)
7. Manual/CSV actuals affect available balance
8. Audit trail on commitment/actual mutations
