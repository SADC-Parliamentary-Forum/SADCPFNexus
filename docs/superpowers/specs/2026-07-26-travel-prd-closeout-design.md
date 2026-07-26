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

~~Previous residuals closed in Module finish 2026-07-26 (see below).~~

## Module finish 2026-07-26

**Branch:** `feat/travel-module-finish-2026-07-26`  
**Closes residual backlog after PRD closeout (`4a2d1b9` / docs `e80ee2b`).**

| Residual | Delivery |
|----------|----------|
| Live budget reservation | `TravelBudgetReservationService` — reserve on SG `onWorkflowApproved`; release on `cancel`; extends `budget_reservations` with `travel_request_id` |
| Sponsored / top-up rules | `travel_sponsored_deduction_rates` policy table; Finance DSA `buildDefaultLines` applies %/fixed from policy; Settings UI CRUD |
| Fleet booking sub-flow | Thin Admin assign via Assets (`category=fleet`) + overlap conflict warn (`TravelVehicleService`) |
| Create on-behalf picker | `/travel/travellers` + create form picker when `travel.prepare-for-others`; Prepared by / Traveller on review |
| Overdue retirement cron | `travel:mark-overdue-retirements` daily 08:10 — marks `overdue`, notifies traveller + finance; due-soon nudges |
| Notifications polish | Templates + fires: return-for-correction, finance DSA, retirement due/overdue, cancelled, TOIL candidate |
| Reports pack completeness | §76 slices + CSV export (`/travel/reports/pack/export?slice=…`) |
| Personal day editor | PATCH `/personal-days` + detail UI official/personal toggles |
| Imprest deep-link | POST `/link-imprest` creates draft with `travel_request_id`; detail CTA → `/imprest/{id}` |

### Still deferred / impossible (unchanged locks)

- Paid GDS / airline booking APIs
- Paid FX vendor SDKs with embedded keys
- Full medical EHR
- Travel-agent marketplace
- Auto-create leave/TOIL (candidates only)
- Weaken SG booking gate / Finance DSA SoD

### Holiday calendar (§58)

Already provided by platform `/admin/calendar` + `CalendarEntry::TYPE_SADC_HOLIDAY` used by TOIL — not reimplemented.
