# SADC PF Nexus — Remaining Work

**Last updated:** 2026-08-24  
**Baseline tip:** `feat/remaining-module-depth` (from `df32c9d` on `main`).

---

## Landed in this closeout

| Area | Status |
|------|--------|
| Vendor directory server pagination | Shipped — `page` / `per_page` (max 100) + `summary` |
| Per-user idle timeout | Shipped — API, web guard, mobile timer |
| Honest WORM / support-health copy | Shipped — no fake “WORM Operational” |
| Validation pack (conditional) | `docs/validation/01-executive-summary.md` |
| Restore drill script | `scripts/ops/restore-drill.sh` (not executed here) |
| Secret-free module depth (MD-1/5/6/8/9/10/11/13/14) | Deeper on `feat/remaining-module-depth` — templates/copy, multi-line event packs, registry pack, capacity week/CSV, management pack feed, handover Word/NL hrefs, investigation pack, minutes promote, M&E filter apply |

---

## Ops-only / Governance Pending (complete remaining — not Done)

These rows are **complete as remaining work**: surfaces exist, evidence packs exist, result/sign-off columns stay blank until a human operator fills them. Do not tick them Done in code.

| Item | Where to complete | Status |
|------|-------------------|--------|
| UAT sign-off (15 role scripts) | `docs/testing/uat/*.md` | Pending operator signatures |
| Access-control pilot (AC-8) | `docs/access-control/pilot-signoff-pack.md` | Pending operator evidence |
| Role freeze / cutover (AC-9/10) | `docs/access-control/cutover-checklist.md` | Pending operator execution |
| Restore drill measured RTO/RPO | `docs/ops/backup-restore.md` + `scripts/ops/restore-drill.sh` | Script shipped; RTO/RPO unmeasured |
| Staging IDOR matrix | `docs/ops/staging-idor-matrix.md` | Result columns blank until a human run |
| Prod IMAP / AV / FCM | Server env + `/admin/settings` | Pending live credentials |
| Prod SMS / WhatsApp | `/admin/notifications/governance` then env `NOTIFICATIONS_SMS_*` / `NOTIFICATIONS_WHATSAPP_*` | HTTP drivers shipped — Pending live URL/token |
| Prod LLM assists | `/admin/notifications/governance` then env `NOTIFICATIONS_AI_*` | HTTP summariser shipped — Pending live URL/token; human confirm only |
| Prod SIEM | `/admin/audit-trail/governance` then env `AUDIT_SIEM_*` | HTTP webhook shipped — Pending live URL/token |
| Prod OCR / SharePoint / WORM / payroll / Calendar / Graph / e-sign / Play / ASC | Server env | Pending live credentials |
| Document §125 / Notifications §124 / Access MFA-policy | `/admin/documents/governance`, `/admin/notifications/governance`, `/admin/access/governance` | Pending institutional answers |
| Pen-test or residual-risk acceptance | `/admin/access/governance` | Pending |
| Sentry DSN | Env only — never commit | Hooks exist; no DSN in repo |

Launch remaining (not deferred): enable **SMS**, **WhatsApp**, **LLM assists**, and **SIEM** with real operator vendors/keys on the server (`NOTIFICATIONS_*_HTTP_*`, `AUDIT_SIEM_*`). Approve `/admin/notifications/governance` SMS/WhatsApp and `/admin/audit-trail/governance` SIEM first. HTTP drivers are in code; default remains Null — do not invent secrets.

Privileged MFA product gate: **on by default when `APP_ENV=production`** (`config/auth.php` `require_privileged_mfa`). Institutional policy at `/admin/access/governance` remains operator-owned.

Vendor list/show: Procurement Officer (canonical `procurement.supplier.read`) and System Admin. General Employee / `staff` does not get the vendor register unless granted `procurement.view` or equivalent. `CanonicalRoleManager` now creates missing catalogue permission rows so role sync does not wipe grants to an empty set.


Sentry: env-gated hooks exist (`App\Support\Observability`, `web/lib/observability.ts`). Install `sentry/sentry-laravel` / `@sentry/nextjs` only when a DSN is issued. Never commit a DSN.

---

## Explicit OOS

- Full **mobile parity** for many modules
- FA ↔ Stock merge
- Bank GL ownership / FA accounting GL posting
- Auto-award / invented OT rates / paid GDS marketplace
- All-employee email ingest / AI auto-submit
- Full ML stock forecasting
- Fabricating hours / surveillance rankings

---

## Optional later-phase depth (not launch blockers)

Shipped in `feat/remaining-product-depth` (over existing APIs):

- Cashflow period closing-balance chart
- Stocktake **Apply browser queue** from scan localStorage
- Recurring assignment template create form
- Assignment dependency graph on detail
- Governance meeting pack tables (not raw JSON)
- Correspondence mail-merge labelled fields
- People & Authority mutate UI (skills, succession, delegations, acting, onboarding/offboarding, access reviews, recertification, privilege-alert detect/ack)

Still later-phase (secrets / vendor / OOS):

