# SADC PF Nexus — Remaining Work (production readiness)

**Last updated:** 2026-07-25  
**Status:** Slice 1–2 + **M&E Phase 1–2** on `main` (local ahead of remote). Phase 3 AI still deferred.

---

## Done — M&E Phase 1–2 (2026-07-25)

- Design/plan: `docs/superpowers/specs/2026-07-25-mande-results-monitoring-design.md`, `docs/superpowers/plans/2026-07-25-mande-phase1.md`
- Phase 1 API/web: settings, auto-intake, lifecycle, intake/reports/review/strategy/results/settings
- Phase 2 API/web (`61c19ae` / `d24c8ef`): non-PIF reports, follow-up actions, strategic-plan hierarchy UI
- Phase 2 remainder: data-quality scan, donor/project report + CSV export, historical CSV import scaffold
- Slice 2 (`0957aa7`): upload sniffing, MFA setup UX, IDOR evidence pack

**Still later:** deeper data-quality scoring, full donor report builder polish, Excel import, indicator versioning UI, AI (Phase 3), Playwright M&E smoke.

---

## Still open (honest)

### P0 / operator evidence
- [ ] Staging IDOR matrix **sign-off** (pack exists)
- [ ] Real Sentry DSN + SDKs

### P1
- [ ] Broader EN/FR/PT · axe hard-fail · restore drill · store signing
- [ ] M&E Phase 2 remainder: data-quality, donor builder, imports

### P2
- [ ] k6 budgets · blue/green · ClamAV · feature flags · TOTP replay

---

## Reference

- Deploy: `scripts/deploy.sh` · M&E: `/mande`
