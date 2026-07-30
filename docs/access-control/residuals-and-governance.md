# Access Control — Residuals (Phases 7–8) & Governance Pending

## Honest coverage statement

Registry covers modules; **deep PDP / SoD / scope enforcement is prioritised for Leave, PIF finance, Procurement (incl. feature-only committee evaluations), Salary Advance export deny for ICT, and Admin role/permission governance**. This is **not** 100% of every API route.

Verified automated suites (local PHPUnit, RefreshDatabase):

- `tests/Unit/AccessControl` + `tests/Feature/AccessControl` (incl. persona smoke)
- `tests/Feature/Programmes/ProgrammeFinanceReviewTest`

## Out of scope for this ship (documented)

- Full pen-test engagement report
- 100% field-level matrix perfection for every module
- Parliament Connect public portal
- Combining PIF + M&E permission domains

## Phase 7–8 cutover residuals

1. Pilot persona matrix sign-off (Employee, Supervisor, HR, Finance, Programme, M&E, Procurement, SG Office, SG, Internal Auditor, ICT, feature-only committee).
2. Freeze legacy role edits; migrate remaining users onto published `access_role_versions`.
3. Retire obsolete broad permissions after dual-run period; remove compatibility aliases.
4. Force privileged session refresh on role change (partial: cache invalidation shipped; session kill hooks to extend).
5. Wire every remaining module list endpoint through `AccessScopeResolver` (Travel, Correspondence, Risk, etc.).
6. Unify Admin `syncRoles` with People & Authority dual-control `UserRoleAssignment` / `access_role_assignments`.
7. Collapse SAAM `DelegatedAuthority` into PA `IdentityDelegation` with shared expiry hooks.
8. Change `canAccessRoute` unknown-route default from allow → deny after full ROUTE_ACCESS coverage.
9. Platform Audit Trail adapter: prefer new audit events when trail tables merge; currently `AuditLog::record` (dual-write on grant/deny/role assign/simulate).
10. Automated badge/count filtering for hidden records across all dashboards.
11. **RolesAndPermissionsSeeder still `syncPermissions` on legacy role names** (e.g. Internal Auditor, HR Manager) and can overwrite template catalogue merges for those names — merge strategy required before freezing templates.
12. Leave / attachment IDOR returns **403** (not safe 404) via legacy `AuthorizesRequestRecords` / `ensureCanView` — enumeration hardening residual.
13. Tender board keeps `GET /procurement/evaluations`; feature-only committee API is **`/procurement/committee-evaluations`** to avoid route collision.

## Governance checklist (Pending)

Seeded in `access_governance_decisions` (status=`pending`):

- MFA policy for privileged roles
- Privileged access review cadence (quarterly)
- Break-glass emergency access procedure
- Finance/HR/procurement restricted-role review cadence
- Standard role six-month review cadence
- Session revocation on role change
- Pen-test engagement before Phase 8 cutover

Admin UI: `/admin/access/governance`

## Admin surfaces (web)

- Role catalogue: `/admin/access`
- User access profile: `/admin/access` (user drill-down)
- Simulator (no live impersonation): `/admin/access/simulator`
- Permission explorer: `/admin/access/explorer`
- Access requests / reviews / governance: `/admin/access/requests`, `/admin/access/reviews`, `/admin/access/governance`
- Feature-only evaluations: `/my-work/procurement-evaluations`
