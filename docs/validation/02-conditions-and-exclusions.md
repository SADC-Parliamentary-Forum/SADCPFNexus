# Conditions, exclusions, and operator work

Companion to `01-executive-summary.md`. Nothing in this file is a signed approval.

## Operator-owned (cannot be completed in code)

| Item | Where |
|------|--------|
| UAT sign-off (15 roles) | `docs/testing/uat/*.md` |
| Access pilot personas | `docs/access-control/pilot-signoff-pack.md` |
| Role freeze / migrate / retire obsolete perms | `docs/access-control/cutover-checklist.md` |
| Restore drill measured RTO/RPO | `docs/ops/backup-restore.md` + `scripts/ops/restore-drill.sh` |
| Staging IDOR matrix | `docs/ops/staging-idor-matrix.md` |
| MFA / break-glass / pen-test policy | `/admin/access/governance` |
| Live IMAP / AV / FCM | `/admin/settings` + server env |
| SMS / WhatsApp / LLM / SIEM (remaining go-live, not deferred) | `/admin/notifications/governance`, `/admin/audit-trail/governance`, then server env |
| OCR, WORM, payroll, Calendar, Graph, e-sign, Play/ASC | `/admin/settings` + server env |

## Product shipped in this closeout

- `GET /api/v1/procurement/vendors` paginates (`page`, `per_page` capped at 100) and returns Laravel meta + `summary`.
- `PATCH /api/v1/profile/idle-timeout` with allowed values `0,15,30,60,120,480`.
- `EnsureSessionAuthIsValid` revokes idle sessions with `code=session_idle_timeout`.
- Web `IdleTimeoutGuard` + Profile → Security save control.
- Mobile vendor load-more + idle timer + timeout dropdown.

## Out of scope (locked)

FA↔Stock merge · bank GL · auto-award · paid GDS marketplace · all-employee email ingest · invented OT rates · Play/App Store submit without secrets · Parliament Connect public portal.
