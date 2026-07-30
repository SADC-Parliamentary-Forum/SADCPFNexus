# Document Service / Secure Repository — Phase 1–3

Extends Document Service Phase 1 (`managed_documents` / `document_versions`) to the full Document Uploads & Secure Repository PRD.

## Phase 1 (§122) — landed

- Document master + file objects (content-addressed; never overwrite binaries)
- Attachment / document links (one doc → many links; unlink ≠ delete)
- Secure upload + optional chunked initiate/complete
- MIME/content sniffer + malware scan (Null default; ClamAV / HTTP drivers)
- Failed scan ≠ clean (quarantine blocks download)
- Hashes, private storage, metadata, document types, versioning, locking
- Legal hold / retention metadata / disposal workflow (holds override)
- Physical barcode / location / archive class
- Verify-by-hash (approved metadata only)
- Audit events + backup status hooks
- Cross-module contract via `ModuleDocumentBridge`
- Wired: PIF, Travel, Leave, Procurement (request/contract/GRN), Correspondence, Audit workpapers/evidence

## Phase 2 (§123) — solid slices

- External time-limited shares (watermark flag)
- OCR job queue (null driver completes empty)
- Search / register filters
- Redaction as new derivative version
- Duplicate suggestions by hash
- Bulk rescan
- Retention campaign dashboard
- SharePoint/OneDrive migration utility stub
- Physical/archive update API

## Phase 3 (§124) — guarded stubs

- `POST /documents/{id}/ai-suggest` — suggestion only; hard guards never mutate authoritative state

## Governance (§125)

- `/admin/documents/governance` + `GET/PUT /api/v1/documents/governance`
- All decisions default Pending

## Key URLs

- Admin register: `/admin/documents`
- Retention: `/admin/documents/retention`
- Governance: `/admin/documents/governance`
- Public verify: `/api/v1/documents/public/verify/{hash}`

## Env (no secrets in repo)

```
DOCUMENT_AV_DRIVER=null
# clamav | http
CLAMAV_HOST=127.0.0.1
CLAMAV_PORT=3310
DOCUMENT_AV_HTTP_URL=
DOCUMENT_AV_HTTP_TOKEN=
DOCUMENT_OCR_DRIVER=null
DOCUMENT_BACKUP_HOOK_ENABLED=false
```
