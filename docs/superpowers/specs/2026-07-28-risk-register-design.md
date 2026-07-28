# Risk Register Phase 1 — Design

**Date:** 2026-07-28  
**Scope:** Close gaps to PRD §127 / §130 without Phase 2/3 depth.

## Assumptions

1. Parent/user approved full Phase 1 scope; interactive brainstorm approval waived for subagent delivery.
2. `strategic_objectives` is the objective master.
3. Assignments `createFromSource` with `source_type=risk` is live.
4. Residual is always explicit L×I; control effectiveness is advisory only.
5. Existing hardcoded matrix bands remain fallback when no appetite policy is active.

## Data model

### `risks` extensions
- `strategic_objective_id`, `register_scope`, `project_id`
- `cause`, `event_description`, `consequence`
- `control_owner_id`, `is_confidential`
- `materialised_at`, `materialisation_notes`, `linked_incident_id`
- `source_type`, `source_id`, `source_purpose`
- `residual_reassessment_required` (bool)
- `treatment_strategy`
- status gains `proposed`

### `risk_assessments`
Immutable rows: `assessment_type` inherent|residual, L, I, score, level, rationale, assessed_by, assessed_at, `superseded_at`.

### `risk_controls` + `risk_control_risk`
Control register with owner + effectiveness; pivot to risks.

### `risk_appetite_policies`
Versioned JSON thresholds + acceptance_authority; `is_active`.

### `risk_acceptances`
Formal acceptance with expiry, status, residual snapshot, approver.

### `risk_incidents`
Separate entity; optional `risk_id`.

### `risk_actions`
+ `assignment_id`; complete sets parent `residual_reassessment_required=true` without changing residual scores.

## Key service rules

| Rule | Enforcement |
|---|---|
| Objective required | `submit()` / accept-proposal validation |
| One Risk Owner | required `risk_owner_id`; single FK |
| IA cannot own | reject if owner has Internal Auditor role |
| Assessment history | `RiskAssessmentService::record()` supersedes prior current |
| No residual formula | only explicit L/I accepted; reject `control_reduction_pct` |
| Treatment → Assignment | `RiskActionService` → `AssignmentService::createFromSource` |
| Acceptance SoD | high/critical needs Director/SG/Governance Officer ≠ owner |
| Materialise | set timestamp; status stays monitoring/approved/escalated |
| Confidential list | filter unless privileged |
| No hard-delete closed | `forceDelete` blocked; only draft soft-delete |

## API additions

- Assessments, controls, acceptances, incidents, materialise, create-assignment on action
- Appetite policies CRUD (admin)
- Proposals list + accept/reject
- Weekly `create-risk` from `WeeklyReportRisk` → proposal

## UI

- Create form: objective, owner, CEC, scope, confidential
- Detail: assessment history, controls, acceptance, incidents, assignment link
- Sidebar stubs for KRI / Control Testing / BCP (Phase 2/3)
