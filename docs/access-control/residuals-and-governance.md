# Access Control — Residuals (Phases 7–8) & Governance Pending

## Honest coverage statement

Registry covers modules; **deep PDP / SoD / scope enforcement is prioritised for Leave, Travel, PIF finance, Procurement (incl. feature-only committee evaluations), Salary Advance export deny for ICT, and Admin role/permission governance**. This is **not** 100% of every API route.

Verified automated suites (local PHPUnit, RefreshDatabase):

- `tests/Unit/AccessControl` + `tests/Feature/AccessControl` (incl. persona smoke + Travel negative pack)
- `tests/Feature/Programmes/ProgrammeFinanceReviewTest`

## Out of scope for this ship (documented)

- Full pen-test engagement report
- 100% field-level matrix perfection for every module
- Parliament Connect public portal
- Combining PIF + M&E permission domains

## Phase 7–8 cutover residuals

| # | Residual | Status |
|---|---|---|
| 1 | Pilot persona matrix sign-off | **Closed (tooling)** — `AccessControlPersonaSeeder` + `docs/access-control/pilot-signoff-pack.md`; operator evidence still required |
| 2 | Freeze legacy role edits; migrate onto published versions | **Partial** — cutover status API + checklist; migration is operator-driven |
| 3 | Retire obsolete broad permissions after dual-run | **Partial** — dry-run/execute helper for obsolete broad candidates; aliases remain |
| 4 | Force privileged session refresh on role change | **Closed** — `AccessCacheInvalidator` kills Sanctum tokens + `user_sessions` |
| 5 | Wire remaining module list endpoints through `AccessScopeResolver` | **Partial** — Leave + Travel + prior modules; Correspondence/Risk etc. still residual |
| 6 | Unify Admin `syncRoles` with PA dual-control assignments | Open |
| 7 | Collapse SAAM `DelegatedAuthority` into PA `IdentityDelegation` | Open |
| 8 | `canAccessRoute` unknown-route default allow → deny | Open (needs full ROUTE_ACCESS coverage) |
| 9 | Platform Audit Trail adapter preference | Open (dual-write remains) |
| 10 | Automated badge/count filtering for hidden records | Open |
| 11 | Seeder overwrite of template merges | **Closed** — `mergePublishedTemplatePermissions` after legacy sync |
| 12 | Leave / attachment IDOR safe 404 | **Closed** — leave show/attachments + salary-advance show use 404 |
| 13 | Tender board vs committee-evaluations route split | Closed in Phases 1–6 |

## Governance checklist (Pending)

Seeded in `access_governance_decisions` (status=`pending`):

- MFA policy for privileged roles
- Privileged access review cadence (quarterly)
- Break-glass emergency access procedure
- Finance/HR/procurement restricted-role review cadence
- Standard role six-month review cadence
- Session revocation on role change *(code-enforceable session kill shipped; institutional policy still Pending)*
- Pen-test engagement before Phase 8 cutover

Admin UI: `/admin/access/governance`

## Admin surfaces (web)

- Role catalogue: `/admin/access`
- User access profile: `/admin/access` (user drill-down)
- Simulator (no live impersonation): `/admin/access/simulator`
- Permission explorer: `/admin/access/explorer`
- Access requests / reviews / governance: `/admin/access/requests`, `/admin/access/reviews`, `/admin/access/governance`
- Cutover status (API): `GET /api/v1/admin/access/cutover`
- Feature-only evaluations: `/my-work/procurement-evaluations`

## Sign-off pack paths

- `docs/access-control/pilot-signoff-pack.md`
- `docs/access-control/cutover-checklist.md`
- `docs/access-control/role-permission-matrix.md`
- `docs/access-control/route-api-permission-matrix.md`
- `docs/access-control/permission-registry.json`
