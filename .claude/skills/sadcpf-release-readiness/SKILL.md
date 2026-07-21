---
name: sadcpf-release-readiness
description: Run final production acceptance checks for the full SADC PF app across admin, web, mobile, API, database, security, performance, observability, accessibility, i18n, offline, DevSecOps, and data readiness.
allowed-tools: Read Grep Glob Bash(git status *) Bash(git diff *) Bash(rg *) Bash(npm run lint) Bash(npm run typecheck) Bash(npm test *) Bash(npx playwright test *) Bash(flutter analyze) Bash(flutter test *) Bash(semgrep *) Bash(gitleaks *) Bash(trivy fs *) Bash(k6 run *)
---

# SADC PF Release Readiness Skill

Use this before production release, UAT sign-off, or major demo.

## Definition of done

A feature or release is complete only when it is:
- Secure.
- Tested.
- Observable.
- Documented.
- Performant.
- Accessible.
- Failure tolerant.
- Admin-controlled.
- API-first.
- Auditable.
- Free from temporary/mock/demo data.

## Required production checks

### Architecture
- Admin Web Portal remains master control plane.
- No client direct database writes.
- APIs are versioned.
- Backend owns business logic.
- Feature flags are Admin/backend controlled.
- Configuration is not hardcoded.

### Security
- Auth and RBAC enforced.
- MFA for privileged users.
- Secrets are not committed.
- Audit logs exist for critical actions.
- Upload security exists.
- IDOR tests exist.
- Data exports are controlled.
- Sensitive data is encrypted.

### Testing
- Unit tests pass.
- Integration tests pass.
- API contract tests pass.
- E2E tests pass.
- Security tests pass.
- Performance tests pass.
- Offline simulation tests pass.
- Accessibility tests pass.
- i18n hardcoded string gate passes.
- Critical modules have negative tests.

### Data
- No mock/demo/test records in production seed.
- Migrations are reversible or rollback-safe.
- Referential integrity is enforced.
- Duplicate detection exists.
- Soft delete/archive policy is implemented.
- Backup and restore procedures are tested.

### Observability
- Structured logs.
- Correlation IDs.
- Metrics.
- Alerts.
- Crash reporting.
- Sync failure monitoring.
- Notification success/failure monitoring.
- Security anomaly alerts.
- Audit log search.

### Operations
- Blue/green or canary deployment.
- Instant rollback.
- Feature flag rollout.
- Environment variables documented.
- Secrets stored in approved vault.
- Runbooks exist.
- Incident response path exists.

### UX
- Meeting focus mode works.
- Meeting packs are easy to access.
- Voting is prominent only for eligible users.
- Speaker request flow is clear.
- EN/FR/PT switching works.
- Accessibility standards are met.
- Offline and stale data states are clear.

## Output format

### Release Verdict
READY, READY WITH CONDITIONS, or DO NOT RELEASE.

### Release Blockers

### High-Risk Defects

### Missing Evidence
List missing test reports, scans, screenshots, logs, migration reports, or approvals.

### Production Data Risks

### Operational Risks

### Required Fixes Before Release

### Suggested Fixes After Release

### Final Go/No-Go Checklist

### Uncomfortable Truth
State the one thing most likely to embarrass the team during launch or Plenary use.
