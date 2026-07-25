# M&E Phase 2 Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Phase 2 polish slices A→C (scoring + PM review, donor/Excel, indicator versions + calendar) extending existing MandE.

**Architecture:** Extend `MeDataQualityService`, `MeReviewService`, `MeReportingService`, `MeImportService`, and `/mande/*` pages. Additive migrations only. Commit after each slice; single production deploy at end.

**Tech Stack:** Laravel API, Next.js web, PHPUnit, React Query

**Spec:** `docs/superpowers/specs/2026-07-25-mande-phase2-polish-design.md`

---

### Task 1: Slice A — DQ scoring (TDD)

**Files:**
- Modify: `api/app/Modules/MAndE/Services/MeDataQualityService.php`
- Modify: `web/app/(app)/mande/data-quality/page.tsx`
- Test: `api/tests/Feature/MAndE/MePhase2PolishScoringPmReviewTest.php`

- [ ] Write failing tests for score/grade/breakdown
- [ ] Implement scoring + remediation fields
- [ ] Update data-quality UI + remediation CSV

### Task 2: Slice A — PM review gate (TDD)

**Files:**
- Create migration for programme_review_* columns
- Modify: `MeReviewService`, `MeActivityReport`, routes, controller
- Create: `MeProgrammeReviewController` (or methods on MeReviewController)
- Create: `web/app/(app)/mande/pm-review/page.tsx`
- Test: same feature test file

- [ ] Failing tests: setting ON blocks accept; clear unlocks; SoD; setting OFF unchanged
- [ ] Migration + service + routes + UI + nav
- [ ] Commit Slice A

### Task 3: Slice B — Donor builder + Excel import

- [ ] Enrich donor report API/UI
- [ ] Add Spreadsheet dep or robust xlsx path; extend import
- [ ] Commit Slice B

### Task 4: Slice C — Indicator versions + calendar

- [ ] Versions table + API + indicators UI hook
- [ ] `/mande/calendar` due dates view
- [ ] Commit Slice C; push; deploy once
