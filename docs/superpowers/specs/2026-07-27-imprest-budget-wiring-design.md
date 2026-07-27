# Budget Phase 2 — Imprest Commitment Wiring

**System:** SADC PF Nexus  
**Module:** Budget Management & Budgetary Control / Imprest  
**Date:** 2026-07-27  
**Status:** Approved for implementation (Approach 1)

## Decisions locked

| Topic | Choice |
|-------|--------|
| When to commit | On workflow/legacy approval (Travel pattern) |
| Line identity | `budget_line_id` FK + free-text fallback |
| Retirement | Consume liquidated; release unused; post actual for liquidated |
| Travel link | Prefer transfer from `TRAVEL:{id}` when linked |
| Architecture | `ImprestBudgetReservationService` adapter |

## Hooks

- Approve → `reserveOnApprove` (`IMPREST:{id}`)
- Reject / withdraw → `releaseOnCancel`
- Retire → `settleOnRetire` (adjust/consume + actual post)
