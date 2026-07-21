---
name: sadcpf-performance-budget
description: Review SADC PF app, admin, web, mobile, API, media, documents, search, notifications, and sync changes against low-bandwidth enterprise performance budgets and scalability targets.
allowed-tools: Read Grep Glob Bash(rg *) Bash(npm run build) Bash(npm run lint) Bash(npm run typecheck) Bash(npm test *) Bash(npx playwright test *) Bash(k6 run *) Bash(flutter analyze) Bash(flutter test *)
---

# SADC PF Performance Budget Review

Use this when adding or reviewing any feature that affects page load, app launch, API latency, media, documents, search, sync, notification, or dashboard performance.

## Baseline targets

The platform should target:
- App launch under 3 seconds.
- API response under 500ms P95 for normal operations.
- CDN-optimized media.
- Pagination for list data.
- Lazy loading for heavy views.
- Background sync for mobile.
- Queues for heavy jobs.
- Graceful performance under weak network conditions.

## Required performance checks

### API
Check:
- Pagination exists for lists.
- Query limits are enforced.
- Sorting/filtering fields are indexed or bounded.
- N+1 queries are avoided.
- Heavy exports run in background jobs.
- File processing runs in queues.
- Caching is safe and permission-aware.
- Response payloads are not bloated.
- P95 latency is measured.
- Timeouts are explicit.

### Web/Admin
Check:
- Large admin tables are paginated/virtualized.
- WYSIWYG media is optimized.
- Meeting pack pages lazy-load documents.
- Search is debounced.
- Routes split heavy modules.
- No unnecessary client bundle bloat.
- Images use optimized sizes.
- Errors and loading states are quick and clear.

### Mobile
Check:
- Startup work is minimized.
- Cached meeting focus content loads first.
- Sync runs in background.
- Large documents are not auto-downloaded without policy.
- Media loads progressively.
- Offline queue does not block UI.
- App remains usable on intermittent connection.

### Documents and media
Check:
- CDN delivery.
- Signed URL strategy.
- Thumbnail/previews where useful.
- File size limits.
- Progressive download or clear progress.
- Search indexing is asynchronous.

### Notifications
Check:
- Sends are queued.
- Provider failure retries safely.
- Duplicate notification prevention exists.
- Success/failure metrics are recorded.

## Output format

### Performance Verdict
PASS, PASS WITH CONDITIONS, or BLOCKED.

### Performance Budget Risks

### API Bottlenecks

### Client Bottlenecks

### Database/Query Risks

### Media/Document Risks

### Required Optimizations

### Tests and Metrics Required
Include k6, Playwright, Lighthouse, mobile profiling, API latency, and sync failure metrics.

### Uncomfortable Truth
State which screen or workflow will feel slowest in a real low-bandwidth parliamentary meeting.
