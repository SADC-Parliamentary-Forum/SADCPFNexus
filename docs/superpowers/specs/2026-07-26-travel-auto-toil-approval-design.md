# Auto-TOIL approval (2026-07-26)

**Status:** Implemented  
**Branch:** `feat/travel-auto-toil-approval-2026-07-26`

## Policy (non-negotiable)

- **Never** auto-create Leave credit / LeaveRequest from travel.
- **Auto** means: detect/calculate weekend & public-holiday duty days → create **TOIL candidates** → notify **supervisor + HR**.
- Leave Module credit (`OvertimeAccrual`) happens **only after** supervisor confirms duty **and** HR validates entitlement/OT rules.
- Accrual expiry = `accrual_date + 30 days` (configurable). Secretary General may extend (records approver, new expiry, reason).
- Rejected / OT not authorised → candidate `rejected`, **no** leave credit.

## Flow

```
mark-returned / nightly travel:generate-toil-candidates
        ↓
pending_supervisor  (auto-calc hours; notify traveller + supervisor + HR)
        ↓ confirm-duty (supervisor)
pending_hr          (notify HR again)
        ↓ hr-validate (HR)
credited            (OvertimeAccrual; expires_at = candidate_date + 30d)
        ↓ SG extend (reason required)
extended
        ↓ past expires_at (nightly)
expired

Any open state → reject → rejected (no credit)
```

## Config (`api/config/travel.php`)

| Key | Default | Meaning |
|-----|---------|---------|
| `auto_create_leave_from_travel` | **false** (hard lock) | Must stay false |
| `auto_generate_candidates` | **true** | Auto-create candidates + notify |
| `toil_hours_per_day` | 8.0 | Default hours per non-working duty day |
| `toil_expiry_days` | 30 | Days from accrual date |

Env: `TRAVEL_AUTO_GENERATE_TOIL_CANDIDATES`, `TRAVEL_TOIL_HOURS_PER_DAY`, `TRAVEL_TOIL_EXPIRY_DAYS`.

## API

- `GET /api/v1/travel/toil`
- `POST /api/v1/travel/toil/{id}/confirm-duty` — supervisor
- `POST /api/v1/travel/toil/{id}/hr-validate` — HR credit
- `POST /api/v1/travel/toil/{id}/reject` — `{ reason }`
- `POST /api/v1/travel/toil/{id}/extend` — SG `{ reason` required, `expires_at` optional `}`
- Legacy: `authorise-ot` stamps OT metadata; still requires `confirm-duty` before HR

## UI

- Web queue: `/travel/toil`
- Mobile: Travel TOIL queue (confirm / HR validate / reject)

## Jobs

- `travel:generate-toil-candidates` daily 01:30 — catch-up candidates + expire overdue credited/extended rows.
