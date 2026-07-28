# Weekly Summary Reports Implementation Plan

> **For agentic workers:** Execute task-by-task. Steps use checkbox syntax.

**Goal:** Ship Phase 1 operational Weekly Summary Reports per PRD §118 on `feat/weekly-summaries-phase1`.

**Architecture:** New `weekly_report*` domain separate from email digest; suggestions from Assignments feed + optional adapters; consolidation via link table; DomPDF/CSV exports; Spatie permissions.

**Tech Stack:** Laravel API, Sanctum, DomPDF, Next.js web shell, PHPUnit.

---

### Task 1: Schema + models + permissions
- [x] Migration `2026_07_28_190000_weekly_reports_phase1_foundation.php`
- [x] Eloquent models
- [x] Seed `weekly-reports.*` permissions onto staff/HOD/Director

### Task 2: Core services
- [x] Period ensure/open
- [x] Report create/update/submit/return/accept (SoD)
- [x] Suggestion service (Assignments + leave/travel/correspondence + Timesheets hook)
- [x] Consolidation + publish versioning
- [x] Decision→Assignment, carry-forward, audit, export

### Task 3: HTTP layer
- [x] Controller + routes under `/weekly-summaries`
- [x] PDF blade

### Task 4: Web shell
- [x] API client + sidebar + list/detail pages

### Task 5: Tests
- [x] `WeeklyReportsPhase1Test` covering PRD invariants

### Task 6: Docs delivery
- [x] Gap, design, PRD saved; Timesheets hook documented
