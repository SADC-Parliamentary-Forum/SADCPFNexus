# Asset Issuance, Handover and Custody — Overlay PRD (Phase 1)

**System:** SADC PF Nexus  
**Module:** Fixed Assets  
**Document status:** Overlay PRD (does not obsolete 2026-09-14 or 2026-07-27)  
**Saved:** 2026-09-15  

This document overlays the live Fixed Asset Register. It does **not** rebuild the register.

Authoritative prior documents:

- `docs/superpowers/specs/2026-07-27-fixed-asset-register-prd.md`
- `docs/superpowers/specs/2026-07-27-fixed-asset-register-design.md`
- `docs/superpowers/specs/2026-09-14-asset-register-qr-custody-prd.md`

## Problem

Custody was treated as an editable `assigned_to` field. Issuance skipped Available stock: capitalised assets jumped to a person. There was no multi-asset Handover document, no per-item acceptance, no SAAM-signed certificate, and no append-only chain of custody with durations.

## Design principle

**Owner** is always SADC Parliamentary Forum. People, departments, locations, pools and vehicles/facilities are **custodians for a closed period**. UI copy must never say “previous owner”.

Four independent fields:

1. **Asset status** — operational (`pending` → `available` → in service / `loan_out` / lost / stolen / disposed). `assigned` remains a compatibility alias for in-service person custody.
2. **Handover status** — `draft` → `prepared` → `awaiting_acceptance` → `partially_accepted` → `accepted` (exceptions: `disputed`, `cancelled`, `expired`). Returns: `return_initiated` → `returned` → `return_verified`.
3. **Line assignment** — `pending` | `received` | `not_received` | `incorrect_asset` | `condition_different` | `accessories_missing` | `accepted`.
4. **Condition** — existing `condition` plus assessments. Disputes never overwrite the issue-time snapshot.

## Goals (Phase 1)

1. Acquisition lots: one purchase → N numbered **available** store assets; existing tags are never rewritten.
2. Print-all labels on a lot via the existing label service.
3. One Handover engine for issue, transfer and return, with five custody targets.
4. Send reserves assets; custody opens only after per-line accept and (for people) SAAM sign.
5. Partial accept: accepted lines open custody; exception lines return to store; snapshots stay intact.
6. Certificate PDF + custody history with computed durations.
7. Notifications, My Assets action-required, admin needs-attention, Handover Register.
8. ICT clearance blocks while live **or reserved** custody exists.
9. Checkouts remain a separate short-term loan.

## Out of Phase 1

Rapid Scan / scan-basket, Assignment Planner grid, Asset Kits, parent/child systems, annual custody attestation, role equipment templates, room-inventory QR, NFC, delegated collection, paper-fallback issuance.

## Permissions

- `assets.handover.manage` — create/send/cancel/verify returns, acquisition lots, register.
- `assets.handover.accept` — recipient respond + SAAM sign (plus `assets.view` / `profile.read.self` pattern used today).
- **No System Admin bypass** for `assets.financials.view`.
- Public QR payload unchanged (no serial, custodian, finance).

## Success criteria

- Batch of N assets lands in Available store stock with `PF/{CAT}/{SUB}/{SEQ}` numbers.
- Person issue: reserved until sign; unsigned lines do not open custody.
- Partial accept + dispute does not mutate `condition_out`.
- Location/department/pool/vehicle-facility completes without employee SAAM.
- Deactivated/separated users cannot be a new person target.
- Playwright: lot of 2 → print labels → handover → staff accepts 1 / disputes 1.
