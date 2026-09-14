# Asset Register, QR Identity, Custody & Lifecycle — Gap-Fill PRD

**System:** SADC PF Nexus  
**Module:** Fixed Assets  
**Document status:** Extension PRD (does not obsolete 2026-07-27)  
**Saved:** 2026-09-14  

This document overlays the live Fixed Asset Register. It does **not** rebuild the register. Stock/consumables stay a separate module.

Authoritative prior documents:

- `docs/superpowers/specs/2026-07-27-fixed-asset-register-prd.md`
- `docs/superpowers/specs/2026-07-27-fixed-asset-register-design.md`
- `docs/superpowers/specs/2026-09-07-fixed-asset-categories-labels-design.md`

## Problem

The register, QR tokens, labels, assignment handshake, verification campaigns and depreciation already exist. Remaining gaps:

1. Public labels still showed a hardcoded Windhoek string instead of a versioned Asset Recovery Contact.
2. Physical stickers were not snapshot entities, so contact/custody/location changes could not flag reprints.
3. Public scan UX had no call/email/WhatsApp, lost/stolen/disposed copy, sign-in CTA, or found form.
4. Scan-only users still saw the full module when they had `assets.view`.
5. Numbering, ownership vs funding, and home vs current location were incomplete.
6. Checkouts, two-step transfers, lost/stolen/found incidents, and a first-class timeline were missing.
7. Financial fields leaked to System Admin via bypass even without `assets.financials.view`.
8. ICT clearance on separation did not block while live assets remained assigned.
9. Mobile had no asset QR scan, `/a/{token}` deep link, or offline verification queue.

## Non-goals (unchanged)

GPS/IoT tracking, warehouse ERP, full GL posting, insurance platform, procurement replacement.

## Authoritative live record vs sticker

The QR token identifies the asset. Nexus is authoritative. Physical labels are versioned snapshots and can become stale. Public scan never enumerates sequential IDs and never serialises serial numbers, custodian PII, finance, notes or documents.

```
Phone camera scan → /a/{randomToken} → Next.js public page
  → GET /api/v1/public/assets/{token}  (safe payload + recovery contact)
  → Sign in → GET /api/v1/assets/qr/{token}  (RBAC asset profile)
```

## Requirements implemented in this increment

### Recovery contact and labels

- Tenant-scoped `asset_recovery_contacts` with optional per-category override.
- Immutable `asset_recovery_contact_versions` on every save.
- Permission `assets.settings.recovery_contact.manage`.
- Audit `assets.recovery_contact_changed`.
- `asset_labels` current physical label plus snapshot columns on print batches.
- Contact change flags current labels `reprint_required` / `CONTACT_CHANGED`.
- Public JSON: asset number, short description, organisation, `publicStatus` (`REGISTERED` / `LOST` / `STOLEN` / `DISPOSED`), recovery fields with `show_*` true.
- `POST /api/v1/public/assets/{token}/found` (throttled, no employee PII).

### Master record and numbering

- Subcategories and `PF/{CATEGORY}/{SUBCATEGORY}/{SEQUENCE}` policy for **new** assets only. Existing tags are not rewritten.
- `tag_number` remains the human Asset Number; `asset_code` remains the internal unique code.
- `ownership_type` distinct from funding. Optional `funding_source_id` plus legacy string.
- `home_location_id` retained on move; current `location_id` changes without changing custodian.
- Import mapper columns for the new fields.

### Navigation, RBAC, scan

- `assets.scan` — Scan Asset only.
- `assets.financials.view` (or `finance.admin|approve|export`) required for cost/depreciation/book value. **No System Admin bypass** for those fields.
- `assets.checkout.manage`, `assets.transfer.manage`.
- Web `/assets/scan` and scan-only sidebar landing.
- Dashboard tiles include reprint-required labels and replacement due; financial tiles only when permitted.

### Custody, incidents, timeline

- Checkouts with expected return, accessories, overdue notifications.
- Transfers: initiate → outgoing confirm → incoming accept; admin override audited.
- Incidents: lost / stolen / found / recovered. Stolen police/insurance fields. Public LOST/STOLEN banner.
- Append-only `asset_timeline_events`.
- My Assets: report fault, request transfer, report lost/stolen.

### Maintenance, documents, disposal

- Richer maintenance statuses, quotations, warranty claim flag, condition assessments.
- Warranty alerts 90/30/7 days.
- Polymorphic documents/photos on the asset profile.
- Disposed assets remain resolvable on public scan with inactive copy. No hard delete. No GL journals.

### Verification and reports

- Campaign scope JSON (org / department / location / category / funding).
- QR verify actions: Verified / Wrong location / Wrong custodian / Condition changed / Missing.
- Report pack: category/location/custodian/funding, unassigned, missing labels, reprint, unverified, missing/stolen, warranty, disposal, replacement, valuation (finance-gated).

### Integrations

- Separation ICT clearance blocked while live assets remain assigned (exception path unchanged).
- Outstanding assets widget on the lifecycle case.
- GRN capital/controlled handoff copies supplier, PO, invoice, funding into acquisition fields.

### Replacement and mobile

- Replacement due = useful life elapsed, BER/poor/damaged condition, or `replacement_due_on`.
- Mobile Scan Asset (camera + paste token/URL), drawer SCAN, AppBar SCAN on asset screens.
- Guest `/a/{token}` allowlisted; logged-in uses authenticated QR lookup with public fallback.
- Offline verification queue → campaign results.
- Android intent-filter for `https://nexus.sadcpf.org/a/*`.
- iOS `NSCameraUsageDescription`.
- Associated domains / AASA cannot be published from this repository; host `nexus.sadcpf.org` must serve them separately for universal links.

## Security

- Public endpoints throttled, opaque tokens, no PII/finance.
- Mutations write `AuditLog` `assets.*` with old/new/reason.
- History tables append-only; current custodian/location stay denormalized on `assets`.
