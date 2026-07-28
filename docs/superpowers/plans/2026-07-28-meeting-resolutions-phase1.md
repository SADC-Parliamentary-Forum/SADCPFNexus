# Meeting Resolutions Phase 1 — Implementation Plan

**Date:** 2026-07-28  
**Branch:** `feat/meeting-resolutions-phase1`  
**Design:** `docs/superpowers/specs/2026-07-28-meeting-resolutions-design.md`

## Tasks

1. Docs (design + gap + this plan)
2. Migration + `app_user` grants for `meeting_decisions`, `meeting_decision_actions`, `meeting_decision_history`
3. Models + `config/decisions.php`
4. `MeetingDecisionService` (+ dashboard helper)
5. Controller + routes under `/api/v1/decisions`
6. Add `meeting_decision` to Assignment `SOURCE_ALLOW_LIST`; fix minutes `assignActionItem`
7. Permissions in `RolesAndPermissionsSeeder`; notification templates
8. PHPUnit `MeetingResolutionsPhase1Test`
9. Web: `decisionsApi`, pages, Sidebar link
10. Commit → push → FF main → deploy (exclude ship-safe)

## Verify

```bash
cd api && php artisan test --filter=MeetingResolutions
```

## Deferred

- Agenda-item entity, weekly auto-promote UI, legacy GovernanceResolution migration
