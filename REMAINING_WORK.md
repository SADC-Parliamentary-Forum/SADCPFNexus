# SADC PF Nexus - Remaining Work (production readiness)

**Last updated:** 2026-07-26  
**Status:** Budget Phase 1 foundation started on `feat/budget-phase1-foundation` (isolated worktree). Leave Phase 1 remains local on `main` WIP.

---

## In progress - Budget Phase 1 foundation (2026-07-26)

- Design: `docs/superpowers/specs/2026-07-26-budget-phase1-design.md`
- Plan: `docs/superpowers/plans/2026-07-26-budget-phase1.md`
- Shipped in this branch:
  - Financial years (default Apr–Mar), funding sources
  - Extended `budgets` / `budget_lines` / `budget_reservations` commitment spine
  - Commitment transaction ledger + actual expenditure (manual + CSV)
  - `BudgetAvailabilityService` + `BudgetCommitmentService` (lineage transfer, idempotency)
  - APIs under `/api/v1/budget/*`
  - PIF finance certification creates/releases commitments
  - Travel + Procurement use commitment service (no duplicate stacking)
  - Tests: `BudgetPhase1Foundation`, `BudgetPifIntegration`, updated `BudgetReservationTest`

**Still next for Budget:**
- [ ] Full web Budget nav/dashboard (Phase 1 pages)
- [ ] PIF/Travel/Procurement UI budget-line pickers (replace free-text)
- [ ] Procurement award savings release UX
- [ ] Variance monitoring workflow
- [ ] Annual budget preparation / governance approval path (Phase 2)
- [ ] Imprest wiring
- [ ] Fixed Asset Register + Consumables/Stock (after Budget control layer)

---

## Reference

- Deploy: `scripts/deploy.sh`
- Budget API: `/api/v1/budget`
- Existing Finance budgets UI: `/finance/budget`
