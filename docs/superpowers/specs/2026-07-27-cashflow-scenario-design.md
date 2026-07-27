# Cashflow / Scenario Planning — Phase 1 design

**Date:** 2026-07-27  
**Stream:** C — Cashflow / scenario (after Budget reports + Fixed Asset/Stock)  
**Branch / worktree:** `feat/cashflow-scenario` @ `.worktrees/cashflow-scenario`  
**Status:** Design + first vertical slice

## Assumptions

1. Nexus owns budgets, commitments, and reported actuals — it does **not** replace the accounting GL or bank ledger.
2. True bank cash position is unavailable; “opening balance” is a Finance-entered scenario assumption (manual), not synced from banks.
3. Open commitments have no native `expected_cash_date`; Phase 1 resolves expected outflow month by joining `source_type` / FKs to module dates, with a deterministic fallback.
4. Member-contribution / donor receipt schedules are not modelled as masters yet — Phase 1 inflows come only from scenario adjustments.
5. Auth mirrors Budget reports (read: authenticated tenant user) and Budget writes (`finance.create` / `finance.admin` / `procurement.manage_budget` / Finance Controller).
6. Apr–Mar financial years remain the default calendar for monthly buckets.

## What already existed

- Budget Phase 1–2 spine: FY, funding sources, lines, availability, commitments, actuals, cycles, change control, variance.
- Read-only reports pack: utilisation, commitment ageing, change register, cycle status.
- Module wiring that creates commitments (PIF, travel, procurement, imprest) with lifecycle timestamps.
- Explicit deferral of cashflow/scenario in Budget Phase 1 and Phase 2 annual-cycle designs.
- **No** cashflow models, services, routes, or UI stubs.

## Approaches considered

1. **Read-only cashflow report only** — monthly actuals + commitment projections, no scenario tables. Fast, but cannot capture opening cash or what-if timing/amount shifts Finance needs.
2. **Scenario overlay + forecast (chosen)** — lightweight `cashflow_scenarios` + period adjustments layered on a forecast built from actuals/commitments. Does not mutate budget lines, commitments, or GL.
3. **Full treasury (bank accounts, feeds, reconciliation)** — wrong ownership for Nexus Phase 1; deferred.

## MVP scope (Phase 1 slice)

### In scope

- Monthly forecast for a financial year:
  - **Actual outflows:** `budget_actual_transactions` summed by `transaction_date` month.
  - **Projected outflows:** open `budget_reservations` (`isActive()` rules) assigned to a month via expected-cash resolution.
  - **Scenario overlay:** opening balance + manual inflow/outflow adjustments by `YYYY-MM`.
  - **Running balance** per month.
- Scenario CRUD (draft/active/archived) scoped to tenant + FY.
- Adjustment create/delete on a scenario.
- API under `/api/v1/budget/cashflow/*`.
- Web page `/budget/cashflow` + Finance sidebar link.
- Feature tests covering forecast math, date resolution fallback, scenario overlay, and write auth.

### Out of scope

- Bank balances / GL sync / double-entry.
- Automated member-contribution calendars.
- Multi-currency FX projection engine.
- Mutating commitments or budget allocations from scenarios.
- Mobile parity.
- Optimistic/pessimistic auto-generators (kinds are labels only in Phase 1).

## Expected-cash date resolution

For each active commitment, pick the first available date:

| Priority | Source | Field |
|---|---|---|
| 1 | `source_type = invoice` | `invoices.due_date` (by `source_id`) |
| 2 | `source_type = imprest` | `imprest_requests.expected_liquidation_date` |
| 3 | travel (`source_type` or `travel_request_id`) | `travel_requests.departure_date` |
| 4 | procurement (`source_type` or `procurement_request_id`) | `procurement_requests.required_by_date` |
| 5 | Fallback | `confirmed_at` → `reserved_at` → `created_at` |

Period key = `Y-m` of that date. Amounts outside the selected FY window still appear in forecast totals as `out_of_range_projected` for visibility.

## Data model

### `cashflow_scenarios`

