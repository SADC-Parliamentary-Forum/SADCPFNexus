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
- [x] Verification: `php artisan test --filter="BudgetPhase1Foundation|BudgetPifIntegration|BudgetReservationTest"` → 19 passed

## Next slices

- [ ] Budget web nav/dashboard pages
- [ ] PIF/Travel/Procurement UI line pickers
- [ ] Award/PO commitment adjust + savings release
- [ ] Variance monitoring
- [ ] Annual preparation / institutional approvals (Phase 2)
- [ ] Imprest consumer wiring
