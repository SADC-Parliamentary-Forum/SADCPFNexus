# Asset Phase 2 operations — design

**Date:** 2026-09-16  
**Branch:** `cursor/remaining-work-build-all-5911`

## Assumptions

- Operator UAT, secrets, governance rows, restore drills, and staging IDOR stay unsigned.
- Explicit OOS stays OOS (FA↔stock GL merge, auto-award, full mobile parity, collapsing 135 UX IA tickets).
- Phase 1 handover/lots remain the issuance engine. Phase 2 adds operational overlays only.
- No System Admin bypass of `assets.financials.view`.
- Custody still opens to the intended custodian, never “owned by” a person.

## Scope

1. Rapid scan basket (camera/manual/NFC) → start a draft handover.
2. Parent/child assets and named kits.
3. Role equipment templates + gap view.
4. Annual custody attestation campaigns.
5. Assignment planner slots that create **draft** handovers only.
6. Room inventory QR/NFC.
7. Delegated collection (delegate may sign; custody opens to recipient).
8. Paper-fallback issuance (manager records a paper receipt; not silent auto-accept).

## Out of scope

Live NFC hardware drivers, GPS/IoT, warehouse ERP, GL posting, extra sidebar flood (hub cards + two children).
