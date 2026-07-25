# Incident response (API / Web / Mobile)

## Severity

| Level | Examples | Initial response |
|-------|----------|------------------|
| Sev-1 | Auth bypass, data leak, ransomware, full outage | Immediate contain + notify SG/ICT |
| Sev-2 | Privilege bug in one module, partial outage | Patch / feature-flag hide; notify ICT |
| Sev-3 | Degraded performance, non-critical bug | Ticket + next deploy window |

## Containment playbook (Sev-1 / Sev-2 security)

1. **Preserve evidence** — note `X-Request-Id` from client/browser Network tab; collect `api/storage/logs/laravel.log` around the window.
2. **Contain** — revoke compromised Sanctum tokens (`personal_access_tokens`); force password reset for affected users; temporarily disable public routes if needed via reverse-proxy.
3. **Rotate secrets** — `APP_KEY` only with a planned session invalidation; rotate DB/Redis/mail/FCM as applicable.
4. **Patch** — prefer hotfix on `main` + `./scripts/deploy.sh`; avoid inventing unfinished modules as “fixes”. Rollback steps: [deploy-rollback.md](./deploy-rollback.md).
5. **Communicate** — internal ICT first; external notice only if personal data was exposed (follow organisational policy).

## Useful correlation

- Every API response should include **`X-Request-Id`** (see AssignRequestId middleware).
- Ask reporters for that header value when filing incidents.
- Optional: set `SENTRY_LARAVEL_DSN` / `NEXT_PUBLIC_SENTRY_DSN` (see [observability.md](./observability.md)).

## Privileged MFA

Production should run with `REQUIRE_PRIVILEGED_MFA=true` (default when `APP_ENV=production`). Privileged roles without MFA receive `403` + `mfa_setup_required` and must complete `/profile/security`.

## Post-incident

- Root cause note in ticket
- Regression test if authz/auth bug
- Update [REMAINING_WORK.md](../../REMAINING_WORK.md) if residual risk remains
