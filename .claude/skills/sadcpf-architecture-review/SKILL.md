---
name: sadcpf-architecture-review
description: Review SADC PF architecture changes for Admin Web Portal control-plane authority, API-first design, backend-owned business logic, versioned APIs, low-bandwidth performance, resilience, and future readiness. Use before implementing or merging any module, service, database, admin, mobile, or web change.
allowed-tools: Read Grep Glob
---

# SADC PF Architecture Review

Review the requested change as part of the SADC PF enterprise News, Events, Meetings, Documents, Voting, Attendance, Delegation, Travel, and Admin platform.

## Non-negotiable architecture law

The Admin Web Portal is the master control plane and single source of truth.

Reject or flag any design where:
- Mobile app writes directly to the database.
- Web app writes directly to the database outside approved backend APIs.
- Business logic exists only in frontend/mobile.
- Configuration is hardcoded in apps.
- Publishing, permissions, feature flags, notifications, integrations, or taxonomies bypass Admin authority.
- Any workflow is impossible to audit later.

## Required review steps

1. Identify the module or workflow being changed.
2. Trace data ownership:
   - Admin authority.
   - Backend service ownership.
   - API contract.
   - Client consumption path.
   - Audit trail.
3. Check API-first compliance:
   - Versioned API route.
   - Contract/schema validation.
   - Backward compatibility.
   - Rate limiting.
   - Auth and authorization boundary.
   - Observability hooks.
4. Check data model:
   - Referential integrity.
   - Duplicate detection.
   - Lifecycle states where applicable.
   - Soft delete versus hard delete policy.
   - Migration rollback safety.
5. Check client architecture:
   - No trusted client decisions.
   - Offline cache is read-through and sync-safe.
   - Local actions are queued and reconciled by server authority.
   - Feature flags come from backend/Admin config.
6. Check resilience:
   - Retry strategy.
   - Idempotency for mutations.
   - Graceful degradation.
   - Provider failure behavior.
   - No duplicate processing.
7. Check low-connectivity suitability:
   - Pagination.
   - Lazy loading.
   - Cache-first reads where safe.
   - Data freshness indicators.
   - CDN media delivery.
8. Check future readiness:
   - AI summarisation.
   - Search/indexing.
   - Recommendations.
   - Chatbot/voice integrations.
   - Analytics expansion.

## Output format

Return exactly these sections:

### Architecture Verdict
PASS, PASS WITH CONDITIONS, or BLOCKED.

### Critical Blockers
List issues that violate the Admin control-plane, API-first, security, data integrity, or auditability model.

### Required Changes
List the precise changes needed.

### Missing APIs or Contracts
List endpoints, schemas, events, or admin controls that must exist.

### Data and Workflow Risks
Call out lifecycle, sync, duplication, migration, or conflict risks.

### Tests Required Before Merge
List unit, integration, API contract, E2E, offline, performance, and security tests.

### Uncomfortable Truth
State the hidden risk or weak assumption the team may be ignoring.
