# Assignments / Task Tracking Phase 1 — Design

**System:** SADC PF Nexus  
**Module:** Assignments / Task Tracking  
**Slice:** Phase 1 (PRD §113)  
**Date:** 2026-07-28  
**Status:** Approved for implementation (parent task mandate)  
**PRD:** `docs/superpowers/specs/2026-07-28-assignments-task-tracking-prd.md`  
**Gap analysis:** `docs/superpowers/specs/2026-07-28-assignments-task-tracking-gap-analysis.md`

---

## Assumptions

1. Extend existing `assignments` / `AssignmentService` / web `/assignments` — do not create a parallel task engine.
2. `assigned_to` remains the **Primary Assignee** column (rename in API docs only; DB column kept for BC with Weekly Summary, Meeting Minutes, seeders).
3. PostgreSQL enum alterations for status/blocker are avoided where risky; new blocker categories and review statuses use string columns / expanded CHECK via new columns.
4. Source morph allow-list Phase 1: `manual`, `correspondence`, `pif`, `meeting_minutes`, `meeting_action_item`, `programme`, `me_recommendation`, `procurement`, `travel`, `risk`, `audit_finding`, `weekly_summary`, `management_instruction`.
5. Recurring: template rows (`is_template=true`) generate concrete instances; instances link `template_id`.
6. No automated performance scores or leaderboards; existing `completion_rating` remains optional supervisor-only on close, never aggregated into rankings.
7. Delegation: respect existing SAAM `DelegatedAuthority` when acting; Assignments records `acted_via_delegation_id` on mutations where provided — no password sharing.
8. Department queue: if `assigned_to` null and `department_id` set, `department_claim_due_at` required; escalation marks `needs_claim_escalation` after due — cannot close as ownerless.

---

## Recommended approach

**Extend monolith Assignment module** (vs spinning a new Tasks bounded context, vs merging HR Work Assignments).

| Approach | Pros | Cons |
|----------|------|------|
| A. Extend existing Assignments (chosen) | Reuses workflow/notifications/UI; Weekly Summary already queries `assignments` | Larger service class; careful BC |
| B. New Tasks module + sync | Clean PRD model | Dual registers; breaks Meeting/Weekly Summary |
| C. Merge HR work_assignments | One nav label | Different HR semantics; high regression |

---

## Data model (Phase 1)

### `assignments` columns added

- Source: `source_type`, `source_id`, `source_reference`, `source_title`, `source_purpose` (idempotency key with source)
- Review: `review_required`, `reviewer_id`, `review_status` (`none|pending|accepted|returned|accepted_with_follow_up`), `verified_at`, `verified_by`, `verification_notes`
- Deliverable: `acceptance_criteria`, `evidence_required`, `completion_instructions`
- Blocker owner: `blocker_owner_id`, `blocker_expected_resolution_at`
- Department claim: `department_claim_due_at`, `claimed_at`
- Recurring: `is_template`, `template_id`, `recurrence_rule` (json), `recurrence_next_run_at`
- Parent: `parent_id` (subtasks)
- Escalation: `escalation_level`, `last_reminded_at`, `last_escalated_at`
- Delegation audit: `acted_via_delegation_id` (nullable, last mutation hint)
- Priority add `urgent` via string migration if enum allows; else map urgent→high in API with `priority_label`

### New tables

- `assignment_participants` — `assignment_id`, `user_id`, `role` (`contributor|watcher|reviewer`), unique(assignment,user,role)
- `assignment_events` — immutable history (reassign, due_date_change, escalate, verify, claim, …)
- `assignment_checklist_items` — per §91
- `assignment_reviews` — append-only review decisions per §92
- `assignment_reminders` — scheduled reminder rows (processed by command)

Subtasks = child `assignments` with `parent_id` (same table) to keep one register.

---

## Status vs deadline vs review

| Axis | Values |
|------|--------|
| Work status | existing draft…cancelled (keep `delayed` as legacy; stop auto-writing it from progress; prefer `at_risk`/`blocked`/`active`) |
| Deadline state | derived: `none|future|due_soon|due_today|overdue|completed_on_time|completed_late|cancelled_before_due` |
| Review status | `none|pending|accepted|returned|accepted_with_follow_up` |

Completion sets status=`completed` and if `review_required` → `review_status=pending`. Verification (reviewer ≠ primary assignee) sets verified + status=`closed`. Without review, creator/supervisor close remains allowed.

---

## API additions (under `/api/v1/assignments`)

- `GET /mine`, `/team`, `/register`, `/review-queue`, `/reports/summary`
- `POST /from-source` (idempotent)
- `POST /{id}/reassign`, `/{id}/change-due-date`, `/{id}/block`, `/{id}/unblock`
- `POST /{id}/verify`, `/{id}/claim` (department queue)
- `POST /{id}/participants`, `DELETE /{id}/participants/{user}`
- `POST /{id}/checklist`, checklist toggle
- `POST /{id}/subtasks`
- `POST /templates`, `POST /templates/{id}/generate`
- `GET /weekly-summary-feed` — contract for Weekly Summary consumer
- Reminders/escalation: artisan `assignments:process-reminders`

Existing issue/accept/start/updates/complete/close/return/cancel retained.

---

## Confidentiality

On `createFromSource`, set `is_confidential` from source when source exposes confidentiality (Correspondence) or caller flag. List/show redact title/description for users lacking `assignments.confidential.view` **and** not participant/assignee/creator.

---

## Frontend nav (§5)

Expand Assignments children: My Dashboard, My Assignments, Assigned by Me, Awaiting My Review, Team, Register, Unassigned Queue, Overdue, Blocked, Escalations, Recurring, Reports, Completed; stub Calendar / Templates / Settings (Phase 2).

---

## Testing (PHPUnit)

1. Primary assignee required (or department + claim due)
2. Completion ≠ verify when review required
3. Blocker requires owner
4. Confidentiality inherits from source
5. Source allow-list rejection
6. Idempotent from-source create
7. No self-verify when review required
8. Recurring instance generation basics
