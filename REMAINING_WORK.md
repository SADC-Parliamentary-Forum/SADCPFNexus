# SADC PF Nexus - Remaining Work (production readiness)

**Last updated:** 2026-07-26  
**Status:** Budget Phase 1 foundation started on `feat/budget-phase1-foundation` (isolated worktree). Leave Phase 1 remains local on `main` WIP.

---

## In progress - Budget Phase 1 (2026-07-26/27)

- Design: `docs/superpowers/specs/2026-07-26-budget-phase1-design.md`
- Plan: `docs/superpowers/plans/2026-07-26-budget-phase1.md`
- Slice A: availability/commitment engine + PIF/Travel/Procurement service wiring
- Slice B: `/budget` dashboard, line pickers, PIF finance certify UI, award savings release
- Slice C: variance monitoring (20% significant threshold, explanation workflow, `/budget/variance`)
- Tests: Budget foundation + PIF + award savings + reservation + variance monitoring

**Still next for Budget:**
- [ ] Annual budget preparation / governance approval path (Phase 2)
- [ ] Imprest wiring
- [ ] Fixed Asset Register + Consumables/Stock (after Budget control layer)

---

## Reference

- Deploy: `scripts/deploy.sh`
- Budget API: `/api/v1/budget`
- Existing Finance budgets UI: `/finance/budget`
