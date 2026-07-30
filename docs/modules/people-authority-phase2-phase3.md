# People & Authority — Phase 2 / Phase 3

Implements PRD §126 (Phase 2) and §127 (Phase 3) on top of Phase 1.

## Phase 2

| Capability | Notes |
|---|---|
| Certificate signatures | `PEOPLE_AUTHORITY_CERTIFICATE_DRIVER=stub\|pkcs11_http` — stub default; no private keys stored |
| External e-sign | `null\|generic_http` — **human-triggered submit only** |
| M365 / directory sync | `null\|fixture\|microsoft_graph` — read-only; dry-run default |
| Role recertification | Opens access-review campaigns with role items; schedule optional |
| Advanced SoD analysis | Conflict reports from `people_authority_sod_rules` |
| Org scenario planning | Draft future structure versions (not live) |
| Payroll/HR hooks | Link `payroll_identifier` + identifier export — **no invented rates** |
| Public signature verify | `/api/v1/people-authority/public/verify-signature/{token}` — approved metadata only |

## Phase 3

| Capability | Notes |
|---|---|
| Succession planning | Plans + candidates per position |
| Skills directory | Catalog + person skill levels |
| Access recommendations | AI suggestions only |
| Anomalous privilege detection | Alerts/suggestions — never auto-revoke/grant |
| NL org search | Basic keyword search over people/units/positions |
| Org analytics | Counts and open-alert metrics |

## AI hard guards

AI recommendations must **never** automatically grant:

- access
- authority
- delegation
- signing rights
- privileged roles

Human confirmation is required; only safe apply actions (`attach_note`, `record_search_hint`, `open_review_item`) are allowed.

## Key env vars

See `api/.env.example` (`PEOPLE_AUTHORITY_*`, `PLAY_STORE_*`, `ASC_*`).

## Operator credentials

Admin → System Settings shows configured/not-configured for IMAP, telematics, LLMs, Google Calendar, payroll, Play/ASC, M365, e-sign, certificate, People AI — never secret values.

## Artisan

```bash
php artisan people-authority:open-recertifications
```

Enabled via `PEOPLE_AUTHORITY_RECERT_SCHEDULE_ENABLED=true` (weekly schedule in `routes/console.php`).
