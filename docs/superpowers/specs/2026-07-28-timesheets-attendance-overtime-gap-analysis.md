# Timesheets, Attendance & Overtime — Gap Analysis

**Date:** 2026-07-28  
**Base:** `feat/timesheets-phase1` @ `main` tip (`93f0d8b`)  
**PRD:** `2026-07-28-timesheets-attendance-overtime-prd.md` (§103 Phase 1)

## Existing assets (extend, do not replace)

| Area | Status |
|------|--------|
| Weekly timesheet header + entries | Exists (`Timesheet`, `TimesheetEntry`) |
| Project catalog | Exists (`TimesheetProject`) |
| Submit / approve / reject + workflow | Exists (`TimesheetService`, `WorkflowService`) |
| Self-approve block | Exists (controller) |
| Leave / travel / holiday lookup APIs | Exists (not enforced on save) |
| Travel TOIL pipeline | Exists (separate from timesheet OT) |
| `OvertimeAccrual` | Exists (travel/LIL store; Leave Phase 1 `ToilCredit` **not** on this tip) |
| WorkAssignment link on entries | Exists |
| Formal Assignment FK | Missing |
| PIF FK on entries | Missing |
| Weekly Summary timesheet counts | Exists (`WeeklySummaryDataService::getTimesheetSummary`) — counts only |
| Web UI (my/team/monthly/history) | Exists |
| Dedicated PHPUnit for timesheets | **None** |

## Phase 1 gaps (§103)

| Capability | Gap |
|------------|-----|
| Employee schedules | Missing — hard-code defaults only in UI assumptions |
| Timesheet periods / locking | Missing — ISO week only |
| Expected-hour reconciliation | Missing |
| Leave/travel hard integration | Soft badges only; ordinary work on leave not blocked |
| Overlap validation | Missing |
| Assignment / PIF / programme links | Partial (projects + work_assignment) |
| OT requisitions + advance approval | Missing |
| Planned vs actual OT | Missing |
| Rate policy (1.5 normal day; no invented weekend/PH) | Missing |
| HR validation / Finance segregation | Missing for OT |
| Payroll export batches | Missing (CSV report only) |
| TOIL transfer from timesheet OT | Missing (use `OvertimeAccrual` until Leave Phase 1 merges) |
| No pay+TOIL double settle | Missing |
| Audit event table | Partial (`AuditLog` only on submit/approve/reject) |
| Permissions (PRD §90) | Thin (`view/create/approve`); under-enforced |
| PDF / Excel | Missing dedicated exports |
| Nav toward §6 | Partial employee menu only |

## Integration risks

1. **Leave Phase 1 TOIL** (`ToilCredit`) is not on this tip — Phase 1 TOIL settlement writes idempotent `OvertimeAccrual` + settlement row; bridge when Leave merges.
2. **Assignments Phase 1** may land mid-flight — entries gain nullable `assignment_id` + keep `work_assignment_id`.
3. Weekend travel must **not** auto-create OT/TOIL (Travel TOIL remains opt-in via its own flow).

## Recommendation

Extend the existing Timesheets module with a foundation migration, fat domain services, OT requisition lifecycle, schedule/period models, hard leave/overlap rules, payroll/TOIL settlement with idempotency, enriched Weekly Summary contract, expanded permissions/nav, and PHPUnit covering §106 rules.
