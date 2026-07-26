# Travel Phase 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship PRD §92 Phase 2 deferred pack on existing Travel after Phase 1 (`62fbdc2`).  
**Architecture:** Extend Travel services/controllers/models; additive migration for visa fields; DomPDF blade; web missions + DSA panel + analytics; mobile finance/TOIL read+action screens; PHPUnit Phase 2 suite.  
**Tech stack:** Laravel API, Next.js web, Flutter mobile, DomPDF, PHPUnit.  
**Branch:** `feat/travel-phase2-2026-07-26`

---

## Task 1: Docs + migration (visa fields)

**Files:**
- Create: `docs/superpowers/specs/2026-07-26-travel-phase2-design.md`
- Create: `docs/superpowers/plans/2026-07-26-travel-phase2.md`
- Create: `api/database/migrations/2026_07_26_140001_travel_phase2_visa_and_readiness.php`

Columns on `travel_requests`: `visa_status` (nullable string), `visa_required` (bool default false), `visa_expiry_date`, `visa_appointment_date`, `visa_notes`, `visa_last_reminded_at`.

---

## Task 2: Mission readiness + analytics services (TDD)

**Files:**
- Create: `api/app/Modules/Travel/Services/TravelMissionService.php`
- Create: `api/app/Modules/Travel/Services/TravelAnalyticsService.php`
- Create: `api/tests/Feature/Travel/TravelPhase2Test.php`

Readiness per traveller: tickets (`flight_ticket`), visa (`visa_copy` OR status not_required/approved), hotel (`hotel_booking`), DSA (`finance_status` in dsa_calculated|confirmed OR finance_dsa_total set).

Analytics: counts by status; sum `finance_dsa_total`/`estimated_dsa` by `programme_id` and funding agency.

---

## Task 3: Visa reminders (TDD)

**Files:**
- Create: `api/app/Modules/Travel/Services/TravelVisaReminderService.php`
- Create: `api/app/Console/Commands/TravelSendVisaReminders.php`
- Schedule in `api/routes/console.php`
- Wire notification key `travel.visa_reminder`

Thresholds: appointment within 7 days; expiry within 30 days; status `pending`/`appointment_scheduled`.

---

## Task 4: PDF Parts A–D (TDD)

**Files:**
- Create: `api/resources/views/pdf/travel_authorisation_parts_ad.blade.php`
- Add `TravelService::authorisationPdf()` or dedicated helper
- Add `GET travel/requests/{id}/pdf` on controller

Parts: A traveller/purpose/dates; B itinerary; C DSA lines; D funding + approval history.

---

## Task 5: API routes + controller methods

Wire missions list/show, analytics summary, visa patch, visa reminders index, pdf download. Keep certificate JSON.

---

## Task 6: Web — DSA panel, missions, reports, certificate

- Detail page Finance DSA calc panel (`saveDsa`)
- `/travel/missions` + `/travel/missions/[id]` readiness
- `/travel/reports` analytics
- Certificate page Parts A–D headings + PDF download link
- Sidebar: Missions child

---

## Task 7: Mobile Finance/TOIL parity

- Finance queue screen (list `queue=finance`)
- TOIL candidates screen (list + authorise/confirm/reject/hr-validate as permitted)
- Router + dashboard/nav links
- Never create leave

---

## Task 8: Airline/FX stubs

- `AirlineItineraryParserInterface` + `NullAirlineItineraryParser`
- `FxRateFeedInterface` + `NullFxRateFeed`
- Bind in `AppServiceProvider` or Travel provider

---

## Task 9: Verify, commit, merge, deploy

- PHPUnit Travel Phase 2 (+ Phase 1 smoke)
- Commit (exclude `.ship-safe/context.json`, `.claude/settings.json`)
- Push → merge main → deploy `sadcpf-nexus-prod` → `/up`

---

## Completion note (2026-07-26 — Phase 2 stream)

Shipped on `feat/travel-phase2-2026-07-26` after Phase 1 live at `62fbdc2`.

**Done:** Finance DSA panel; mission readiness; visa fields/reminders; DomPDF Parts A–D; analytics summary; mobile finance/TOIL queues; airline/FX null stubs; `TravelPhase2Test` (6) + Phase 1 regression green.

**Deferred:** Live airline parsing, live FX feeds, full health pack, travel-agent marketplace.

## Completion note (2026-07-26 � Phase 2 stream)

Shipped on `feat/travel-phase2-2026-07-26` after Phase 1 live at `62fbdc2`.

**Done:** Finance DSA panel; mission readiness; visa fields/reminders; DomPDF Parts A�D; analytics summary; mobile finance/TOIL queues; airline/FX null stubs; TravelPhase2Test (6) + Phase 1 regression green.

**Deferred:** Live airline parsing, live FX feeds, full health pack, travel-agent marketplace.
