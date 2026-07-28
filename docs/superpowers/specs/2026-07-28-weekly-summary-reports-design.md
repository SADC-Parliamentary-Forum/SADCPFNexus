# Weekly Summary Reports Phase 1 — Design

**Date:** 2026-07-28  
**Scope:** PRD §118 Production Critical; §121 architecture rules non-negotiable.

## Assumptions

1. Parent/user authorized full Phase 1; interactive brainstorm approval waived for subagent delivery.
2. Email digest (`weekly_summary_*`) remains separate; new operational tables use `weekly_report*` / `/weekly-summaries`.
3. Supervisor defaults to `departments.supervisor_id` for the employee’s department.
4. Assignments feed at `GET /assignments/weekly-summary-feed` is the primary suggestion source.
5. Timesheets suggestions are a documented hook until Timesheets merges.
6. Consolidation creates destination items + `weekly_report_consolidation_links`; source employee reports are immutable after accept (except audited reopen/correction).
7. Phase 2/3 features get sidebar stubs only where navigation already implies them.

## Status models

### Period
`upcoming` → `open` → `submission_due` → `employee_closed` → `supervisor_review` → `department_consolidation` → `management_review` → `published` → `closed` → (`reopened`) → `archived`

### Individual report
`not_started` → `draft` → `in_progress` → `ready` → `submitted` → `pending_review` → (`returned` → `resubmitted`) → `accepted` → `included_in_department` → `closed`  
Also: `exempted`, `no_report_required`, `archived`, `reopened`

### Department / institutional
`draft` → `in_progress` → `ready` → `published` (versioned) → `closed`

## Data model (relational items, not one blob)

- `weekly_reporting_periods` — calendar week + due timestamps + config snapshot
- `weekly_reports` — individual | department | institutional; unique active per (employee|dept|institution) × period
- `weekly_report_items` — achievements, WIP, meetings, notes (`section_type` + structured JSON)
- `weekly_report_blockers`, `_decision_requests`, `_priorities`, `_risks`, `_support_requests` — structured actionable rows
- `weekly_report_reviews`, `_versions`, `_consolidation_links`, `_exemptions`, `_deadline_changes`, `_documents`, `_audit_events`
- `weekly_report_suggestion_decisions` — include/exclude without creating items until confirmed

## Suggestion flow

1. Resolve period + employee.
2. Query Assignments feed (auth + confidentiality already applied).
3. Optionally query leave (full-week exemption), travel, correspondence, PIF (permission-scoped).
4. Optionally Timesheets adapter if class/method exists.
5. Return suggestions; **no report rows created**.
6. `include-suggestion` creates item/blocker/priority with source snapshot; `exclude-suggestion` records decision only.

## Review & SoD

- Employee cannot accept/return own report.
- Supervisor/HOD with `weekly-reports.review-team` / department supervisor may review team.
- Return requires reason + preserves submitted version snapshot.
- Accept creates version record; subsequent edits require reopen/correction path.

## Consolidation

- Department report selects source items via API; writes **new** consolidated narrative items.
- Links record source employee, source item, edited narrative, selector, timestamp.
- Source employee report rows are never updated by consolidation.
- Duplicate events: consolidator picks one narrative; multiple source links allowed.

## Management decisions

- `record-decision` on decision request creates Assignment (`source_type=weekly_summary`) and/or Risk when follow-up required.
- Idempotent on `(tenant, source_type, source_id, source_purpose)`.

## Confidentiality

- Suggestions omit confidential sources unless viewer is party / has confidential permission.
- Consolidation refuses confidential sources unless destination confidentiality ≥ source and actor authorized.
- Exports/notifications strip confidential narratives for unauthorized recipients.

## Exports

- PDF via DomPDF blade (individual / department / institutional).
- Excel: CSV of items (Phase 1).
- Word: HTML-as-.doc download (Phase 1 pragmatic); rich Word deferred.

## API (under `/api/v1/weekly-summaries`)

Per PRD §98: dashboard, periods, current, CRUD, items, submit/return/accept/reopen, suggestions include/exclude, department/institutional consolidate/publish, create-assignment/risk/record-decision/carry-forward, exemptions, extend-deadline, export.

## Permissions

PRD §101 set seeded; staff gets own create/edit/submit/view; HOD/Director get team review + department consolidate; System Admin gets all via existing sync.

## Testing (PHPUnit)

One report/employee/period; suggestions don’t auto-submit; no self-accept; confidentiality on suggestions; consolidation doesn’t mutate source; carry-forward history; decision→assignment; leave exemption; idempotent create/submit.
