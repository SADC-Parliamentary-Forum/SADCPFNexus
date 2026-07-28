# Correspondence Register Phase 1 — Design

**Date:** 2026-07-28  
**Scope:** PRD §144 Production Critical; §147 architecture rules non-negotiable.

## Assumptions

1. Parent/user authorized full Phase 1; interactive brainstorm approval waived for subagent delivery.
2. Extend existing `correspondence` table and ICRMS APIs — do not fork a parallel register.
3. Assignments module exists (`/api/v1/assignments`); linkage creates/links real `Assignment` rows.
4. SAAM `SignatureEvent` morphs onto `Correspondence` for official signing.
5. Letterhead remains system settings; Phase 1 records `letterhead_applied_at` when final PDF/version locked.
6. Phase 2/3 (mailbox ingest, AI, mail merge, retention) deferred — sidebar stubs only.
7. PostgreSQL `ilike` search retained; confidentiality ACL applied before search projection.

## Status model

### Incoming (`direction=incoming`)
`received` → `registered` → `pending_sg_routing` → `routed` → `in_progress` → `responded` | `closed` | `archived`  
Exceptions: `misrouted`, `duplicate`, `personal`, `cancelled`

### Outgoing (`direction=outgoing`) — preserves existing
`draft` → `pending_review` → `pending_approval` → `approved` → `signed` → `ready_dispatch` → `sent` → `closed` | `archived`  
Plus `voided` for abandoned refs.

Legacy clients still see draft/review/approve/sent.

## Reference numbering

`correspondence_reference_ledger` is the source of truth:

- Server allocates next sequence under `lockForUpdate` per `(tenant_id, direction, year, series)`.
- Incoming default: `IN/{year}/{seq:05}`
- Outgoing default (legacy-style configurable): `{file}/{signatory}/{preparer}/{seq:04}/{year}`
- Assign outgoing final ref on **approve** (existing behaviour) or registry accept-for-dispatch.
- Voided rows keep `reference` unique; `correspondence_id` nullable; never reuse.

## Ownership & routing

- `correspondence_routes` append-only history (SG actions).
- Exactly one `primary` owner via `correspondence_owners` (+ optional `supporting`).
- Routing sets `primary_owner_id` denormalized on correspondence for fast filters.
- Notifications via `NotificationService::dispatch` on route / deadline / approval / dispatch.

## Immutability

- On incoming **register**: move scan to `registered/` path; set `original_immutable_at`; reject file replace.
- On outgoing **sign**: set `signed_immutable_at`; reject body/file mutation; only dispatch metadata may change.
- Internal notes in `correspondence_notes` with `visibility=internal` — excluded from mail/PDF export payloads.

## Filing (no triplicate copies)

- `correspondence_subject_files` + `correspondence_file_links` link the **same** correspondence id.
- Master Register = chronological query of registered/approved items (no second document store).

## Confidentiality

Classification enum on correspondence. Access if any of:

- system admin / `correspondence.admin` / `correspondence.confidential.view`
- creator, primary/supporting owner, routed-to user
- `general_official` / `internal` visible to `correspondence.view`
- higher classifications require explicit party or confidential permission

Search/list/show/download all go through the same scope.

## Dispatch

`correspondence_dispatches`: channel, dispatched_by, dispatched_at, tracking_ref, delivery_status, delivered_at, evidence_notes/path.  
`send` (email) requires `approved|signed|ready_dispatch` and creates a dispatch row. Physical/courier/hand use same table.

## Permissions added

- `correspondence.registry` — register incoming, allocate refs, file links
- `correspondence.route` — SG routing
- `correspondence.dispatch` — dispatch / delivery evidence
- `correspondence.confidential.view` — restricted content beyond ACL parties

## API surface (additive under `/correspondence`)

- `POST letters/incoming/register`
- `POST letters/{id}/sg-route`
- `POST letters/{id}/acknowledge`
- `POST letters/{id}/owners`
- `POST letters/{id}/notes` / `GET notes`
- `POST letters/{id}/relationships`
- `POST letters/{id}/sign`
- `POST letters/{id}/dispatch` / delivery update
- `POST letters/{id}/void-reference`
- `POST letters/{id}/assignments` (link|create)
- `GET/POST subject-files`, link/unlink
- `GET master-register`, `GET reports/summary`, `GET my-actions`
- `GET/PUT settings/numbering`

## Testing

PHPUnit: unique refs + no reuse after void; SG route requires primary owner; dispatch blocked pre-approval; immutable original/signed; confidentiality hides from unauthorized search; thread relationships.
