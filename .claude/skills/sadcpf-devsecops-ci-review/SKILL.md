---
name: sadcpf-devsecops-ci-review
description: Review and create DevSecOps CI/CD gates for SADC PF app including lint, typecheck, unit tests, integration tests, API contract tests, Playwright E2E, Flutter tests, SAST, secret scanning, dependency/container scanning, DAST, performance tests, accessibility, i18n, and release blocking rules.
allowed-tools: Read Grep Glob Bash(rg *) Bash(git status *) Bash(git diff *) Bash(npm run lint) Bash(npm run typecheck) Bash(npm test *) Bash(npx playwright test *) Bash(flutter analyze) Bash(flutter test *) Bash(semgrep *) Bash(gitleaks *) Bash(trivy fs *) Bash(k6 run *)
---

# SADC PF DevSecOps CI Review

Use this when creating or reviewing GitHub Actions, GitLab CI, deployment workflows, test scripts, release gates, branch protection, and production readiness automation.

## CI/CD principle

Claude can help write code, but CI/CD must enforce quality. A release must be blocked automatically when critical security, performance, data integrity, or test failures exist.

## Required pipeline stages

### 1. Install and cache
- Deterministic dependency installation.
- Lockfile enforced.
- No production secrets in CI logs.
- Cache is safe and reproducible.

### 2. Static quality
- Lint.
- Typecheck.
- Format check if used.
- Dead code or unused export checks where available.
- No TODO/FIXME blockers in release-critical areas.

### 3. Unit tests
- Backend unit tests.
- Frontend unit tests.
- Mobile unit tests.
- Utilities and validation logic.

### 4. Integration/API tests
- Auth.
- RBAC.
- API contracts.
- Database transactions.
- Queues.
- Storage.
- Notifications.
- Audit logging.

### 5. E2E tests
- Admin workflows.
- Web workflows.
- Role-based access.
- Meeting packs.
- Attendance QR.
- Speaker requests.
- Voting.
- Language switching.

### 6. Mobile tests
- Flutter analyze.
- Flutter test.
- Integration tests where configured.
- Offline/sync tests.
- Font scaling and accessibility smoke.

### 7. Security scanning
- SAST with Semgrep or equivalent.
- Secrets scanning with Gitleaks or equivalent.
- Dependency/container/IaC scanning with Trivy or equivalent.
- DAST with OWASP ZAP or equivalent.
- Upload/mime/security tests.
- Auth/IDOR abuse tests.

### 8. Performance
- k6 API smoke.
- API P95 budget check.
- Bundle size check.
- Lighthouse or equivalent for web where applicable.
- Mobile launch/performance smoke where applicable.

### 9. Accessibility and i18n
- Accessibility tests.
- EN/FR/PT key coverage.
- Hardcoded string gate.
- Missing translation gate.

### 10. Release controls
- Blue/green or canary support.
- Rollback.
- Feature flags.
- Migration dry run.
- Backup/restore confirmation.
- Environment approval.
- Release notes.

## Block merge if

Block on:
- Critical/high security findings.
- Failing tests.
- API contract breaking changes without versioning.
- Missing audit logs for critical actions.
- i18n hardcoded strings in user-facing UI.
- Performance SLO failure.
- Data corruption risk.
- Production secrets detected.
- Direct client database writes.
- Voting integrity gaps.
- Missing rollback path.

## Output format

### CI/CD Verdict
PASS, PASS WITH CONDITIONS, or BLOCKED.

### Missing Pipeline Gates

### Weak Gates That Can Be Bypassed

### Security Scan Gaps

### Test Coverage Gaps

### Release/Rollback Risks

### Recommended Workflow Changes

### Example CI YAML
Provide practical YAML only if the repository structure is visible or the user asks for it.

### Uncomfortable Truth
State which quality issue CI currently allows into production.
