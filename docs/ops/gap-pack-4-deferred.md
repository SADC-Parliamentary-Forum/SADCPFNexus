# Gap Pack 4 — deferred / landed

Base tip: `55372e4` (`SADCPFNexus/main`).

## Landed in this pack
- Leave Finance-first / Director-principal configurable modes (`leave_policy_versions.workflow_mode`) + `/leave/settings` UI + tests
- Google Calendar two-way sync service, `assignments:sync-google-calendar`, webhook endpoint, encrypted connection tokens, Http::fake tests
- Mobile store submission jobs gated on secrets/vars (`submit-play`, `submit-appstore`) — artifacts-only by default
- Operator credential status API + Admin Settings panel + enablement checklist + `.env.example` refresh

## Still out of scope (by design)
- FA/Stock merge · bank GL · auto-award · all-employee email · AI auto-submit · invented OT rates · paid GDS marketplace · fabricating API keys/passwords/store signing secrets
