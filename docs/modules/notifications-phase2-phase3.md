# Notifications & Communications Delivery — Phase 2 / Phase 3

Extends the shared Phase 1 outbox engine (`/notifications`, `/admin/notifications`). Does **not** create a parallel delivery path.

## Phase 2 (PRD §122) — landed

| Capability | Notes |
|---|---|
| Full mobile push | Device register / refresh / revoke; Null or FCM-generic HTTP provider (`NOTIFICATIONS_PUSH_PROVIDER`); privacy-safe lock-screen bodies; push in policy |
| Acknowledgement campaigns | Required ack, deadline, calendar-aware reminders, escalation, ack report |
| Advanced broadcasts | create → submit → approve / cancel; SoD sender ≠ approver for high/critical & maintenance; audience via roles / group_codes / user_ids / OU |
| Provider failover | Primary/secondary mailer; automatic failover on temporary failure |
| Coalescing | High-frequency optional updates combine; critical/action/mandatory never delayed |
| Richer analytics | Success / fail / bounce / latency / dead-letter by channel & module |
| Calendar-aware reminders | Uses Workflow `SlaCalendarService` / working calendars when present |
| Mobile deep links | Structured web + `sadcpfnexus://` routes; still auth-gated; no unauthenticated approve tokens |
| External portal | Tokenised minimal notices with expiry; no internal record dump |
| Maintenance alerts | Scheduled broadcast type + revalidation |

## Phase 3 (PRD §123) — landed (guarded)

| Capability | Notes |
|---|---|
| Digest summarisation | Stub/HTTP summarises **existing** digest items only — never invents events |
| Preference suggestions | Suggestions only; user confirms; cannot disable mandatory categories |
| Fatigue analysis | Admin metrics / hints — cannot suppress mandatory |
| Predictive channels | Advisory only; policy still decides mandatory channels |
| NL inbox search | Basic filter assist (`unread` / `action_required` / module keywords) |
| SMS / WhatsApp | **Null stubs only** — marked **Governance Configuration Pending**; live send disabled |

## AI must never

fabricate events · change authority · approve · expose confidential · suppress mandatory without policy · rewrite legal/security wording without human approval

## Key env vars

```
NOTIFICATIONS_PUSH_PROVIDER=null
# NOTIFICATIONS_FCM_HTTP_URL=
NOTIFICATIONS_EMAIL_SECONDARY_MAILER=
NOTIFICATIONS_EMAIL_FAILOVER_ENABLED=true
NOTIFICATIONS_AI_PROVIDER=stub
NOTIFICATIONS_AI_ENABLED=true
NOTIFICATIONS_SMS_PROVIDER=null
NOTIFICATIONS_WHATSAPP_PROVIDER=null
NOTIFICATIONS_DEEP_LINK_SCHEME=sadcpfnexus
NOTIFICATIONS_EXTERNAL_TOKEN_TTL_HOURS=72
```

## Commands

- `notifications:process-outbox`
- `notifications:process-deliveries --retries --scheduled --coalesce --ack-reminders`
- `notifications:process-deliveries --digest=daily|weekly`
- `notifications:process-deliveries --maintenance`

## Tests

`NotificationsPhase2Phase3Test` + Phase 1 regression smoke (`NotificationsPhase1Test`).

## Deferred

- Live SMS / WhatsApp (await governance + credentials — do not invent keys)
- Live FCM until `NOTIFICATIONS_PUSH_PROVIDER=fcm` + credentials configured
- Email open tracking as delivery proof (explicitly out of policy)
