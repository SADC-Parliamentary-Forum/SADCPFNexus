---
name: sadcpf-playwright-e2e
description: Create, review, and harden Playwright E2E tests for SADC PF admin, web, meetings, documents, voting, attendance QR, speaker request, notifications, multilingual flows, and role-based access.
allowed-tools: Read Grep Glob Bash(rg *) Bash(npm run test:e2e *) Bash(npm run e2e *) Bash(npx playwright test *) Bash(npx playwright codegen *) Bash(npm run lint) Bash(npm run typecheck)
---

# SADC PF Playwright E2E Skill

Use this to design, generate, or review Playwright tests across Admin Portal, Web Portal, and browser-accessible app flows.

## Testing principle

E2E tests must prove real user outcomes, not just that pages render. Use role-based journeys and verify backend state through approved APIs where possible.

## Required role journeys

Create tests for at least:

### Public user
- View public news.
- View public events.
- Search/filter documents that are public.
- Switch language EN/FR/PT.
- Open accessibility-friendly pages.

### MP / Member
- Login.
- View only assigned meetings.
- Access meeting focus mode two days before and on meeting day.
- Download/view meeting pack.
- See voting shortcut only when eligible.
- Vote only once if eligible.
- Request to speak.
- Upload boarding pass when requested.
- Approve itinerary/ticket where applicable.
- Submit reimbursement where applicable.
- Work with token expiry mid-workflow.

### Secretariat staff
- Access permitted admin modules only.
- Upload meeting documents.
- Draft event/news items.
- Send notifications if authorized.
- View attendance list if authorized.

### Admin
- Create meeting.
- Assign participants/committee.
- Upload documents and create meeting pack.
- Publish/unpublish content.
- Create QR attendance code.
- Configure notification template.
- Create voting session.
- Assign voting eligibility.
- Publish results.
- Verify audit trail.

### President / Speaker screen
- View request-to-speak queue.
- See full name, country, designation, timestamp, and meeting context.
- Mark speaker handled.
- Prevent unauthorized queue viewing.

## High-risk scenarios

Test:
- User attempts to access another committee’s meeting.
- User attempts to view restricted pack URL directly.
- User attempts duplicate attendance scan.
- User attempts duplicate vote.
- User attempts voting after session closed.
- User attempts speaker request for meeting they are not part of.
- Admin publishes without approval.
- Document is updated after publication and version history remains clear.
- EN/FR/PT strings are visible and not mixed.
- Offline or low network simulation where feasible.
- Rapid tapping does not duplicate actions.

## Playwright standards

Use:
- Stable selectors such as `data-testid`.
- Page object model where helpful.
- Fixtures for roles and auth.
- API setup for test data, not fragile UI setup.
- Isolated test data per run.
- No dependency on production data.
- Screenshots/traces on failure.
- Accessibility assertions for critical pages.
- Explicit assertions for permissions and state.

Avoid:
- Arbitrary sleeps.
- Tests that depend on current date without freezing/controlling time.
- Reusing the same user across parallel destructive tests.
- Tests that only check text exists.

## Output format

### E2E Coverage Verdict
PASS, PASS WITH CONDITIONS, or BLOCKED.

### Critical Missing Journeys

### Test Matrix
Role x Feature x Positive/Negative x Priority.

### Playwright Test Files to Create or Update

### Required Test Data and Fixtures

### Flaky Test Risks

### Example Test Code
Provide practical Playwright code aligned to the visible project structure.

### Uncomfortable Truth
State which user journey is likely to fail in a real Plenary under pressure.
