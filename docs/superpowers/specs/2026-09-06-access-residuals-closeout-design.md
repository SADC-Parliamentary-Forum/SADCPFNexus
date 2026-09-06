# Access residuals closeout — design

**Date:** 2026-09-06  
**Branch:** `cursor/access-residuals-closeout-9293`

## Assumptions

- Operator-owned launch rows stay unsigned: UAT scripts, AC-8 persona evidence, restore-drill RTO/RPO, staging IDOR result columns, governance Pending answers, live vendor secrets, Sentry DSN, pen-test engagement.
- Code must not invent secrets or tick those rows Done.
- Admin Web Portal remains the control plane. APIs stay under `/api/v1`. Mutations write `AuditLog`.
- Explicit OOS (full mobile parity, FA↔stock GL merge, auto-award, paid GDS, 135 UX IA collapses) is not in this change.

## Architecture

Backend-owned `AccessScopeResolver::constrainQuery` is the deny-by-default list/badge filter. New module keys reuse the existing elevated permission/role maps. Dual-control and freeze are Admin APIs; clients only render status.

### Architecture Verdict
PASS WITH CONDITIONS — freeze is operator-toggled (default off). Governance/UAT/secrets remain operator-owned.

## Product (this change)

1. **Remaining list scoping** — wire `constrainQuery` for salary advances, assignments, stock requests, document register, meeting decisions, and audit engagements. Catalogue lists (stock items, FA register) stay organisation-visible for holders of the view permission.
2. **Remaining dashboard badges** — scoped counts for salary advances, assignments, timesheets, stock requests; surface correspondence/risk counts already returned by the API.
3. **Unify Admin `syncRoles`** — every Admin role sync (including staff/HOD) creates a pending dual-control request. Seeders and artisan still apply immediately.
4. **Freeze legacy role edits** — tenant setting `access.legacy_role_edits_frozen`. When on, `PATCH /admin/users/{id}/roles` returns 423 and operators must use published `access_role_versions`. PUT `/admin/access/cutover/freeze`.
5. **SAAM collapse command** — `people-authority:collapse-saam-delegations` backfills unmatched SAAM rows via existing `DelegationCollapseService::migrateTenant`. SAAM HTTP API remains a legacy write facade that mirrors into PA.

## STRIDE (summary)

| Threat | Mitigation |
|--------|------------|
| Information disclosure (list/badge leak) | `constrainQuery` deny-by-default; tests assert peer records absent |
| Elevation of privilege (role grant) | Dual-control for all Admin syncRoles; freeze blocks Spatie path |
| Spoofing (self-approve roles) | Approver must differ from requester |
| Tampering (freeze flag) | TenantSetting + audit event `access.legacy_role_edits_freeze` |
| Repudiation | AuditLog on freeze, pending sync, apply |
| Denial of service | Unchanged; counts are scoped aggregates |

## Explicitly not built

- Forging UAT / IDOR staging / restore-drill production evidence.
- Inventing IMAP/AV/FCM/SMS/WhatsApp/LLM/SIEM/Sentry/store secrets.
- Marking Admin governance rows Done.
- Collapsing dual surfaces / 135 UX IA tickets.
- Removing the SAAM HTTP API.
