# SADC PF Nexus — Remaining Work

**Last updated:** 2026-07-30  
**Baseline tip:** Notifications Phase 1–3 live (`9ec4cbd`) + producer migration residual pack.

---

## Landed (recent)

| Area | Status |
|------|--------|
| Notifications Phase 1–3 | Shipped (`9ec4cbd`) — outbox, push/ack/broadcast, AI assists (guarded) |
| Notification producer migration | Residual pack — Leave/Travel/Procurement/Correspondence/Risk/Audit/People/Budget/Stock/Timesheets/Weekly/Salary Advance via outbox; external emails + tracked mailables; no business-module `Mail::` |

---

## Deferred / OOS

- Full **mobile parity** for many modules
- Prod IMAP password installation (enablement only — document in ops; no secrets in repo)
- FA ↔ Stock merge
- Bank GL ownership / FA accounting GL posting
- Auto-award / invented OT rates / paid GDS marketplace
- All-employee email ingest / AI auto-submit
- Full ML stock forecasting
- Real LLM vendor credentials for weekly/procurement AI (env hooks only; stub default)
- Live SMS/WhatsApp — **Governance Configuration Pending**
- Notifications governance checklist UI (PRD §124 decisions) — do not invent policy answers
- Document Service Phase 1 depth (versioning / hashing / immutable signed binaries) if still thin vs Workflow/People signing

---

## Optional / light follow-ons

- [ ] Wire offline stocktake queue auto-apply UI onto stocktake detail (API already accepts `client_line_key`)
- [ ] BCP/KRI light polish (already implemented; no stub)
- [ ] Cashflow / scenario forecasting UX depth

---

## Reference

- Deploy: `scripts/deploy.sh`
- Health: API `200`, Web `307` (auth redirect)
- Notifications: `/notifications`, `/admin/notifications`
