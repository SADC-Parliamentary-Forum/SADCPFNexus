# Remaining gaps closeout — design

**Date:** 2026-08-28  
**Branch:** `cursor/implement-remaining-gaps-3ed7`

## Assumptions

- Admin Web Portal remains the control plane. New APIs are versioned under `/api/v1`.
- No secrets, DSNs, Apple team IDs, or Firebase production keys are committed.
- Operator-owned items (UAT signatures, restore-drill RTO/RPO, staging IDOR result columns, live vendor keys) stay operator-owned. Code adds product surfaces and honest status, not forged evidence.
- Silent procurement auto-award, all-employee mailbox ingest, paid GDS checkout, surveillance rankings, invented OT rates, and collapsing 135 UX IA tickets are **not** shipped as originally listed. Safe substitutes are below.
- Full mobile parity is not attempted. Demo screens are wired to live APIs; missing modules get thin API-backed hubs only where cheap.

## Architecture

Backend-owned drivers follow the existing env-gated HTTP pattern (null/stub default; HTTP when URL+token are set). Mutations write `AuditLog`. List endpoints stay tenant-scoped and PDP-gated.

## Product (this change)

1. **WORM** — hash-chained append-only archive (`local` disk or `http` sink). Governance meta reflects driver, never “Operational” without config.
2. **SharePoint/OneDrive** — HTTP Graph-shaped connector; status is `ready` only when URL is set; import never auto-publishes.
3. **HTTP OCR** — posts file bytes to `DOCUMENT_OCR_HTTP_URL`; artisan `documents:process-ocr-jobs` drains `queued` jobs. Null still completes empty.
4. **Play/ASC** — HTTP submit clients + artisan commands; fail closed without env credentials. Status-only UI unchanged for secrets.
5. **Bank/GL posting** — double-entry `gl_journals` / `gl_journal_lines` keyed by `budget_lines.gl_account_code`. Does **not** own bank accounts.
6. **FA↔stock unified register** — GRN handoff type `split` can create linked FA + stock rows; `GET /inventory/unified-register` lists both. Not a merged accounting ledger.
7. **Stock forecast** — exponential smoothing plus optional HTTP ML overlay. Labelled `method`. Never claims true ML without HTTP.
8. **Biometric attendance** — `POST /hr/timesheets/attendance/clock` records in/out after client `local_auth`. Analytics `biometric` is true when events exist. Not device-vendor ingest.
9. **SoD award recommend** — comparison may recommend a quote; a **different** user must call existing award. Never awards from the recommend endpoint.
10. **Newspaper LLM** — HTTP draft into `filled_notice` suggestion; human checklist still required.
11. **GDS HTTP** — fetch + offer-search over env URL. No paid booking/checkout.
12. **Mailbox allowlist** — extra IMAP addresses Admin allowlists. Still suggestions only; never all-employee ingest; never AI auto-submit.
13. **Parliament Connect** — public read-only portal of Admin-published meetings/resolutions/notices.
14. **Salary instalments** — policy `monthly_instalments` (2–24 months). `full_eom` still forces 1 month.
15. **Sentry** — HTTP envelope fallback when DSN is set and SDK is absent. SDK remains optional; DSN env-only.
16. **iOS templates** — example plist / ExportOptions / xcconfig. No real team or Google keys.
17. **Access governance PUT** — System Admin / `admin.security.manage` can set pending/decided/not_applicable + notes. Audit logged.
18. **Privileged `syncRoles`** — System Admin / SG / Finance Director / Finance Controller / HR Manager require pending dual-control request; staff roles still apply immediately.
19. **SAAM store** — always mirrors into PA `IdentityDelegation`.
20. **Audit charter PUT** — persist `charter_configured` / notes; UI stops hardcoding pending when configured.
21. **Anomaly AI** — reuse audit HTTP assist with kind `anomaly_detection`; governance meta reflects provider.
22. **Dashboard badges** — correspondence + risk counts use existing `AccessScopeResolver` constrainQuery.
23. **Mobile demo screens** — load live APIs; biometric screens call `local_auth` then attendance/approval attest.

## Explicitly not built

- Forging UAT / IDOR / restore-drill evidence.
- Inventing IMAP/AV/FCM/SMS/WhatsApp/LLM/SIEM/Sentry/store secrets.
- Paid GDS marketplace checkout.
- All-employee email scraping / AI auto-submit of workflows.
- Silent auto-award of tenders.
- Full mobile parity and 135 UX IA collapses.
