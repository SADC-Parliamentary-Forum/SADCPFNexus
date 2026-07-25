# SADC PF Nexus — Remaining Work (production readiness)

**Last updated:** 2026-07-25  
**Status:** Production **Ops/docs/CI Slice 1** complete on `main`. Core paperless workflows are strong; unfinished product modules stay **hidden**, not invented.

---

## Done — Ops / docs / CI Slice 1

- **Runbooks:** [docs/ops/](docs/ops/README.md) — backup/RTO/RPO, incident response, [deploy/rollback](docs/ops/deploy-rollback.md) (`scripts/deploy.sh`), observability.
- **Prod bootstrap docs:** [DOCKER.md](DOCKER.md) + local [LOGIN_CREDENTIALS.md](LOGIN_CREDENTIALS.md) (gitignored) — never `DemoDataSeeder` / `migrate:fresh` on prod; use `ProductionSeeder` + `app:create-admin`.
- **CI:** [`.github/workflows/gitleaks.yml`](.github/workflows/gitleaks.yml) secret scan on `main` PRs/pushes.
- **Perf scaffold:** [perf/k6/smoke-login-list.js](perf/k6/smoke-login-list.js) (script only — not a CI gate).
- **Secrets hygiene:** Firebase Admin SDK JSON (`*-firebase-adminsdk-*.json`) is gitignored and **not tracked** (`git check-ignore` / `git ls-files`). Client `google-services.json` / `firebase.json` remain intentional mobile client configs.
- **PIF UX overhaul** plan (`docs/superpowers/plans/2026-07-23-pif-ux-overhaul.md`, ~190 steps): **deferred / scope-cut** — not implemented in this release stream.

---

## Done earlier (security on `main`)

- **F1–F3 High:** privilege escalation on admin self-update; certificate IDOR; salary-advance workflow + finance-gated legacy approve ([docs/security-patches-f1-f2-f3.md](docs/security-patches-f1-f2-f3.md)).

---

## Production bootstrap (do not demo-seed)

```bash
php artisan migrate --force
php artisan db:seed --class=ProductionSeeder --force
php artisan app:create-admin
php artisan db:seed --class=WorkflowSeeder --force
```

Set `REQUIRE_PRIVILEGED_MFA=true` and `EXTERNAL_WORKPLAN_TOKEN` in production `.env`.

---

## Deferred / out of Slice 1 (do not invent)

| Item | Status |
|------|--------|
| **PIF UX overhaul** (~190-step plan) | **Deferred / scope-cut** |
| Full Sentry accounts + alert rules | Deferred until a real DSN exists (env hooks only) |
| UAT execution / claiming checklist boxes done | Deferred — operator/human evidence |
| Blue/green web deploy | Deferred (P2 infra) |
| Postgres/MinIO restore drill with measured RTO/RPO | Documented; drill not yet executed |
| Full M&E page suite / plenary voting / speaker queue | Out of scope |
| Shipping production store keystores in-repo | Forbidden |

---

## Still open (honest)

### P0 / hardening & operator evidence
- [ ] Staging IDOR matrix evidence pack (manual) for travel/leave/imprest/procurement/PIF
- [ ] Medium authz / MFA / external-workplan / request-id hardening (working tree or follow-up slice — not claimed done until merged)
- [ ] Install Sentry SDKs + alert rules when a real DSN exists
- [ ] Web UX: after login, force `/profile/security` when API returns `mfa_setup_required`

### P1
- [ ] Broader EN/FR/PT coverage beyond login/sidebar shell
- [ ] More Flutter widget/integration tests (approvals flows)
- [ ] Enable axe gate in CI after `npm i -D @axe-core/playwright` + baseline fixes
- [ ] Postgres/MinIO **restore drill** with measured RTO/RPO ([docs/ops/backup-restore.md](docs/ops/backup-restore.md))
- [ ] Android/iOS **store signing** — operator keystore only ([mobile/RELEASE.md](mobile/RELEASE.md))

### P2
- [ ] k6 budgets beyond smoke scaffold
- [ ] Blue/green web deploy
- [ ] Upload malware scanning (ClamAV optional)
- [ ] Admin UI feature flags for unfinished modules
- [ ] Broader attachment MIME sniffing; TOTP replay window policy

---

## Reference

- Deploy / rollback: `scripts/deploy.sh` · [docs/ops/deploy-rollback.md](docs/ops/deploy-rollback.md)
- Readiness gates: `docs/testing/readiness-gates.md`
- Production seeder: `api/database/seeders/ProductionSeeder.php`
- Ops: `docs/ops/`
