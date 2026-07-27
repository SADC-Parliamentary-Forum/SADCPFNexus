# SADC PF Nexus - Remaining Work (production readiness)

**Last updated:** 2026-07-27  
**Status:** Fixed Asset + Stock Phase 1 capitalisation slice on `feat/fixed-asset-stock` (from budget worktree). Leave Phase 1 remains local on `main` WIP.

---

## In progress - Fixed Asset + Stock Phase 1 (2026-07-27)

- Design: `docs/superpowers/specs/2026-07-27-fixed-asset-stock-phase1-design.md`
- Plan: `docs/superpowers/plans/2026-07-27-fixed-asset-stock-phase1.md`
- Slice: pending FA capitalise/reject + stock GRN inbound ledger + pending UI

**Still next for FA/Stock:**
- [ ] Declining-balance NBV parity on API
- [ ] Disposal / revaluation workflows
- [ ] Optional budget-line link (only if product requires)

---

## Done recently - Budget (live through edaa54c)

- Phase 1 foundation + variance
- Phase 2 annual cycle, institutional decisions, mid-year changes
- Imprest wiring
- Budget reports pack

**Optional Budget follow-ons:**
- [ ] Cashflow / scenario forecasting
- [ ] UX polish on budget pickers

---

## Reference

- Deploy: `scripts/deploy.sh`
- Budget API: `/api/v1/budget`
- Assets: `/assets` (capitalise pending via `/api/v1/assets/{id}/capitalise`)
- Stock: `/stock`
