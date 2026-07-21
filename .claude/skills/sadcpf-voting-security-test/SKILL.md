---
name: sadcpf-voting-security-test
description: Review and test SADC PF voting workflows for eligibility, quorum, one-person-one-vote, tamper resistance, auditability, role scoping, result publication, failure handling, and legal defensibility.
allowed-tools: Read Grep Glob Bash(rg *) Bash(npm test *) Bash(npm run test *) Bash(npx playwright test *) Bash(npm run lint) Bash(npm run typecheck)
---

# SADC PF Voting Security Test Skill

Use this for every voting, motions, resolutions, bills, quorum, plenary decision, committee decision, and result-publication workflow.

## Voting security principle

Voting is a critical governance function. The system must be legally defensible, auditable, tamper-resistant, role-scoped, and failure-tolerant. Convenience must never override integrity.

## Required voting model checks

### Eligibility
Verify:
- Eligibility is computed server-side.
- Eligibility is tied to meeting, country, delegation, role, voting session, and applicable rules.
- Ineligible users never see actionable vote controls.
- Hidden frontend controls are not the real protection.
- Eligibility changes are audited.
- Proxy/delegation rules are explicit if supported.

### Session lifecycle
Verify lifecycle:
- Draft.
- Review.
- Approved.
- Open.
- Paused where applicable.
- Closed.
- Results reviewed.
- Results published.
- Archived.

Every transition must require permission and audit logging.

### Vote casting
Verify:
- One eligible voter can vote only once per voting item/session unless formal vote-change rules exist.
- Duplicate taps are idempotent.
- Network retries do not duplicate votes.
- Vote timestamp is server-generated.
- Client clock is not trusted.
- Vote receipt is generated without exposing sensitive details beyond policy.
- Vote secrecy or transparency model is explicit.

### Integrity
Verify:
- Votes cannot be modified silently.
- Administrative correction, if allowed, requires dual control or strong audit.
- Vote records have immutable event trail.
- Results are recomputed from source records or stored with verifiable snapshot.
- Published results cannot differ from approved results without audit.
- Database transactions prevent partial state.

### Availability
Verify:
- API handles peak plenary load.
- Rate limits protect without blocking valid voters.
- Queue/retry strategy is safe.
- Failure state preserves user intent.
- Notification provider failure does not corrupt vote state.

### Results
Verify:
- Only authorized users can see live results.
- Result publication is explicit.
- Ties, abstentions, spoiled/invalid votes, quorum, majority thresholds, and country-specific rules are handled.
- Export includes audit metadata.
- Results are archived and reproducible.

## Required attack tests

Test:
- Vote as ineligible user.
- Vote for another meeting.
- Vote after close.
- Vote before open.
- Vote twice through rapid clicks.
- Vote twice through parallel requests.
- Vote with manipulated payload.
- Change vote without permission.
- Admin attempts silent correction.
- Direct API call bypassing UI.
- Replay old vote request.
- Token expires mid-vote.
- User loses connectivity after pressing vote.
- Role changed during vote.
- Device clock wrong.
- Results endpoint accessed early.

## Output format

### Voting Integrity Verdict
PASS, PASS WITH CONDITIONS, or BLOCKED.

### Critical Blockers

### Legal/Audit Risks

### Eligibility Gaps

### Integrity Gaps

### Abuse Test Matrix
Use: Scenario, Expected Result, Test Type, Priority.

### Required Implementation Changes

### Required Tests Before Release

### Uncomfortable Truth
State the failure mode most likely to undermine confidence in a real vote.
