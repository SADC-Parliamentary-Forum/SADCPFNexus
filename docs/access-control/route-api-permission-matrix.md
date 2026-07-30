# Access Control — Route / API / Permission Matrix (Phase 1–2)

**Generated:** 2026-07-30  
**Authority:** PRD v1.0 Roles, Permissions and Access-Control Re-engineering  
**Canonical registry:** `api/config/access_control_permissions.php` (+ `docs/access-control/permission-registry.json`)

## Principles

- Deny by default; backend PDP is authoritative (`PolicyDecisionPoint`).
- Parent/child permissions are independent (feature-only nav supported).
- Legacy Spatie keys remain valid via `config('access_control.legacy_aliases')`.

## High-risk enforcement (this ship)

| Surface | Permission(s) | Enforcement |
|---|---|---|
| Leave list | `leave.*` / legacy `leave.view` | Deny-by-default query scope |
| Leave approve | `leave.request.authorise.assigned` (+ legacy `leave.approve`) | PDP + SoD no self-approve |
| PIF update finance fields | — | `403` if `budget_availability_status` / `finance_comments` on general update |
| PIF finance-review | `programme.finance_review.update.assigned` (+ `programme.finance-review`) | Middleware `can:` + PDP |
| Procurement approve | `procurement.request.approve.assigned` (+ `procurement.approve`) | PDP + SoD |
| Procurement evaluations | `procurement.evaluation.*.assigned` | Feature-only API `/procurement/evaluations` |
| Salary advance export | `salary_advance.report.export` | ICT template excludes; PDP denies |
| Admin role assignment | `admin.roles.assign` | SoD blocks self privileged grant |
| Access simulator | `admin.access.simulate` | Preview only — no impersonation |

## Admin / governance APIs

| Method | Path | Permission |
|---|---|---|
| GET | `/api/v1/access/navigation` | Authenticated |
| POST | `/api/v1/access/authorize` | Authenticated |
| POST | `/api/v1/access/requests` | Authenticated |
| GET | `/api/v1/admin/access/registry` | `admin.roles.view` (implicit via catalogue) |
| GET | `/api/v1/admin/access/roles` | `admin.roles.view` |
| POST | `/api/v1/admin/access/roles` | `admin.roles.manage` |
| POST | `/api/v1/admin/access/users/{id}/simulate` | `admin.access.simulate` |
| GET | `/api/v1/admin/access/explore` | `admin.access.explore` |
| GET/POST | `/api/v1/admin/access/reviews` | `admin.access.reviews.manage` |
| GET | `/api/v1/admin/access/governance` | `admin.security.manage` |

## Module coverage in registry

Dashboard/My Work, Leave, Travel, Programme/PIF, M&E, Salary Advance, Procurement, Correspondence, Timesheets, Assignments, Risk, Weekly Summary, Profiles/Signatures, Approvals, Notifications, Documents, Audit Trail, Reports, Admin domains.

Full key list: `docs/access-control/permission-registry.json`.

## Legacy → new mapping

See `api/config/access_control.php` → `legacy_aliases`. Examples:

| Legacy | Canonical (union) |
|---|---|
| `leave.view` | `leave.request.read.self`, `leave.balance.read.self`, `leave.module.view` |
| `leave.approve` | recommend/authorise/reject assigned + direct_reports read |
| `programme.finance-review` | `programme.finance_review.*.assigned` |
| `procurement.view` | `procurement.request.read.created`, `procurement.module.view` |
| `roles.manage` | `admin.roles.*`, simulator, explorer |

During transition, holding either legacy or canonical grants access.
