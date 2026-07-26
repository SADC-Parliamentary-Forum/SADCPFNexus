# Travel Phase 2 — Design

**Date:** 2026-07-26  
**Status:** Locked — implement after Phase 1 live at `62fbdc2`  
**PRD:** §92 Phase 2 + Phase 1 deferrals  
**Baseline:** `feat/travel-phase2-2026-07-26` from `main` @ `62fbdc2`  
**System:** SADC PF Nexus — extend existing Travel module (no rewrite)

**Approval:** User said **Proceed to next** after Travel Phase 1 go-live.

---

## Assumptions / Decisions (Locked)

| # | Topic | Decision |
|---|--------|----------|
| 1 | **Delivery scope** | Coherent Phase 2 pack: Finance DSA panel, mission readiness, visa reminders, PDF Parts A–D, mobile Finance/TOIL parity, richer tests, light analytics, optional airline/FX stubs only. |
| 2 | **Backend strategy** | Extend Phase 1 `TravelRequest` / services / routes. Additive migration only. |
| 3 | **Salary Advance / Procurement** | Do not modify except documented integration points already shipped (PIF → Travel; imprest FK). |
| 4 | **TOIL** | Candidates only — never auto-create leave. Mobile confirm/reject uses existing TOIL APIs. |
| 5 | **Finance owns DSA** | Rate Types 1/2/3; SoD (not own request). Detail panel calls existing `POST …/dsa`. |
| 6 | **Workflow** | HOD → Admin → Finance → Dir Finance → SG unchanged. |
| 7 | **Booking** | No booking commitment before SG except audited emergency. |
| 8 | **Class / costs** | Economy default; personal vs official costs respected in DSA lines. |
| 9 | **Mission readiness** | Build on P1 `travel_missions` + attachments (`flight_ticket`, `visa_copy`, `hotel_booking`) + `finance_status` / DSA totals. |
| 10 | **Visa** | Add status + expiry/appointment fields on `travel_requests`; scheduled reminder notifications. |
| 11 | **PDF** | DomPDF Parts A–D aligned to Form structure (traveller / itinerary / DSA / funding+signatories). |
| 12 | **Analytics** | Light aggregates: cost by programme / funding agency when funding lines exist. |
| 13 | **Airline / FX** | Interfaces + null stubs only — no fake paid external APIs. |
| 14 | **Mobile** | Read finance queue + TOIL candidate confirm/reject paths; no auto-leave. |

---

## Approaches

### A — Docs only
Rejected — Phase 1 is live; user Proceed to next.

### B — Coherent Phase 2 slice on existing core (**chosen**)
Ship the deferred §92 pack as one mergeable stream with PHPUnit coverage and deploy.

### C — Full agent/FX/health depth
Rejected — stubs only for airline/FX; no paid integrations.

---

## API surface (Phase 2)

| Endpoint | Purpose |
|----------|---------|
| Existing `POST /travel/requests/{id}/dsa` | Unchanged — wired in detail UI |
| `GET /travel/missions` | List missions |
| `GET /travel/missions/{id}` | Mission + readiness matrix |
| `GET /travel/analytics/summary` | Light cost/status aggregates |
| `GET /travel/requests/{id}/pdf` | DomPDF Parts A–D download |
| `PATCH /travel/requests/{id}/visa` | Update visa status/dates |
| `GET /travel/visa-reminders` | Due/expiring visa watchlist |
| Existing TOIL endpoints | Mobile parity consumers |
| Stubs | `AirlineItineraryParserInterface`, `FxRateFeedInterface` (null implementations) |

---

## UI paths

| Path | Audience |
|------|----------|
| `/travel/[id]` — Finance DSA panel | finance-review |
| `/travel/missions`, `/travel/missions/[id]` | travel.view* |
| `/travel/reports` — analytics cards | export / view-all |
| `/travel/[id]/certificate` + PDF download | certificate viewers |
| Mobile: finance queue + TOIL list/actions | finance-review / review-toil |

---

## Explicitly deferred (later)

- Live airline itinerary parsing / travel-agent booking APIs  
- Live FX rate provider integrations  
- Full health/medical pack  
- Deep travel-agent marketplace  

---

## Risks

- PDF DomPDF must not break JSON `certificate` endpoint (keep both).  
- Visa reminders must not spam — one notification per threshold per request.  
- Mobile TOIL must never call leave-create APIs.
