# Observability (optional Sentry + request IDs)

## X-Request-Id

- Middleware: `App\Http\Middleware\AssignRequestId`
- Accepts inbound `X-Request-Id` (8–128 safe chars) or generates a UUID.
- Echoes the same value on every API response; CORS exposes `X-Request-Id`.
- Include this ID in support tickets and incident notes.

## Structured logging

Laravel production `LOG_LEVEL` should be `warning` or `error` (see `api/.env.production.example`). Prefer logging with context keys:

- `request_id`
- `user_id` (when authenticated)
- `route` / exception class

`App\Support\Observability::captureException()` logs with `request_id` and forwards to Sentry **only if** a DSN is configured and the SDK is installed.

## Optional Sentry (no hardcoded DSN)

**API**

```env
SENTRY_LARAVEL_DSN=https://<key>@o<org>.ingest.sentry.io/<project>
# or SENTRY_DSN=...
```

Install when ready: `composer require sentry/sentry-laravel` and publish config per Sentry Laravel docs.

**Web (Next.js)**

```env
NEXT_PUBLIC_SENTRY_DSN=
# server-only if using @sentry/nextjs later:
SENTRY_AUTH_TOKEN=
```

Do not invent organisation accounts or commit DSNs. Until packages are installed, env vars are inert documentation hooks.

**Web client hook:** `web/lib/observability.ts` — `captureClientException()` no-ops without `NEXT_PUBLIC_SENTRY_DSN` / window `Sentry`; API axios interceptor calls it on 5xx.

## Health checks

- API: `/up` (Laravel) and `/api/v1/auth/ping`
- Deploy script post-checks: see `scripts/deploy.sh`
