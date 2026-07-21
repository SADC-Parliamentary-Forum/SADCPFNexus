---
name: sadcpf-admin-control-plane
description: Enforce SADC PF Admin Web Portal authority over content, users, roles, publishing, notifications, integrations, feature flags, categories, meetings, delegations, documents, voting, attendance, and workflow configuration.
allowed-tools: Read Grep Glob
---

# SADC PF Admin Control Plane Skill

Use this whenever a feature affects who controls data, permissions, publishing, configuration, notifications, integrations, meeting access, documents, voting, attendance, or delegation workflows.

## Core rule

Admin Web Portal is the master control plane. Every app consumes data from backend APIs controlled by Admin. No mobile or public web client may become an unofficial control plane.

## Admin must control

### Content
- News.
- Events.
- Meetings.
- Media.
- Documents.
- Meeting packs.
- Recordings.
- Minutes.
- Presentations.
- Reports.
- Survey results.
- Resolutions.

### Users and access
- User creation.
- Role assignment.
- Committee/meeting access.
- Delegation access.
- Deactivation.
- Session revocation.
- MFA enforcement for privileged roles.
- Eligibility for voting.
- Speaker screen authorization.

### Platform configuration
- Feature flags.
- Notification templates.
- Category taxonomies.
- Integration toggles.
- Language settings.
- Meeting focus-mode timing.
- QR attendance settings.
- Voting session rules.
- Document visibility rules.

### Workflow governance
- Draft.
- Review.
- Approved.
- Published.
- Archived.
- Deleted.

## Review questions

Ask:
- Can Admin configure this without code changes?
- Can Admin revoke access immediately?
- Can Admin audit who changed it?
- Can Admin recover from mistakes?
- Can Admin approve before publishing?
- Can Admin control visibility by role, committee, meeting, delegation, and language?
- Can Admin disable this feature with a feature flag?
- Can Admin see operational status and failures?
- Is there a clear API contract?
- Is the frontend only rendering allowed state?

## Anti-patterns to block

Block:
- Hardcoded meeting IDs.
- Hardcoded committee access.
- Hardcoded feature availability.
- Hardcoded notification content.
- Direct DB writes from clients.
- Frontend-only access control.
- Published content without approval state.
- Hidden admin bypass routes.
- Manual database edits as normal workflow.
- No audit trail for configuration changes.

## Output format

### Admin Authority Verdict
PASS, PASS WITH CONDITIONS, or BLOCKED.

### Control Plane Violations

### Missing Admin Controls

### Missing Backend/API Controls

### Missing Audit Events

### Configuration That Must Not Be Hardcoded

### Required Tests

### Uncomfortable Truth
State where the system currently depends on developers instead of Admin users.
