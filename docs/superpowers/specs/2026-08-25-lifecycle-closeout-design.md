# Lifecycle closeout + unused audit/handover wiring — design

**Date:** 2026-08-25  
**Branch:** `cursor/lifecycle-closeout-248a`  
**Baseline:** `SADCPFNexus/main` @ `6b09e6af`

## What this ships

Code that does not require operator signatures, live vendor secrets, or IA owner decisions:

1. **Lifecycle case closeout** — clearance, exception request/approve, reopen, terminal-payment assert/approve, and finalise on `/lifecycle/cases/[id]`. Exceptions appear on the case payload.
2. **My-tasks actions** — complete and clearance from `/lifecycle/my-tasks` without hunting the case.
3. **Template admin** — list includes `draft_version`; HR can clone a draft from the published definition and publish it. `createDraft` accepts internal journey types.
4. **Audit findings / corrective actions** — labelled ModulePageHeader surfaces for create/issue/respond/complete/verify. Never auto-closes findings.
5. **Handover pack** — labelled from/to staff pickers (`tenantUsersApi`) instead of hardcoding the current user.

## Explicitly not in this change

- Forging UAT / IDOR / restore-drill / AC-8–10 evidence.
- Inventing IMAP/AV/FCM/SMS/WhatsApp/LLM/SIEM/Sentry/store secrets.
- Marking Admin governance rows Done.
- Full mobile parity, FA↔Stock merge, auto-award, invented OT rates.

## Case payload

`GET /lifecycle/cases/{id}` adds `exceptions[]` with `id`, `task_instance_id`, `exception_type`, `reason`, `status`, `resolution_notes`. Tenant-scoped. Existing RBAC unchanged.

## Templates

`GET /lifecycle/templates` each row includes `published_version` and `draft_version` (latest draft, or null).  
`POST /lifecycle/templates` `lifecycle_type` is `onboarding|separation|transfer|promotion|probation`. Publishing a draft archives the previous published version (existing service).
