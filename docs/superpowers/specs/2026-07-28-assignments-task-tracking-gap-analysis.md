# Assignments / Task Tracking — Gap Analysis

**Date:** 2026-07-28  
**Baseline:** `SADCPFNexus/main` @ `312ff62`  
**PRD:** `docs/superpowers/specs/2026-07-28-assignments-task-tracking-prd.md`  
**Scope:** Phase 1 (§113)

---

## Existing assets (keep / extend)

| Area | Location | Status vs PRD |
|------|----------|---------------|
| Assignment register CRUD | `assignments` table, `Assignment` model | Partial — single assignee, no participants, no polymorphic source |
| Workflow | draft → issue → accept → start → updates → complete → close/return/cancel | Strong base; missing separate **review/verification** vs completion |
| Updates / blockers | `assignment_updates` + `blocker_type` / `blocker_details` | Partial — no **blocker owner**; overdue conflated with status (`delayed`) |
| Stats / list filters | `AssignmentService::list/stats` | Partial — no my/team/review queues, source filters |
| Notifications | `NotificationService` on issue/accept/complete/return | Reuse; extend for reassignment, verify, escalate, reminders |
| Attachments | morph `Attachment` | Reuse for evidence |
| Meeting action → Assignment | `MeetingMinutesController::assignActionItem` | Keep; route through `createFromSource` for idempotency |
| Weekly Summary | `WeeklySummaryDataService::getAssignmentSummary` | Exists (counts only); extend contract for richer read API |
| Permissions | `assignments.view/create/issue/admin` | Extend with review/team/report |
| Web UI | `/assignments` overview, create, all, pending, overdue, blocked, detail | Expand nav to §5; add my/team/register/review/reports/recurring |
| HR Work Assignments | separate `work_assignments` module | **Leave alone** — different HR construct; do not merge |

---

## Critical gaps (Phase 1)

1. **Primary assignee required** — create allows null `assigned_to`; department-only can linger forever.
2. **Contributors / reviewer / watchers** — not modelled (JSON-free relational tables needed).
3. **Polymorphic source allow-list** — only `meeting_minutes_id` / programme / event IDs; no Correspondence/PIF/M&E.
4. **Completion ≠ verification** — `complete` → `close` exists but self-close allowed; no `review_required` / no-self-verify.
5. **Blocker owner** — missing `blocker_owner_id`.
6. **Overdue as deadline state** — computed overdue OK in UI, but status set to `delayed` mixes concerns; add derived `deadline_state`.
7. **Reassignment / due-date history** — silent updates on draft only; no audited reassignment trail.
8. **Recurring** — none; need template + instance generation.
9. **Subtasks / checklists / evidence flags** — none.
10. **Confidentiality inheritance** from source — `is_confidential` manual only.
11. **Escalation / reminders** — none (scheduled hooks).
12. **Performance scores / leaderboards** — `completion_rating` / `has_performance_note` exist; Phase 1 must **not** expose leaderboards; keep optional supervisor note only, no automated scores.
13. **Verified lock** — closed records editable only as draft today; need explicit verified immutability.
14. **Delegation** — SAAM `DelegatedAuthority` exists; Assignments must hook (act-as) not invent parallel engine.
15. **Idempotent from-source create** — Meeting creates blindly; need unique source+purpose key.

---

## Correspondence note

Correspondence Register Phase 1 (sibling worktree) introduces `correspondence_assignment_links`. On this branch we expose `createFromSource` with allow-listed morph types including `correspondence` so Correspondence can link without duplicating assignment engines. Do not regress Correspondence routes/models when merging.

---

## Defer (Phase 2/3)

Workload forecasting, AI suggestions, calendar sync, advanced dependency graphs, handover packs, deep timesheet coupling, natural-language search — stub nav only where helpful.
