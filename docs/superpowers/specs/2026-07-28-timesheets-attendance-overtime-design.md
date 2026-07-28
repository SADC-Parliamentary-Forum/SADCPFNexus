# Timesheets Phase 1 — Design

**Date:** 2026-07-28  
**Module:** Timesheets, Attendance & Overtime  
**Scope:** PRD §103 Production Critical only (Phase 2/3 deferred)

## Assumptions

1. Default schedule Mon–Fri 08:00–17:00, lunch 13:00–14:00, 8 ordinary hours — stored as configurable schedule, not forever hard-coded.
2. Normal working-day OT multiplier **1.5** is the only seeded rate; weekend/PH rates remain unset until policy is configured (never invented).
3. Leave Phase 1 `ToilCredit` is absent on this tip → TOIL settlement creates idempotent `OvertimeAccrual` linked from `overtime_settlements`.
4. Formal Assignments may arrive via rebase; entries support both `assignment_id` and legacy `work_assignment_id`.
5. Attendance biometric/device ingestion and surveillance analytics are out of Phase 1 (statuses/exceptions table stubs only where needed for reconciliation flags).

## Architecture

```
Employee Schedule ──► Expected Hours
        │
Timesheet Period (open/closed/exported)
        │
Timesheet (weekly) ── entries ──► Assignment / PIF / Project / Leave / Travel links
        │
   submit → supervisor review → (optional HR validate) → lock
        │
Overtime Requisition (planned) ──► Actual OT ──► HR validate
                                      │
                          settlement: PAY xor TOIL
                                      │
                     payroll_export_batch  |  OvertimeAccrual (TOIL)
```

### Critical rules (§106) enforcement points

| Rule | Enforcement |
|------|-------------|
| Timesheets ≠ Assignment completion | No status write-back to Assignment on timesheet save |
| Timesheets ≠ attendance proof | No auto-present from clock; attendance_records optional/manual |
| OT authorised before work | Actual OT requires approved requisition (or flagged emergency) |
| Planned ≠ actual | Separate `overtime_requisitions` / `overtime_actual_entries` |
| No self-approve | Actor ≠ owner on timesheet approve and OT approve/validate |
| HR validates; Finance pays | Distinct statuses + permissions |
| Pay XOR TOIL | Settlement unique per actual; second settlement type rejected |
| Weekend travel ≠ auto OT/TOIL | No auto-create from travel days |
| Leave/travel linked | Prefill locked rows; block ordinary work on leave days |
| No silent edits | Submitted+ edits require return/correction + audit event |
| Closed/exported corrections | Period status gate |
| No invented weekend/PH rates | Rate lookup returns null → reject calc unless policy configured |
| Traceable payroll/TOIL | Settlement + export lines reference actual OT id |

## Data model (Phase 1)

**New tables:** `employee_work_schedules`, `employee_schedule_assignments`, `timesheet_periods`, `timesheet_days`, `timesheet_entry_source_links`, `timesheet_audit_events`, `overtime_rate_policies`, `overtime_requisitions`, `overtime_requisition_employees`, `overtime_actual_entries`, `overtime_settlements`, `payroll_export_batches`, `payroll_export_lines`

**Extend:** `timesheets` (period_id, expected_hours, accounted_hours, reconciliation_status, hr_validated_*, declaration_accepted_at), `timesheet_entries` (assignment_id, pif_id, programme_id, start_time, end_time, entry_category)

## Services

- `TimesheetService` — schedules/expected hours, leave prefill+block, overlap, submit/return/approve, reconciliation, audit events, weekly-summary payload
- `OvertimeService` — requisition lifecycle, actuals, rate policy, HR validate, settle pay/TOIL (idempotent), emergency flag
- `TimesheetPayrollExportService` — batch create from validated paid settlements; idempotent re-send

## API (additive under `/api/v1/hr/...` and `/api/v1/overtime/...`)

Preserve existing `/hr/timesheets/*`. Add schedule/period/entry/return/reconciliation endpoints and full OT + payroll export routes per PRD §89 (subset).

## Permissions (additive)

Keep legacy `timesheets.view|create|approve`. Add PRD §90 set; map Staff/HR/Finance/SG roles.

## Weekly Summary contract

Enrich `getTimesheetSummary()` with: `expected_hours`, `accounted_hours`, `overtime_planned_hours`, `overtime_actual_hours`, `leave_days`, `travel_days`, `reconciliation` — without becoming a performance ranking feed.

## UI

Expand Timesheets sidebar toward §6 (employee OT, team pending, HR schedules/OT validation, Finance payroll export). Minimal pages for schedules, OT requests, payroll export queue; deepen existing timesheet grid later.

## Deferred (Phase 2/3)

Donor templates, deep payroll API, biometric attendance, capacity analytics, project cost rates privacy UI, offline field timesheets, AI suggestions, anomaly detection.
