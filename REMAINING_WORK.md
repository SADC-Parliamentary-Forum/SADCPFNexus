# SADC PF Nexus — Remaining Work

**Last updated:** 2026-07-30  
**Baseline tip:** Document Service PRD Phase 1–3 pack (`feat/next-continuation-pack`).

---

## Landed (recent)

| Area | Status |
|------|--------|
| Document Service Phase 1 | Shipped earlier (`abe49e3`) — versioning, hashing, tokens, Null AV |
| Document Repository PRD Phase 1–3 | This pack — file objects, links, holds, quarantine semantics, module wiring, Phase 2 slices, Phase 3 AI stubs, §125 governance UI |
| Notifications Phase 1–3 + producer migration | Shipped — outbox path; no business-module `Mail::` |

---

## Ops-only / Governance Pending (not inventable in code)

- Prod IMAP password installation
- Live SMS/WhatsApp — **Governance Configuration Pending** (Null stubs remain)
- Approved AV product credentials (`DOCUMENT_AV_DRIVER` + ClamAV/HTTP env)
- OCR vendor credentials (`DOCUMENT_OCR_DRIVER`)
- SharePoint/OneDrive migration credentials
- Real LLM vendor credentials (weekly/procurement AI — stub default)
- Document §125 / Notifications §124 checklist answers — record in admin UIs only

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

## Optional light follow-ons

- [ ] Wire offline stocktake queue auto-apply UI onto stocktake detail
- [ ] Cashflow / scenario forecasting UX depth
- [ ] Watermarked download binary transform (filename marker shipped; visual watermark optional)

---

## Reference

- Deploy: `scripts/deploy.sh`
- Health: API `200`, Web `307` (auth redirect)
- Documents: `/admin/documents`, `/admin/documents/governance`, `/admin/documents/retention`
- Notifications: `/notifications`, `/admin/notifications`, `/admin/notifications/governance`
