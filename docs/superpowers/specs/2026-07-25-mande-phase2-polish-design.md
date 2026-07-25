# M&E Phase 2 Polish — Design

**Date:** 2026-07-25  
**Status:** Approved (Approach 1 extend-existing; delivery: commit per slice, one deploy at end; mixed depth)

## Scope

| Slice | Depth | Deliverables |
|-------|-------|----------------|
| A | Rich | Weighted data-quality score + remediation export; PM review gate + `/mande/pm-review` |
| B | Rich donor / MVP Excel | Donor builder filters + matrix polish; `.xlsx` import beside CSV |
| C | MVP | Indicator version list/create; simple reporting due calendar |

## Slice A (approved)

### Scoring
- Extend `MeDataQualityService::scan` with `score` (0–100), `grade`, `score_breakdown`
- Weights by code/severity; remediation tips on each issue; CSV export in UI

### PM review
- Columns: `programme_review_status` (`pending`/`cleared`/`returned`/null), `programme_reviewed_by/at`, `programme_review_notes`
- Setting ON → submit sets `pending`; accept blocked until `cleared`
- Setting OFF → unchanged
- SoD: submitter/responsible cannot clear own report
- Routes: list pending + clear/return; page `/mande/pm-review`

## Slice B / C (locked intent)

- Donor: framework + date filters, indicator matrix, CSV; richer than scaffold
- Import: parse xlsx via `phpoffice/phpspreadsheet` (add dep) or CSV fallback
- Indicators: `me_indicator_versions` or version rows linked to indicator; list + create snapshot
- Calendar: page listing reports by `report_due_at` month + overdue highlight

## Non-goals
- Phase 3 AI; inventing PIF columns; auto-mutating reports from DQ scan
