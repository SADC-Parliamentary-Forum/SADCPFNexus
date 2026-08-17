# SADC PF Nexus — Remaining Work

**Last updated:** 2026-08-17  
**Baseline tip:** `feat/remaining-work-closeout` (from `437aaa7`).

---

## Landed in this closeout

| Area | Status |
|------|--------|
| Vendor directory server pagination | Shipped — `page` / `per_page` (max 100) + `summary` |
| Per-user idle timeout | Shipped — API, web guard, mobile timer |
| Honest WORM / support-health copy | Shipped — no fake “WORM Operational” |
| Validation pack (conditional) | `docs/validation/01-executive-summary.md` |
| Restore drill script | `scripts/ops/restore-drill.sh` (not executed here) |

---

## Ops-only / Governance Pending (not inventable in code)

- UAT sign-off for 15 role scripts
- Access-control pilot + cutover (AC-8/9/10)
- Restore drill measured RTO/RPO
- Staging IDOR matrix human results
- Prod IMAP / SMS / WhatsApp / AV / OCR / SharePoint / LLM / SIEM / WORM / FCM / payroll / Calendar / Graph / e-sign / Play / ASC credentials
- Document §125 / Notifications §124 / Access MFA-policy checklist answers
- Pen-test engagement or documented residual-risk acceptance

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

- Live LLM / newspaper notices / cashflow charts beyond the 3-card summary
- Stock forecasting, courier APIs, automated KRIs, biometric attendance
- 186 deferred UX IA tickets (dual surfaces, calendars, settings IA)

---

## Reference

- Deploy: `scripts/deploy.sh`
- Restore drill: `scripts/ops/restore-drill.sh`
- Validation: `docs/validation/01-executive-summary.md`
