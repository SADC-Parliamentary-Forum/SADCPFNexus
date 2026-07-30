# Notifications & Communications Delivery — Phase 1

Shared event-driven notification delivery for SADC PF Nexus.

## Landed (Phase 1)

- Transactional outbox (`notification_outbox`) + idempotent consume
- Event / record / recipient / channel delivery / attempt tables
- Versioned policies + template versions (EN/FR/PT ready)
- In-app inbox filters (all / unread / action required / archived)
- Preferences + quiet hours (mandatory override)
- Daily / weekly digests
- Queue priorities (critical / normal / digest)
- Retries, bounce/invalid email, dead-letter queue
- Admin delivery dashboard APIs
- Audit trail
- Secure authenticated links only (no unauthenticated approve/reject)
- Compatibility adapter: `App\Services\NotificationService` → outbox engine
- External (non-user) email recipients via `dispatchExternal` / `external_email` on `notification_recipients`
- Tracked specialized mailables via `dispatchTrackedMailable` (weekly summary HTML, correspondence attachments)

## Migrated producers

All business modules publish through the shared outbox (no direct `Mail::` from business code):

| Module | Entry |
|--------|--------|
| PIF / Programmes | `NotificationService::dispatch` |
| Workflow | `NotificationService::dispatch` |
| Assignments | `NotificationService::dispatch` |
| Leave / TOIL | `NotificationService::dispatch` |
| Travel | `NotificationService::dispatch` |
| Procurement (users) | `NotificationService::dispatch` |
| Procurement (vendor / RFQ external) | `NotificationService::dispatchExternal` |
| Correspondence outbound | `dispatchTrackedMailable` (`CorrespondenceMail`) |
| Risk / Audit / People | `dispatch` / `notifyUser` |
| Budget / Assets / Stock | `NotificationService::dispatch` |
| Timesheets / Overtime | `NotificationService::dispatch` |
| Weekly summaries | `dispatchTrackedMailable` (`WeeklySummaryMail`) |
| Salary advance / Imprest | `NotificationService::dispatch` |
| Admin template test send | `NotificationService::dispatch` |

**Engine-only** `Mail::` remains inside `FailoverMailService` / digest sender (Notifications module).

## Deferred (Phase 2/3+)

- Full mobile push depth (FCM stub retained)
- Broadcast campaigns (Phase 2 landed separately)
- SMS / WhatsApp — **Governance Configuration Pending**
- AI digests (must never fabricate / approve / suppress mandatory)

## Permissions (PRD §104)

`notifications.view-own`, `manage-own-preferences`, `acknowledge`, `view-delivery-status`, `manage-templates`, `approve-templates`, `manage-policies`, `send-broadcast`, `approve-broadcast`, `retry`, `suppress`, `manage-providers`, `view-failures`, `view-audit`, `export`, `admin`

## Commands

- `notifications:process-outbox`
- `notifications:process-deliveries --retries`
- `notifications:process-deliveries --digest=daily|weekly`
