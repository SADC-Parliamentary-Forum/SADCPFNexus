# SADC PF Nexus — Remaining Work (production readiness)

**Last updated:** 2026-07-25  
**Status:** Slice 1–2 + **M&E Phase 1–2 polish A–C** on `main` (deploy pending this stream). Phase 3 AI still deferred.

---

## Done — M&E Phase 1–2 (2026-07-25)

- Design/plan: `docs/superpowers/specs/2026-07-25-mande-results-monitoring-design.md`, `docs/superpowers/plans/2026-07-25-mande-phase1.md`
- Phase 1 API/web: settings, auto-intake, lifecycle, intake/reports/review/strategy/results/settings
- Phase 2 API/web: non-PIF, follow-ups, hierarchy, data-quality, donor, CSV import
- Phase 2 polish: DQ scoring + PM review; donor filters + Excel; indicator versions + calendar
- Slice 2 (`0957aa7`): upload sniffing, MFA setup UX, IDOR evidence pack

**Still later:** Phase 3 AI, Playwright M&E smoke, richer calendar rules.

---

## Still open (honest)

### P0 / operator evidence
- [ ] Staging IDOR matrix **sign-off** (pack exists)
- [ ] Real Sentry DSN + SDKs

### P1
- [ ] Broader EN/FR/PT · axe hard-fail · restore drill · store signing
- [x] M&E Phase 2 remainder / polish A–C (scoring, PM review, donor, Excel, versions, calendar)

### P2
- [ ] k6 budgets · blue/green · ClamAV · feature flags · TOTP replay

---

## Reference

- Deploy: `scripts/deploy.sh` · M&E: `/mande`
