# Budget Phase 2 A1 — Annual Cycle Implementation Plan

**Goal:** Annual budget cycle from open through SG approve to lock/activate institutional budget lines.

**Design:** `docs/superpowers/specs/2026-07-27-budget-phase2-annual-cycle-design.md`

**Workspace:** `.worktrees/budget-phase1-foundation` on `feat/budget-phase1-foundation`

**Status:** Implemented 2026-07-27

---

## Slice A1 tasks

### Task 1: Schema + models ✅
- Migration `2026_07_27_070000_budget_phase2_annual_cycle.php`
- Models: BudgetCycle, BudgetGuideline, BudgetSubmission, BudgetSubmissionItem, BudgetCycleApproval

### Task 2: Services ✅
- BudgetCycleService, BudgetSubmissionService, BudgetActivationService

### Task 3: HTTP API + routes ✅
- `/budget/cycles/*` and `/budget/submissions/*`

### Task 4: Web pages ✅
- `/budget/cycles`, `/budget/cycles/[id]`, `/budget/submissions/[id]`
- Nav: Budget Cycles

### Task 5: Tests ✅
- `BudgetAnnualCycleTest` (4 tests)

### Task 6: Commit / deploy
- Follow-up after user confirmation
