# Asset Issuance, Handover and Custody — Overlay Design (Phase 1)

**Saved:** 2026-09-15  
**Companion PRD:** `2026-09-15-asset-issuance-handover-prd.md`

## Architecture

Keep `assets` as the live register. Add **Acquisition Batches** (one purchase → N assets) and **Handovers** (one transaction → many lines).

`AssetService::assign()` and `AssetTransferService` remain **internal adapters** called from the handover engine (with `skip_handshake` after SAAM). Direct `POST /assets/{asset}/assign|transfer|return` stay for the legacy handshake; the web UI routes new issuance through `/assets/handovers`. Checkouts stay a separate short-term loan.

E-sign reuses `SaamService::recordSignatureEvent`. Timeline stays append-only via `AssetTimelineService`. Label print delegates to `AssetLabelService`. Numbering reuses `AssetNumberingService::issue()`.

## Data model

### `asset_acquisition_batches`

`reference` (`BATCH-{year}-{seq}`), description, qty, unit_cost, currency, supplier, purchase_order_id, goods_receipt_note_id, invoice_number, funding_source_id, received_date, category/subcategory, `home_location_id`, status `draft|received|assets_created|closed`.

### `asset_acquisition_batch_items`

Links created `asset_id`s; inherit PO/invoice/funding/supplier onto each asset.

### `asset_handovers`

`reference` (`HO-{year}-{seq}`), `type` (`issue|transfer|return`), `custody_target_type` (`person|department|location|pool|vehicle_facility`), from/to user/department/location (and optional `to_asset_id` for vehicle/facility), status, timestamps, `declaration_version`, `signature_event_id`, `expires_at`, reminder stamps, `certificate_path`.

### `asset_handover_lines`

Asset + **immutable issue snapshot** (tag, name, serial, condition_out, accessories JSON, photo ids, notes). `line_status`, `recipient_response`, `dispute_notes`, `condition_in` (returns). Disputes never mutate the snapshot.

### `asset_handover_declaration_versions`

Immutable statement text + version key so the signed pack records which wording was shown.

### Custody periods (`asset_assignment_histories`)

Add `custodian_type`, department/location FKs, `handover_id` / `handover_line_id`, `ended_at`. Keep `assigned_to`. Duration is computed in the API.

### `assets`

`acquisition_batch_id`, `reserved_handover_id` (blocks a second issue). First-class `available` after batch create when no person. Default store custodian: `custodian_type=location`, `assigned_to` null, home/current location = Main Store.

## Behaviour

### Lots

`POST /asset-batches` then `POST …/create-assets` issues N numbers, generates QR tokens, copies purchase fields. `POST …/print-labels` → existing label print. Progress: received / created / labels printed / assigned / still available. GRN accept creates or attaches a batch around the pending rows.

### Handover engine

- **Person** — send → reserve + notify → per-line respond → Sign & Accept (SAAM) → custody opens only for accepted lines.
- **Department / Location / Pool / Vehicle-facility** — Asset Manager confirms placement on send; no employee signature.
- **Issue** store → target. **Transfer** current custodian → new target (optional `asset_transfers` side-effect). **Return** person → Administration; manager verifies; assets `available`.
- Partial accept: accepted lines open custody; exceptions unreserve to store + admin task.
- Deactivated/separated users cannot be a new person target.

### Evidence

On Sign & Accept: authenticated user, declaration version, timestamp, accepted line ids, optional drawn signature, auth_level `password` (MFA if already required). Device/session: IP + user-agent on `signature_events`. PDF certificate on the handover.

### Timeline

`BATCH_CREATED`, `ASSETS_CREATED`, `LABEL_PRINTED`, `HANDOVER_SENT`, `HANDOVER_LINE_*`, `HANDOVER_SIGNED`, `CUSTODY_OPENED`, `CUSTODY_CLOSED`.

### Notifications

`assets.handover.awaiting_acceptance`, reminder, supervisor after tenant-configurable days (default 0/2/5/7).

### Scan (authenticated)

Return allowed actions from asset state + permissions (`start_handover`, transfer, checkout, return, verify, print). No continuous camera basket.

## API

Versioned under `/api/v1`:

- `GET|POST /asset-batches`, `POST /asset-batches/{batch}/create-assets`, `POST …/print-labels`, `GET /asset-batches/{batch}`
- `GET|POST /asset-handovers`, `POST …/{id}/lines`, `POST …/send`, `POST …/cancel`
- `POST …/lines/{line}/respond`, `POST …/sign`
- `GET …/certificate`, `GET /assets/{asset}/custody-history`, `GET /assets/handovers/register`

## Web

- Hub + sidebar: Handovers, Acquisition lots
- `/assets/handovers`, `/assets/handovers/[id]`, `/assets/batches`
- My Assets: pending handovers with **per-item** actions (not Accept All)
- Asset profile: Owner (SADC PF) / Custody history / Lifecycle
- Copy: “in the custody of”, never “owned by {person}”
