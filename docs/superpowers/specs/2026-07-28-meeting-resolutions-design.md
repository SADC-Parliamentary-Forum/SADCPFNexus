# Meeting Resolutions / Decision Register — Design (Phase 1)

**Date:** 2026-07-28  
**Branch:** `feat/meeting-resolutions-phase1`  
**Baseline:** `SADCPFNexus/main` @ `0edc760`

## Problem

Meeting Minutes can capture action items and loosely create Assignments, but there is no formal **Decision / Resolution Register** with unique references, adoption authority, status lifecycle, confidentiality, or immutable audit. Legacy `governance_resolutions` is a thin document store and must remain untouched.

## Goals (Phase 1)

1. Register for meeting resolutions and management decisions with unique refs (`DEC/YYYY/#####`)
2. Optional links to meeting minutes and workplan events (agenda proxy)
3. Responsible owner, due date, status lifecycle
4. Idempotent Assignments via `POST /assignments/from-source` (`source_type=meeting_decision`)
5. Optional hooks for Weekly Summary / Risk later (`source_type` / `source_id` on decisions)
6. Confidentiality, immutable history, dashboard summary, register UI, notifications
7. No silent history rewrite — adoption and implementation are audited

## Non-goals (deferred)

- Full agenda-item entity model
- Promoting weekly emerging items → decisions automatically (hook fields only)
- Replacing legacy GovernanceResolution parliamentary docs
- Rich PDF packs / e-signature of resolutions

## Domain model

### `meeting_decisions`

| Field | Notes |
|---|---|
| `reference_number` | Auto `DEC/YYYY/#####`, unique per tenant |
| `decision_type` | `resolution` \| `management_decision` |
| `title`, `body` | Decision text |
| `status` | See lifecycle |
| `owner_id`, `due_date` | Implementation owner |
| `meeting_minutes_id`, `workplan_event_id` | Optional links |
| `is_confidential` | Redact for non-privileged viewers |
| `adopted_by`, `adopted_at`, `adoption_notes` | Authority trail |
| `implemented_at`, `closed_at`, `superseded_by_id` | Closure trail |
| `created_by` | Drafter |
| `source_type`, `source_id`, `source_purpose` | Optional inbound hooks |

### `meeting_decision_actions`

Follow-up actions on a decision (may link to Assignments).  
`priority`: `low|medium|high|critical`. Open **critical** actions can block closure when configured.

### `meeting_decision_history`

Immutable append-only audit (`change_type`, from/to status, old/new values, hash). Updates/deletes throw.

## Status lifecycle

```
draft → adopted → in_progress → implemented → closed
                                              ↘ superseded
```

- Soft-delete drafts only
- Adopted/implemented/closed rows are retained; status changes are history events
- `start-progress` moves adopted → in_progress
- `mark-implemented` moves in_progress → implemented
- `close` requires implemented (or admin with evidence) and no open critical actions when `config('decisions.block_close_with_open_critical_actions')` is true (default **true**)
- `supersede` links to a replacement decision

## Authority / SoD

- **Adopt** requires `decisions.adopt` (or `decisions.admin` / System Admin)
- **No self-bypass:** creator and current owner cannot adopt their own draft unless they hold `decisions.admin` or System Admin / Secretary General
- Governance Officer / SG / Director roles receive adopt rights via seeder

## Assignments integration

```
source_type: meeting_decision
source_id: <decision.id> OR <decision_action.id>
source_purpose: implementation | follow_up
```

Uses `AssignmentService::createFromSource` (idempotent on tenant+type+id+purpose).  
Also fix minutes `assignActionItem` to use `meeting_action_item` + `minute_action` purpose.

## Permissions

`decisions.view|create|adopt|manage|admin|confidential`

## API (prefix `/api/v1/decisions`)

- CRUD register + filters
- `POST {id}/adopt|start-progress|mark-implemented|close|supersede`
- Actions CRUD + `create-assignment`
- `GET dashboard`, `GET {id}/history`
- Confidentiality filtering on list/show

## UI

- `/decisions` register, `/decisions/create`, `/decisions/[id]`, `/decisions/dashboard`
- Sidebar under Governance: Decision Register

## Testing (minimum)

1. Unique refs per tenant
2. Assignment from resolution is idempotent
3. Cannot close with open critical actions when configured
4. Creator/owner cannot self-adopt without admin authority
