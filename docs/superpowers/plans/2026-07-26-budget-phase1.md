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
- [x] Availability + commitment services
- [x] Actuals service + CSV import
- [x] HTTP API under `/api/v1/budget` + DefaultBudgetSeeder
- [x] PIF / Travel / Procurement commitment wiring
- [x] Foundation tests green

## Slice B — Web control + pickers + award savings shipped 2026-07-26

- [x] `/budget` control dashboard
- [x] Line pickers + PIF finance certify UI
- [x] Award savings release
- [x] Tests green

## Slice C — Variance monitoring shipped 2026-07-27

- [x] `budget_control_settings` (default significant variance **20%**)
- [x] `budget_variances` + `budget_variance_explanations`
- [x] `BudgetVarianceService` snapshot/scan/explain/review
- [x] APIs: `GET/POST /budget/variance*``
- [x] Scheduler command uses availability-backed snapshots + notifications
- [x] Web `/budget/variance` + Finance nav
- [x] Tests: `BudgetVarianceMonitoringTest` (3 passed)

## Next slices

- [ ] Annual preparation / institutional approvals (Phase 2)
- [ ] Imprest consumer wiring
- [ ] Richer Budget reports / exports
- [ ] Fixed Asset Register + Consumables/Stock (after Budget)
