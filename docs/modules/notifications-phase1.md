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
- Migrated producers: PIF (`ProgrammeService`), Workflow (`WorkflowService`), Assignments

## Deferred (Phase 2/3)

- Full mobile push depth (FCM stub retained)
- Broadcast campaigns
- SMS / WhatsApp
- AI digests (must never fabricate / approve / suppress mandatory)

## Permissions (PRD §104)

`notifications.view-own`, `manage-own-preferences`, `acknowledge`, `view-delivery-status`, `manage-templates`, `approve-templates`, `manage-policies`, `send-broadcast`, `approve-broadcast`, `retry`, `suppress`, `manage-providers`, `view-failures`, `view-audit`, `export`, `admin`

## Commands

- `notifications:process-outbox`
- `notifications:process-deliveries --retries`
- `notifications:process-deliveries --digest=daily|weekly`