- `tenant_id`, `financial_year_id`
- `name`, `kind` (`base` \| `optimistic` \| `pessimistic` \| `custom`)
- `opening_balance` (decimal), `currency` (default NAD)
- `status` (`draft` \| `active` \| `archived`)
- `notes`, `created_by`
- timestamps

### `cashflow_scenario_adjustments`

- `cashflow_scenario_id`
- `period` (`YYYY-MM`)
- `direction` (`inflow` \| `outflow`)
- `amount` (> 0)
- `label`, `category` (default `manual`)
- `budget_reservation_id` nullable (for future timing-shift links)
- `meta` JSON nullable
- timestamps

## API

| Method | Path | Auth |
|---|---|---|
| `GET` | `/budget/cashflow/forecast` | authenticated (tenant) |
| `GET` | `/budget/cashflow/scenarios` | authenticated |
| `POST` | `/budget/cashflow/scenarios` | finance write |
| `GET` | `/budget/cashflow/scenarios/{id}` | authenticated + tenant |
| `PUT` | `/budget/cashflow/scenarios/{id}` | finance write |
| `DELETE` | `/budget/cashflow/scenarios/{id}` | finance write |
| `POST` | `/budget/cashflow/scenarios/{id}/adjustments` | finance write |
| `DELETE` | `/budget/cashflow/scenarios/{id}/adjustments/{adjustment}` | finance write |

### Forecast query params

- `financial_year_id` (required)
- `scenario_id` (optional)
- `department_id`, `funding_source_id` (optional filters on lines/commitments/actuals)
- `as_of` (optional; default today)

### Forecast response (shape)

```json
{
  "success": true,
  "data": {
    "financial_year": { "id": 1, "code": "2026/27", "starts_on": "...", "ends_on": "..." },
    "scenario": null,
    "as_of": "2026-07-27",
    "currency": "NAD",
    "opening_balance": 0,
    "periods": [
      {
        "period": "2026-04",
        "actual_outflow": 0,
        "projected_outflow": 0,
        "scenario_inflow": 0,
        "scenario_outflow": 0,
        "net": 0,
        "closing_balance": 0
      }
    ],
    "totals": {
      "actual_outflow": 0,
      "projected_outflow": 0,
      "scenario_inflow": 0,
      "scenario_outflow": 0,
      "closing_balance": 0
    },
    "out_of_range_projected": { "count": 0, "amount": 0 },
    "items": []
  }
}
```

`items` lists projected commitment rows with resolved `expected_cash_date`, `period`, amount, source metadata.

## Running balance formula

```
closing[0] = opening_balance + scenario_inflow[0] − actual_outflow[0] − projected_outflow[0] − scenario_outflow[0]
closing[n] = closing[n-1] + scenario_inflow[n] − actual_outflow[n] − projected_outflow[n] − scenario_outflow[n]
net[n]     = scenario_inflow[n] − actual_outflow[n] − projected_outflow[n] − scenario_outflow[n]
```

Note: actuals already posted are **not** double-counted against the same commitment (projected uses open commitment balance only). Consumed/released commitments drop out of projection automatically.

## UI

- `/budget/cashflow`: FY selector, optional scenario selector, Create scenario panel (name, kind, opening balance), monthly table, projected items expandable/list, add adjustment form when a scenario is selected.
- Sidebar: “Cashflow / Scenarios” under Finance, after Budget Reports.
- Reuse existing card / table / form patterns from `/budget/reports`.

## Testing

- Forecast buckets actuals into correct months.
- Open commitment lands in month from travel/imprest/procurement/invoice date; fallback uses reserved_at.
- Scenario opening + adjustments change closing balances.
- Non-finance user cannot create scenarios (403).
- Unauthenticated → 401.
- Tenant isolation on scenario show/update.

## Follow-ons (not this slice)

- Optional `expected_cash_date` on `budget_reservations` filled at reserve/confirm time.
- Donor/membership receipt schedules as structured inflows.
- Compare two scenarios side-by-side.
- Export CSV / PDF.
- Tighten report read ACL to `finance.view` consistently with cashflow.
