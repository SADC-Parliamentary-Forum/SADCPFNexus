## Summary

<!-- What does this change and why? Link the issue / PRD section / plan (e.g. .claude/PRPs/plans/*.plan.md). -->

## Area

- [ ] `api/` (Laravel)
- [ ] `web/` (Next.js)
- [ ] `mobile/` (Flutter)
- [ ] Infra / CI / docs

## Checklist

- [ ] Tests added or updated for the changed behaviour
- [ ] API: `php artisan test` passes and `./vendor/bin/pint --test` is clean on changed files
- [ ] Web: `npx tsc --noEmit` and `npm run build` pass
- [ ] Mobile: `flutter analyze` and `flutter test` pass (codegen run first)
- [ ] New migrations are reversible and grant `app_user` on new tables (pgsql)
- [ ] User-facing strings added to the EN/FR/PT catalogs where applicable
- [ ] No secrets, real `.env` values or production data in the diff
- [ ] Approval-path changes respect the workflow engine's `self_approval_policy` (see `docs/adr/0001-*`)

## Production / rollout notes

<!-- No staging environment exists. Note any data backfill, notification bursts, scheduled-command changes,
     or the transactional rollback smoke test you ran. Write "None" if not applicable. -->

## Screenshots (UI changes)
