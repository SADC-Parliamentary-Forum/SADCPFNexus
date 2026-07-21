---
name: sadcpf-mobile-offline-test
description: Review and generate mobile offline, low-connectivity, sync, cache, conflict, token-expiry, and resilience tests for SADC PF mobile app features such as meeting packs, voting visibility, attendance, speaker requests, boarding passes, itinerary approvals, and reimbursements.
allowed-tools: Read Grep Glob Bash(rg *) Bash(flutter analyze) Bash(flutter test *) Bash(flutter drive *) Bash(dart test *)
---

# SADC PF Mobile Offline and Low-Connectivity Test Skill

Use this for any mobile feature, especially Flutter mobile features.

## Offline-first principle

The mobile app must remain usable in low bandwidth and intermittent connectivity. The server remains the source of truth. Offline actions are queued, signed where appropriate, reconciled safely, and never blindly trusted.

## Required offline checks

### Cached content
Verify:
- Meeting packs are cached for authorized users.
- Cached documents are encrypted or protected where applicable.
- Cached data shows freshness indicator.
- Cache is invalidated after logout or permission revocation.
- Updated packs show version/freshness changes.
- Restricted content does not remain accessible to the wrong user.

### Offline action queue
Verify:
- Attendance scan action queues safely.
- Speaker request queues safely if allowed.
- Boarding pass upload queues safely.
- Itinerary approval queues safely.
- Reimbursement draft queues safely.
- Voting does not proceed offline unless a formally approved secure offline voting design exists.
- Queue preserves user intent.
- Queue retries safely.
- Queue does not duplicate actions.
- Queue handles partial failures.

### Sync and conflict resolution
Verify:
- Server rejects stale or unauthorized queued actions.
- Client explains rejected sync actions clearly.
- Conflict resolution is deterministic.
- Duplicate submissions are deduplicated server-side.
- Device clock mismatch does not corrupt workflow.
- Token expiry mid-sync triggers safe refresh/re-auth.

### Low bandwidth
Verify:
- App launch remains under 3 seconds where feasible.
- Initial payload is small.
- Images/media are lazy-loaded.
- Documents download progressively or with clear progress.
- Background sync does not block navigation.
- Failure states are clear and actionable.

### Multi-device behavior
Verify:
- User action on device A updates device B.
- Revoked sessions stop syncing.
- Queue on old device does not override newer server state.
- Logout clears restricted cache.

## Required test types

Use:
- Unit tests for queue logic.
- Repository/service tests for sync.
- Integration tests for offline/online transitions.
- E2E tests where the framework supports network manipulation.
- Manual exploratory checklist for real devices and weak network simulation.

## Output format

### Offline Readiness Verdict
PASS, PASS WITH CONDITIONS, or BLOCKED.

### Critical Offline Risks

### Cache Risks

### Sync Conflict Risks

### Token and Session Risks

### Tests to Add
Group by unit, integration, E2E, manual low-bandwidth tests.

### Required UX States
List required loading, offline, syncing, failed, conflict, stale, and permission-revoked states.

### Example Test Code
Use existing Flutter/Dart patterns where visible.

### Uncomfortable Truth
State which offline assumption is unsafe.
