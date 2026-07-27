# Cashflow / Scenario — Phase 1 implementation plan

**Date:** 2026-07-27  
**Spec:** `docs/superpowers/specs/2026-07-27-cashflow-scenario-design.md`  
**Branch:** `feat/cashflow-scenario`

## Done in this slice

1. Migration `cashflow_scenarios` + `cashflow_scenario_adjustments`
2. Forecast service (actuals by month + open commitments with module date resolution + scenario overlay)
3. Scenario CRUD + adjustments API
4. Web page `/budget/cashflow` + sidebar + API client types
5. Feature tests `BudgetCashflowScenarioTest` (7 passing)

## Follow-ons

- `expected_cash_date` on reservations at reserve/confirm
- Structured membership/donor receipt calendars
- Side-by-side scenario compare + CSV export
- Tighten read ACL to `finance.view` consistently
