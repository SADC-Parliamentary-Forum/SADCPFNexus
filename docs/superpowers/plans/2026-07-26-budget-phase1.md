# Budget Phase 1 Foundation — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or executing-plans. Steps use checkbox syntax.

**Goal:** Make Nexus the authoritative source for budget availability and internal commitments by evolving existing budget tables and wiring PIF, Travel, and Procurement.

**Architecture:** Evolve `budgets` / `budget_lines` / `budget_reservations` in place; add FY, funding sources, commitment transactions, and actuals. Single `BudgetAvailabilityService` + `BudgetCommitmentService`. PIF commits only at Finance certification.

**Tech Stack:** Laravel API, PHPUnit feature tests, Next.js web (minimal Phase 1 UI), existing AuditLog.

**Design:** `docs/superpowers/specs/2026-07-26-budget-phase1-design.md`

**Workspace:** `.worktrees/budget-phase1-foundation` on `feat/budget-phase1-foundation`

---

## Slice A — Foundation shipped 2026-07-26

- [x] Schema migration + models (FY, funding sources, commitment/actual ledgers)
- [x] Availability + commitment services (formula, lineage transfer, idempotency, insufficient funds)
- [x] Actuals service + CSV import
- [x] HTTP API under `/api/v1/budget` + DefaultBudgetSeeder
- [x] PIF finance certification creates/releases commitments
- [x] Travel + Procurement wired to commitment service
- [x] Web `budgetApi` client + procurement reserve accepts `budget_line_id`
- [x] Verification: foundation + PIF + reservation tests green

## Slice B — Web control + pickers + award savings shipped 2026-07-26

- [x] `/budget` control dashboard (approved / actual / committed / available)
- [x] Nav: Finance → Budget Control; `ROUTE_ACCESS` for `/budget`
- [x] Shared `BudgetLinePicker` with live availability
- [x] Procurement reserve UI (queue + detail) uses `budget_line_id`
- [x] Travel create selects institutional `budget_line_id`
- [x] PIF detail Finance certification panel (status + line + commitment amount)
- [x] Procurement award adjusts commitment (savings release)
- [x] Verification: 20 passed (`Budget*` + `BudgetReservationTest`)

## Next slices

- [ ] Variance monitoring workflow
- [ ] Annual preparation / institutional approvals (Phase 2)
- [ ] Imprest consumer wiring
- [ ] Richer Budget reports / exports
- [ ] Fixed Asset Register + Consumables/Stock (after Budget)
