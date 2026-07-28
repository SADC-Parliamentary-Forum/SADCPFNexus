# Weekly Summary Reports — Gap Analysis

**Date:** 2026-07-28  
**Base:** `SADCPFNexus/main` @ `52c04d1` (Assignments Phase 1)  
**PRD:** `2026-07-28-weekly-summary-reports-prd.md` (§118 Phase 1)

## Existing vs required

| Capability | Current state | Gap |
|---|---|---|
| Email digest `weekly_summary_*` | Exists (auto-generated inbox digest) | **Different product** — keep; do not overload |
| Operational employee weekly report | Missing | New `weekly_reports*` schema + APIs |
| Reporting periods / due dates | Missing | New `weekly_reporting_periods` |
| Assignment suggestions | `GET /assignments/weekly-summary-feed` shipped | Wire as read-only suggestions; never auto-submit |
| Timesheet suggestions | Email digest enrichment on `feat/timesheets-phase1` only | Hook stub until Timesheets merges |
| Leave / travel / correspondence / PIF links | Source modules exist | Suggestion adapters (auth-filtered) |
| Supervisor review / return / accept | Missing | Workflow + no self-accept |
| Department consolidation | Missing | Select/edit narrative via consolidation links; never mutate source |
| Institutional consolidation | Missing | Management report type + publish |
| Missing-report monitoring | Missing | Period compliance queries + notifications |
| Confidentiality | Assignment feed already filters | Enforce on suggestions, exports, consolidation |
| PDF / Word / Excel export | DomPDF available | PDF Phase 1; Word/Excel as structured export |
| Versioning / audit | Missing | Versions on publish/accept; audit events |
| Decision → Assignment / Risk | Assignment `source_type=weekly_summary` allow-listed | Create from decision/blocker items |
| Carry-forward history | Missing | Priority rows with parent_priority_id |

## Naming collision

Existing `WeeklySummaryReport` / `/weekly-summary/*` = **email digest**.  
New module uses `WeeklyReport` / `/weekly-summaries/*` = **operational progress reporting**.

## Phase 1 in / Phase 2–3 out

**In (§118):** periods, employee report sections, suggestions, submit/review/return, dept+institutional consolidation, compliance, notifications, confidentiality, dashboards, exports, audit.

**Deferred:** AI drafting, advanced calendar suggestions, donor templates, cross-dept support workflows, advanced decision register, trend analytics, archive migration, auto management packs.

## Implemented vs deferred (this delivery)

### Implemented (Phase 1 §118)
- Weekly reporting periods (auto ensure Mon–Fri)
- Individual employee report + structured sections (achievements, WIP, meetings/notes, blockers, decisions, risks, priorities, support)
- Assignment suggestions via existing `weekly-summary-feed` (confirm-to-include)
- Leave / travel / correspondence / PIF suggestion adapters (schema-tolerant)
- Timesheets suggestion **hook** (deferred placeholder until Timesheets ships)
- Submit + declaration; supervisor return/accept; **no self-accept**
- Department + institutional consolidation via link table (**source immutable**)
- Publish versioning; carry-forward with history/stale warning
- Decision → Assignment (idempotent) / optional Risk
- Leave full-week auto-exemption; missing-report dashboard
- Notifications (submit/return); confidentiality on suggestions/exports
- PDF / CSV / Word exports; audit events
- Web shell: `/weekly-summaries*` + API client + permissions
- PHPUnit `WeeklyReportsPhase1Test` (invariants listed in PRD §113 subset)

### Deferred (Phase 2/3)
- AI drafting, advanced calendar suggestions, donor templates
- Cross-department support workflows, advanced decision register
- Trend analytics, archive migration, auto management packs
- Rich native Word (Phase 1 uses HTML `.doc`); Excel is CSV
- Full template admin UI; advanced M&E suggestion rules

### Ready for commit?
**Yes, on `feat/weekly-summaries-phase1`** after local PHPUnit against Postgres (`sadcpfnexus_test`). This environment lacked a running DB/Docker, so tests were authored but not executed green here.

### Next steps
1. Start Postgres/Docker; run `php artisan test --filter=WeeklyReportsPhase1Test`
2. Ship/merge **Timesheets Phase 1** and implement `TimesheetService::weeklySummarySuggestions()`
3. Optional: wire missing-report digest job + supervisor reminder schedule
4. Commit when asked (exclude `.env`, `vendor`, ship-safe)