- Newspaper notices live LLM (CR-8) and auto-award remain out of this pack
- Stock ML forecasting, live courier HTTP, biometric attendance
- Salary-advance instalments remain v1-locked to `full_eom`
- 135 deferred UX IA tickets (dual surfaces, calendars, settings IA)

Shipped this continuation (module depth over existing APIs):

- Decisions dashboard **Promote weekly assignments** (`promoteWeeklyAssignments`; never auto-completes)
- Audit donor templates apply via labelled engagement/template selects (MD-16)
- Cashflow **Generate optimistic / pessimistic** overlays from a selected scenario (scale opening + adjustments ±20%; not live FX)
- Weekly summary **assignment feed** (`weeklySummaryFeed`) plus Word export on the current-period page
- Notifications inbox **NL search** suggests filters only; it does not send messages
- Correspondence detail **courier tracking refresh** (stub when no courier URL is configured — not live carrier proof)
- Assignment calendar **ICS subscribe / sync** panel (`calendarFeed`; honest when Google credentials are absent)
- Assignment calendar **ICS import** creates drafts only (`importIcs`; does not issue or complete work)
- Profile settings **server inbox delivery** plus optional digest suggestion (mandatory workflow/security/compliance stay on)
- People org search object cells use `LabelledRecord` instead of JSON dumps
- HR settings audit log uses labelled old/new change rows
- Assignment detail **claim** (department-queue only) and **change due date** (date + reason)
- Notifications inbox **archive** and **acknowledge**
- Admin notifications **draft broadcasts** (create ≠ submit ≠ approve; high-impact SoD) plus **maintenance windows**
- Admin notifications **draft acknowledgement campaigns** (create ≠ activate; activate notifies the listed audience)
- Correspondence detail **internal notes** and **routing acknowledgement**
- Notifications inbox **mark unread**
- Admin document register **set retention** plus **backup status** (not a completed restore drill)
- People register object cells use `labelledObjectCell` instead of JSON dumps
- Admin operations object cells use `LabelledRecord` instead of JSON dumps
- Weekly summaries **review / department / institutional / compliance** queues: labelled chrome, no raw ID boxes, report rows open detail
- Weekly summary **detail**: labelled return reason, items table, exports
- Weekly summaries **trends**: `weeklyReportsApi.trends`, labelled snapshot, hub breadcrumb

Shipped on this branch (People labelled forms + watermark + remaining inventable product):

- Units / positions / job descriptions create forms
- Position assign (was miswired to listPositions)
- Authority create + assign
- Reporting line create
- E-sign create + submit
- Org scenario create, SoD analyse, M365 run sync
- Signature enrol/activate (staff specimen remains `/saam`)
- Skills assign to person
- Directory create/update person (PR-13)
- PDF/image visual watermark via `DocumentWatermarkPainter` (uncompressed PDF text operator + GD raster; compressed PDFs may still need FPDI later)
- Mobile weekly-summary donor/template fields (PR-15)
- Mobile cashflow period chart (PR-16)
- Mobile assignment dependencies + recurring templates (PR-17)
- Audit / People AI nested values as labelled fields (PR-18/19)
- Travel amendment proposed_changes labelled diff (PR-20)
- Risk audit-trail old/new labelled change rows (PR-21)
- HR settings dead “Coming Soon” branch removed (PR-22)

Shipped in `feat/remaining-module-depth` (secret-free module depth over existing APIs):

- MD-1 Procurement newspaper-notice **templates and human checklists** (never auto-award; live LLM remains CR-8). Filled notice copy/print + template picker.
- MD-5 Stock **event packs** (instantiate drafts a stock request only) plus **bulk barcode lookup**, **multi-line editor**, **barcode-add**, and **duplicate** (still never issues).
- MD-6 Correspondence **registry/filing pack** (labelled checklist + subject files; courier URL stays stub — not live carrier proof)
- MD-8 Timesheet **capacity analytics** from recorded vs expected hours with week picker and CSV (no invented OT rates, no biometric)
- MD-9 Weekly summary **management-pack** Word export with assignment feed + emerging-risk counts (not auto-sent)
- MD-10 Assignment **handover pack** (Word download, logged hours, NL apply-hrefs), **workload forecast** weeks selector, **NL filter suggest**, and **timesheet hour coupling** (no surveillance rankings)
- MD-11 Internal Audit **investigation pack** suggestion kind with engagement id / next questions (never auto-closes)
- MD-13 Meetings **promote risk drafts**, **promote meeting pack**, and **promote from minutes** (assignments + risks; decisions stay open)
- MD-14 M&E **narrative / NL assist** with human confirm and query-string filter apply (stub provider; no auto-mutate)

Not done in code (operator-owned, and not marked Done): UAT signatures, AC-8/9/10 execution, restore-drill RTO/RPO, staging IDOR result columns, Admin governance Pending rows, and live IMAP/AV/FCM/SMS/WhatsApp/LLM/SIEM credentials. The table above is the complete remaining list. Do not invent secrets or tick those rows.

---

## Reference

- Deploy: `scripts/deploy.sh`
- Restore drill: `scripts/ops/restore-drill.sh`
- Validation: `docs/validation/01-executive-summary.md`
