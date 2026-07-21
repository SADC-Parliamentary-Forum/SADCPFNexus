---
name: sadcpf-security-review
description: Perform a strict security review for SADC PF backend, admin, web, mobile, API, authentication, authorization, voting, attendance, delegation, travel, document, media, notification, and integration changes.
allowed-tools: Read Grep Glob Bash(rg *) Bash(git diff *) Bash(git status *) Bash(npm run lint) Bash(npm run typecheck) Bash(npm test) Bash(semgrep *) Bash(gitleaks *)
---

# SADC PF Security Review

Review the change under a Zero Trust model. Assume networks are hostile, clients are compromised, tokens can leak, and users make mistakes.

## Security baseline

The system must enforce:
- OAuth2/OIDC-compatible authentication patterns.
- Server-side RBAC.
- Future ABAC compatibility.
- MFA for privileged users.
- Short-lived access tokens and safe refresh strategy.
- TLS for data in transit.
- Encryption at rest.
- Secrets stored only in a vault or approved secret manager.
- Tamper-resistant audit logs.
- Input validation at every API boundary.
- No direct client database writes.
- No hidden privileged operations.

## Mandatory checks

### Authentication
Check:
- Login flow does not leak tokens.
- Access token lifetime is short.
- Refresh token rotation or equivalent protection exists.
- Session revocation is supported.
- Admin MFA is enforced.
- Password reset flow cannot be abused.

### Authorization
Check:
- RBAC is enforced server-side.
- Each endpoint checks permissions explicitly.
- Object-level authorization prevents IDOR.
- Committee, meeting, country, delegation, and role scoping are enforced.
- Voting eligibility is computed server-side only.
- Admin override requires explicit audit logging.

### Input and output safety
Check:
- API request bodies are schema-validated.
- Query parameters are sanitized and bounded.
- File uploads validate MIME type, extension, size, malware scanning status, and storage path.
- Rich text is sanitized against XSS.
- Public content rendering prevents stored XSS.
- Search filters cannot trigger injection.
- API errors do not leak stack traces or secrets.

### Data protection
Check:
- Sensitive data is encrypted at rest.
- Documents, boarding passes, reimbursements, travel details, and personal details have scoped access.
- Signed URLs expire quickly.
- Cache does not expose restricted content to the wrong user.
- Logs do not contain tokens, passwords, OTPs, or sensitive personal data.

### Audit and compliance
Confirm audit events exist for:
- Login attempts.
- Failed login attempts.
- Permission changes.
- Role assignments.
- User creation/deactivation.
- Session revocation.
- Content changes.
- Publishing actions.
- Voting setup and result publication.
- Attendance QR generation and scan validation.
- Data exports.
- Admin overrides.
- Document uploads/deletions.
- Notification sends.

### Abuse cases
Test for:
- IDOR.
- Mass assignment.
- SQL/NoSQL injection.
- XSS.
- CSRF where cookie auth is used.
- SSRF.
- Path traversal.
- Rate-limit bypass.
- Replay attack.
- Duplicate submission.
- Token expiry mid-workflow.
- Device clock manipulation.
- Offline action tampering.
- Multi-device session conflict.

## Commands to run when available

Prefer project scripts first:
```bash
npm run lint
npm run typecheck
npm test
```

Then run security scanners when installed:
```bash
semgrep --config=auto .
gitleaks detect --source .
```

Do not install packages or run destructive commands unless the user explicitly approves.

## Output format

### Security Verdict
PASS, PASS WITH CONDITIONS, or BLOCKED.

### Critical Vulnerabilities
Issues that can expose data, bypass permission, corrupt records, compromise voting, or weaken Admin authority.

### High-Risk Findings
Important but not immediately catastrophic issues.

### Missing Security Controls
Controls that must be added.

### Tests to Add
Specific unit, integration, API, E2E, abuse-case, and regression tests.

### Audit Log Gaps
Missing audit events and required fields.

### Fix Order
Numbered sequence of fixes.

### Uncomfortable Truth
State the security assumption that is likely false.
