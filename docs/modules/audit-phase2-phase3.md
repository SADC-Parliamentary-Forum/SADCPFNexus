# Audit Management — Phase 2 / Phase 3

Extends Phase 1 (`/audit`, `/api/v1/audit-management`).

## Env vars

### Audit AI (Phase 3 — stub default)

| Variable | Default | Notes |
|---|---|---|
| `AUDIT_AI_ENABLED` | `true` | Kill-switch |
| `AUDIT_AI_PROVIDER` | `stub` | `stub` \| `http` |
| `AUDIT_AI_HTTP_URL` | empty | Optional generic HTTP bridge |
| `AUDIT_AI_HTTP_TOKEN` | empty | Bearer from secrets only — never commit |

Hard guards (not overridable): AI never issues findings, assigns blame, approves management responses, closes findings, verifies implementation, determines misconduct, or modifies final conclusions. Human `confirmed=true` required before apply.

### Travel GDS / FX (optional adapters — not a marketplace)

| Variable | Default | Notes |
|---|---|---|
| `TRAVEL_FX_HTTP_URL` | empty | Optional FX HTTP feed |
| `TRAVEL_FX_HTTP_TOKEN` | empty | Secrets only |
| `TRAVEL_GDS_DRIVER` | `null` | `null` \| `disabled` \| `generic_http` |
| `TRAVEL_GDS_HTTP_URL` | empty | Optional itinerary bridge |
| `TRAVEL_GDS_HTTP_TOKEN` | empty | Secrets only |

FX remains wired through `ConfigurableFxRateFeed` into DSA/estimate paths. GDS extends `PracticalAirlineItineraryParser` via `GdsAwareAirlineItineraryParser` for PNR-like refs only.

## Mobile store submission (dry-run)

CI (`.github/workflows/mobile.yml`) stays **secrets-gated**:

- Android Play upload requires `PLAYSTORE_SUBMIT_ENABLED` + `PLAY_STORE_JSON` + signing secrets.
- iOS App Store upload requires `APPSTORE_SUBMIT_ENABLED` + ASC API key secrets.

**Dry-run path (no secrets / do not submit):**

1. Build artifacts only (`flutter build apk` / `ipa` unsigned or local signing).
2. Leave submit flags unset/`false` so workflow prints skip messages and exits 0 without uploading.
3. Never commit `.env`, keystores, or Play/ASC JSON.

## Out of scope

FA/Stock merge · bank GL ownership · FA accounting GL posting · auto-award · all-employee email ingest · AI auto-submit · invented OT rates · paid GDS marketplace · fabricating hours/surveillance rankings · inventing API keys.
