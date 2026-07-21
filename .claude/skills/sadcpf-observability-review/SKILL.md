---
name: sadcpf-observability-review
description: Review SADC PF logging, metrics, tracing, alerts, audit logs, dashboards, incident runbooks, crash reporting, sync failure monitoring, notification monitoring, and security anomaly detection.
allowed-tools: Read Grep Glob Bash(rg *) Bash(git diff *) Bash(npm test *) Bash(npm run lint) Bash(npm run typecheck)
---

# SADC PF Observability Review

Use this when building or reviewing backend services, admin workflows, mobile sync, notifications, voting, attendance, speaker queue, document uploads, AI bot, and integrations.

## Observability principle

If the team cannot see what happened, when it happened, who triggered it, what failed, and how users were affected, the feature is not production-ready.

## Required logs

Logs must be:
- Structured.
- Searchable.
- Time synchronized.
- Correlated by request/correlation ID.
- Sanitized to avoid secrets and sensitive values.
- Useful for reconstructing user journeys.

Log:
- API request failures.
- Auth failures.
- Permission denials.
- Validation failures.
- Queue retries.
- Provider failures.
- Sync conflicts.
- File upload failures.
- Voting lifecycle transitions.
- Attendance scan failures.
- Notification send outcomes.
- Admin overrides.
- Data exports.

## Required metrics

Track:
- API latency P50/P95/P99.
- API error rate.
- Auth failure rate.
- Permission denial rate.
- Crash rate.
- Mobile sync failures.
- Offline queue backlog.
- Notification success/failure rate.
- Queue depth.
- Document upload failures.
- CDN/media errors.
- Search latency.
- Voting API latency.
- Attendance scan volume.
- Speaker request queue delay.

## Required alerts

Alert on:
- Security anomalies.
- Repeated failed logins.
- Privilege escalation attempts.
- Sudden API error spikes.
- API latency SLO breach.
- Notification provider failure.
- Queue backlog growth.
- Sync failure spike.
- Audit logging failure.
- Database migration failure.
- Data integrity anomalies.
- Voting session errors.
- Attendance scan abuse.

## Required audit logs

Audit logs are not normal logs. They must be tamper-resistant and retained according to governance policy.

Audit:
- Login attempts.
- Permission changes.
- User creation/deactivation.
- Session revocation.
- Content changes.
- Publishing actions.
- Data exports.
- Admin overrides.
- Voting setup, eligibility change, lifecycle transition, result publication.
- Attendance QR creation, expiry, scan validation.
- Document upload, update, delete, publish, archive.
- Notification template change and broadcast send.

## Output format

### Observability Verdict
PASS, PASS WITH CONDITIONS, or BLOCKED.

### Blind Spots

### Missing Logs

### Missing Metrics

### Missing Alerts

### Missing Audit Events

### Dashboard Requirements

### Incident Runbooks Required

### Uncomfortable Truth
State what failure the team would currently discover too late.
