---
name: sadcpf-threat-model-stride
description: Run a STRIDE threat model for any SADC PF feature before implementation or release, especially voting, attendance QR, speaker requests, meeting packs, document sharing, delegation, travel, reimbursement, notifications, AI bot, and integrations.
allowed-tools: Read Grep Glob
---

# SADC PF STRIDE Threat Model

Threat-model the feature using STRIDE:
- Spoofing
- Tampering
- Repudiation
- Information disclosure
- Denial of service
- Elevation of privilege

Use this before implementation, before security review, and before production acceptance.

## Feature context to establish

Identify:
- Actors.
- Roles.
- Admin users.
- Privileged workflows.
- External users.
- Backend services.
- APIs.
- Databases.
- Queues.
- Storage buckets.
- Notification providers.
- AI or search indexes.
- Offline/mobile cache.
- Audit logs.
- Third-party integrations.

## Trust boundaries

Map:
- Mobile app to API.
- Web app to API.
- Admin portal to API.
- API to database.
- API to object storage.
- API to queue.
- Queue workers to database/storage.
- Notification service boundary.
- AI bot or knowledge base boundary.
- Public content boundary.
- Restricted meeting/committee boundary.

## STRIDE checks

### Spoofing
Check:
- Can a user impersonate an MP, Clerk, Secretary, President, Admin, or Speaker?
- Can QR attendance scans be forged?
- Can voting identity be spoofed?
- Can refresh tokens be reused?
- Can a device identity be faked?

### Tampering
Check:
- Can meeting packs be modified after approval?
- Can offline actions be altered before sync?
- Can vote records be changed?
- Can notification payloads be manipulated?
- Can file metadata or URLs be tampered with?

### Repudiation
Check:
- Can a user deny submitting, approving, publishing, voting, scanning, uploading, or exporting?
- Are audit records tamper-resistant?
- Are timestamps synchronized?
- Are correlation IDs present?

### Information disclosure
Check:
- Can a user access restricted meeting packs?
- Can one delegation view another delegation’s documents?
- Can reimbursement, boarding pass, or travel data leak?
- Can signed URLs live too long?
- Can caches expose documents after logout?
- Can logs leak sensitive values?

### Denial of service
Check:
- Can uploads exhaust storage?
- Can QR scans flood attendance APIs?
- Can notification sends overwhelm queues?
- Can voting or speaker request APIs be spammed?
- Are rate limits and backpressure in place?

### Elevation of privilege
Check:
- Can normal staff become admin?
- Can committee-only access become plenary-wide access?
- Can a member access voting they are not eligible for?
- Can frontend flags unlock hidden features?
- Can API role checks be bypassed?

## Required mitigation categories

For every material threat, assign:
- Preventive control.
- Detective control.
- Recovery control.
- Test case.
- Owner.
- Severity.

## Output format

### Feature Being Threat-Modelled

### Data Flow Summary

### Trust Boundaries

### STRIDE Findings
Use a table with: Threat, Scenario, Impact, Existing Control, Missing Control, Severity, Test Required.

### Required Design Changes

### Required Security Tests

### Required Audit Events

### Residual Risk

### Uncomfortable Truth
State the most likely attack path.
