---
name: sadcpf-api-contract-test
description: Review and generate API contract, validation, negative, authorization, pagination, rate-limit, idempotency, and observability tests for SADC PF backend services and endpoints.
allowed-tools: Read Grep Glob Bash(rg *) Bash(npm test *) Bash(npm run test *) Bash(npm run lint) Bash(npm run typecheck)
---

# SADC PF API Contract Test Skill

Use this when creating, changing, or reviewing any API endpoint.

## API-first requirements

Every feature must be exposed through secure backend APIs controlled by Admin. Every API must have:
- Versioned route.
- Request schema.
- Response schema.
- Auth requirement.
- Permission requirement.
- Error schema.
- Pagination where listing data.
- Rate limit.
- Correlation ID.
- Structured logs.
- Audit event where state changes.
- Idempotency strategy for risky mutations.
- Backward compatibility plan.

## Required endpoint review

For each endpoint, verify:

### Contract
- Route is versioned, for example `/api/v1/...`.
- Method matches behavior.
- Request body has strict schema validation.
- Response has typed schema.
- Error responses are standardized.
- Required fields are explicit.
- Nullable fields are deliberate.
- Date/time uses ISO 8601 with timezone clarity.
- File references do not expose raw storage paths.

### Auth and authorization
- Authentication is required unless explicitly public.
- Permission is checked server-side.
- Object-level access is enforced.
- Committee, meeting, country, delegation, and role scopes are enforced.
- Admin-only operations cannot be called by normal users.
- Frontend flags are never trusted.

### Data integrity
- Duplicate submission is prevented.
- Idempotency key is supported for dangerous writes.
- Transactions are used where multi-record consistency matters.
- Referential integrity is enforced.
- Soft delete or archive rules are explicit.
- Lifecycle transitions are validated.

### Performance
- List endpoints use pagination.
- Search endpoints have bounded filters.
- Sorting is indexed or documented.
- Large exports are queued.
- Media/documents use CDN or signed URLs.
- P95 target remains under 500ms for normal API calls.

### Observability
- Structured logs include correlation ID.
- Security relevant actions produce audit logs.
- Metrics exist for latency, errors, retries, sync failures, and notification results.

## Test cases to require

For every endpoint:
- Happy path.
- Missing auth.
- Wrong role.
- Wrong object scope.
- Invalid body.
- Invalid query.
- Invalid state transition.
- Duplicate request.
- Rate limit.
- Pagination boundary.
- Empty result.
- Large result.
- Token expiry.
- Audit log created.
- Correlation ID present.
- Backward compatibility.

## Output format

### API Verdict
PASS, PASS WITH CONDITIONS, or BLOCKED.

### Endpoint Inventory
List endpoints reviewed or required.

### Contract Gaps

### Authorization Gaps

### Validation Gaps

### Data Integrity Risks

### Required Tests
Group by unit, integration, contract, E2E, abuse, and performance.

### Example Test Skeletons
Provide practical examples using the project’s existing test framework where visible.

### Uncomfortable Truth
State which endpoint is most likely to become a production incident and why.
