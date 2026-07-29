# SADC PF Nexus — Remaining Work

**Last updated:** 2026-07-29  
**Baseline tip:** `9be4ef4` (fleet vendor telematics live) + Gap Pack 1 follow-ons on `feat/gap-pack-1`.

---

## Landed (Gap Pack 1)

| Area | Status |
|------|--------|
| Live fleet vendor telematics | Shipped (`9be4ef4`) — pluggable `null\|generic_http`, webhook, `fleet:sync-telematics`, UI status |
| FA disposal UX | Create / detail / complete polish on `/assets/disposal` |
| FA revaluation | Request → approve → book value update (`/assets/revaluation`, no GL posting) |
| Timesheet payroll operator UX | `/hr/timesheets/payroll` — period select → stage batch → export history (no paste IDs) |
| Leave stage-holder mapping | `current_holder_user_id` from dept supervisor / HR / SG fallbacks |
| Leave certify + TOIL nav | `/leave/queues/certify`, `/leave/toil`, richer Leave sidebar |
| Correspondence retention / legal holds | Retention fields, hold/release/purge-block, `/correspondence/retention` |
| Stock barcode + offline stocktake foundation | `barcode` on items, `GET …/by-barcode/{code}`, `client_line_key`, `/stock/scan` local queue |
| Weekly compliance digests | `weekly-reports:send-compliance-digest` (Mon 08:40), richer compliance page, `WEEKLY_AI_PROVIDER` stub/LLM hook (human confirm only) |
| RiskPhaseStub | Removed (orphan) |
| Procurement AI compare | Already gated stub on tender detail + settings — human confirm, never auto-award |

---

## Deferred to Pack 2 / later

- Full **mobile parity** for many modules
- Prod IMAP password installation (enablement only — document in ops; no secrets in repo)
- FA ↔ Stock merge
- Bank GL ownership / FA accounting GL posting
- Auto-award / invented OT rates / paid GDS marketplace
- All-employee email ingest / AI auto-submit
- Full ML stock forecasting
- Real LLM vendor credentials for weekly/procurement AI (env hooks only; stub default)

---

## Optional / light follow-ons

- [ ] Wire offline stocktake queue auto-apply UI onto stocktake detail (API already accepts `client_line_key`)
- [ ] BCP/KRI light polish (already implemented; no stub)
- [ ] Cashflow / scenario forecasting UX depth

---

## Reference

- Deploy: `scripts/deploy.sh`
- Health: API `200`, Web `307` (auth redirect)
- Assets: `/assets`, disposals `/assets/disposal`, revaluations `/assets/revaluation`
- Stock: `/stock`, barcode `/stock/scan`
- Leave: `/leave`, certify `/leave/queues/certify`, TOIL `/leave/toil`
- Correspondence retention: `/correspondence/retention`
- Weekly compliance: `/weekly-summaries/compliance`
- Payroll export: `/hr/timesheets/payroll`
