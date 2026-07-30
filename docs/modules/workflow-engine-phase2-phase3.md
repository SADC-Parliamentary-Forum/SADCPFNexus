# Workflow Engine — Phase 2 / Phase 3

Implements PRD §122 (Phase 2) and §123 (Phase 3) on the shared ApprovalWorkflow / WorkflowEngine path from Phase 1. Does **not** fork a second engine.

## Phase 2

| Capability | Notes |
|---|---|
| Parallel stages | `completion_rule=all\|any` + independent `workflow_tasks`; SoD via `sod_segregated` / `parallel_role_key` |
| Quorum | `quorum` (N-of-M via `quorum_count`) and `percentage`; votes in `workflow_votes` |
| Governance-body decisions | `workflow_governance_decisions` — Decision authority = body name; recorder ≠ body |
| Advanced SLA | Working calendars, priority variants, pause/resume on hold |
| Simulation | `POST /workflow-engine/definitions/{id}/simulate` — **no production approvals** |
| Visual designer | `/admin/workflows/designer` + draft update + lint before publish |
| Workload routing | `primary\|queue_claim\|workload\|deterministic_fallback` |
| External approvals | Evidence-backed record — not a Nexus click |
| Analytics | Cycle time / bottlenecks / rates — not employee leaderboards |
| Definition linting | Hard failures block publish |
| Secure email-action | Auth required; deep-link to Nexus with version + high-risk MFA note |

## Phase 3 (AI config assist ONLY)

Env-gated stub default. Human confirmation required. AI must **never**:

- publish a workflow
- approve a transaction
- grant authority
- skip a stage
- resolve a segregation conflict
- apply a signature
- accept an exception

Safe apply actions: `attach_draft_note`, `suggest_stage_edit`, `record_search_hint`.

## Key env vars

```
WORKFLOW_ENGINE_AI_PROVIDER=stub
WORKFLOW_ENGINE_AI_ENABLED=true
# WORKFLOW_ENGINE_AI_HTTP_URL=
# WORKFLOW_ENGINE_AI_HTTP_TOKEN=
WORKFLOW_ENGINE_EMAIL_REQUIRE_AUTH=true
WORKFLOW_ENGINE_TIMEZONE=Africa/Windhoek
```

## API (auth)

- `POST /api/v1/workflow-engine/versions/{version}/lint`
- `PUT /api/v1/workflow-engine/versions/{version}/draft`
- `POST /api/v1/workflow-engine/definitions/{workflow}/simulate`
- `GET /api/v1/workflow-engine/analytics`
- `POST /api/v1/workflow-engine/workflows/{id}/governance`
- `POST /api/v1/workflow-engine/workflows/{id}/external-approval`
- `POST /api/v1/workflow-engine/workflows/{id}/sla/pause|resume`
- `POST /api/v1/workflow-engine/ai/suggestions` + `.../apply`
- `GET /api/v1/workflow-engine/ai/guards`

## Tests

`api/tests/Feature/WorkflowEngine/WorkflowEnginePhase2Phase3Test.php` plus Phase 1 / ApprovalFlow / Leave / PIF regression suite.
