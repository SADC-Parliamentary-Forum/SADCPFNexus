# Travel PRD Closeout — Design

**Date:** 2026-07-26  
**Status:** Implemented on `feat/travel-prd-closeout-2026-07-26`  
**Baseline:** Phases 1–3 live (`62fbdc2` / `fd97a3f` / `f9539db`)  
**PRD:** §§5–6, §15, §22, §43–44, §58, §63–69, §76, §91–92

---

## What this pass closed

| Gap | Delivery |
|-----|----------|
| §91.27 / §§68–69 Leave↔travel conflicts | `TravelConflictService`; submit blocks unless `acknowledge_conflicts`; leave create blocks overlapping approved/submitted travel |
| §63–65 Role dashboards | `GET /travel/dashboards/{traveller,admin,finance}` + web pages |
| §67 Travel calendar | `GET /travel/calendar` + `/travel/calendar` UI |
| §43 Accommodation | `travel_accommodations` + POST API + detail panel |
| §44 Travel pack | ZIP download after booking (`…/travel-pack`) |
| §22 Private mileage | km × rate vs airfare; capped amount; create + detail UI |
| §15 Funding matrix | Payor flags `payor_sadc_pf/host/donor/self` on funding lines |
| §6 Nav children | Approved / Upcoming / Away / Calendar / Admin+Finance dashboards / Imprest deep-link |
| §76 Reports pack | `GET /travel/reports/pack` + reports UI counts |
| scope=mine | List page respects `?scope=mine` |

## Locks retained

- `travel.auto_create_leave_from_travel = false` (hard throw if flipped)
- Finance owns DSA / SoD
- SG booking gate unchanged
- No paid GDS / FX vendor SDKs

## Residual deferred (honest)

- Live budget-reservation / availability engine (§91.13 deep)
- Fully sponsored / donor top-up rules engine beyond payor flags + amounts
- Fleet booking workflow (vehicle Admin sub-flow)
- Push notification UX for every stage event
- Excel/PDF export of every §76 report (JSON pack + register CSV exist)
- Paid airline GDS / travel-agent marketplace
- Live commercial FX terminal SDKs
- Full medical EHR health pack
- Create-form on-behalf picker UI (API already supports `prepared_on_behalf_of`)
- Overdue retirement scheduled reminder job (flag + queue/dashboard counts exist)

## Holiday calendar (§58)

Already provided by platform `/admin/calendar` + `CalendarEntry::TYPE_SADC_HOLIDAY` used by TOIL — not reimplemented.
