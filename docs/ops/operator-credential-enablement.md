# Operator credential enablement checklist

Secrets stay in **server env** (or GitHub Secrets for CI). The Admin → System Settings → **Operator credentials** panel only shows configured / not-configured status — never secret values.

## Integrations

| Integration | Env / notes | Admin UI |
|-------------|-------------|----------|
| Correspondence IMAP | `CORRESPONDENCE_IMAP_PASSWORD` (+ host/user in mailbox settings). Requires PHP `ext-imap`. | `/correspondence/mailbox` + status on `/admin/settings` |
| Fleet telematics | `FLEET_TELEMATICS_DRIVER`, `FLEET_TELEMATICS_API_KEY`, optional `FLEET_TELEMATICS_WEBHOOK_TOKEN` | Fleet vehicle GPS panel + `/admin/settings` |
| Weekly AI | `WEEKLY_AI_PROVIDER=llm`, `WEEKLY_AI_LLM_ENDPOINT`, `WEEKLY_AI_LLM_API_KEY` | Status only |
| Procurement AI | `PROCUREMENT_AI_COMPARISON_*` | Status only |
| M&E AI | `MANDE_AI_PROVIDER`, `MANDE_AI_LLM_*` | Status only |
| Payroll vendor | `PAYROLL_VENDOR_DRIVER`, `PAYROLL_VENDOR_HTTP_URL`, `PAYROLL_VENDOR_API_KEY` | Status only |
| Google Calendar | `GOOGLE_CALENDAR_CLIENT_ID/SECRET`, `GOOGLE_CALENDAR_REFRESH_TOKEN` **or** `GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON`, optional `GOOGLE_CALENDAR_WEBHOOK_SECRET`, `GOOGLE_CALENDAR_ID` | Assignments calendar-feed + `/admin/settings` |

## Leave workflow modes
HR Managers set mode under `/leave/settings`:
- `standard` — HOD recommend → HR certify → SG
- `finance_first` — Finance → HR → SG (aligns with salary-advance Finance-first pattern)
- `director_principal` — HOD → HR → Director → SG

## Commands
- `php artisan assignments:sync-google-calendar` — two-way sync (no-op when credentials absent)
- Webhook: `POST /api/v1/assignments/google-calendar/webhook` with `X-Goog-Channel-Token`

## API
- `GET /api/v1/admin/operator-credentials` — System Admin only

See `api/.env.example` for the full commented list.
