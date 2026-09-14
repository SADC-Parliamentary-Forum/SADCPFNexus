# Asset Register QR, custody and lifecycle — design note

**Date:** 2026-09-14  
**Extends:** 2026-07-27 Fixed Asset Register design (not obsolete)

## Decision

Keep existing tables, routes, import pipeline, GRN handoff, depreciation and verification. Add versioned recovery contact, physical label snapshots, numbering policy, checkouts, two-step transfers, incidents, timeline, financial redaction, offboarding gate, and mobile scan.

## Record vs sticker

`qr_token` is opaque (`random_bytes(24)`). Public payload is a safe subset. Printed labels store the contact version, custodian, location and description at print time. Live data can change immediately; labels move to `reprint_required` until reprinted.

## Numbering

Dedicated `asset_numbering_policies` + `asset_number_sequences` (tenant/category/subcategory). Default `PF/{CATEGORY}/{SUBCATEGORY}/{SEQUENCE}`. Issued `tag_number` values never change. Existing imported tags are left as-is.

## Financial segregation

`AssetAccess::canViewFinancials` is `assets.financials.view` or `finance.admin|approve|export`. System Admin does not bypass these fields. Seeded System Admin still sees them only because the role is granted the permission.

## Transfers

Handshake endpoints are usable by the outgoing and incoming custodians. `AssetService::assign()` accepts `skip_manage` so incoming accept does not require `assets.manage`. Overrides still require `assets.manage` plus a reason.

## Mobile deep links

Android: `VIEW` intent-filter for `https://nexus.sadcpf.org/a/`.  
iOS associated domains (`applinks:nexus.sadcpf.org`) and the Apple App Site Association file must be hosted on the public site; they cannot be shipped from this monorepo. Until those files are published, iOS users open `/a/{token}` in the browser or paste the token into Scan Asset.

## Tests

PHPUnit `AssetLifecycleGapfillTest` covers recovery versioning, reprint, public status matrix, numbering + home location, checkout/transfer history, financial redaction, and ICT clearance. Playwright public QR expects Sign in and no custodian/finance leakage. Flutter unit tests cover token parsing and scan-only route access.
