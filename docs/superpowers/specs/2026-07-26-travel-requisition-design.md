# Travel Requisition / Official Travel Management — Design

**Date:** 2026-07-26  
**Status:** Locked 2026-07-26 — user Proceed (recommended defaults)  
**PRD:** Full Updated Product Requirements Document (user-supplied, §§1–94, 2026-07-26)  
**System:** SADC PF Nexus  
**Recommended delivery:** **Scope B** — PRD §92 Phase 1 mandatory pack; **extend** existing Travel module (do not rewrite)

**Approval:** User proceeded without overrides → all recommended defaults locked. Do **not** touch Salary Advance or Procurement implementation except documented integration points (PIF → Travel; Imprest link).

---

## Assumptions / Decisions (**Locked 2026-07-26 — user Proceed (recommended defaults)**)

| # | Topic | Decision |
|---|--------|----------|
| 1 | **Delivery scope** | **Scope B** = PRD §92 **Phase 1 — Mandatory** on existing Travel. Phase 2 (§92) deferred (airline parsing, advanced mission dashboards, FX feeds, travel-agent deep integration). |
| 2 | **Backend strategy** | **Extend** `TravelRequest` / `TravelService` / `/travel/*` / attachments / workflow / notifications. **No greenfield** parallel module. |
| 3 | **Salary Advance / Procurement** | **Do not modify** those modules except: (a) PIF `send-to-travel` on Programmes (like existing `send-to-procurement`); (b) optional `travel_request_id` on imprest records. |
| 4 | **One requisition per traveller** | Each `TravelRequest` has exactly one traveller (`requester_id` / `prepared_on_behalf_of` subject). Multi-staff PIF → **N** requisitions. Optional thin **Travel Mission** group links them for logistics (P1 light). |
| 5 | **Workflow (P1)** | Configurable Spatie workflow steps, seeded default: **Supervisor/HOD → Administration → Finance (DSA) → Director Finance → Secretary General**. Bookings/tickets after SG. Legacy dual approve path remains only as fallback when no `ApprovalRequest`. |
| 6 | **Finance owns DSA** | Traveller may enter **estimated** cost hints; authoritative DSA is Finance-only (`rate_type` 1/2/3, meal deductions, terminal/comms). Persist calculation lines + snapshot. Director Finance confirms funds; SG final-approves. |
| 7 | **DSA rate source** | Extend existing `dsa_rates` table into a **versioned DSA Rate Register** (country/city + rate_type + components + effective_from/to). Seed/admin UI under Travel Settings. Open question if Finance prefers NAD-only vs multi-currency — default: currency on rate row (today USD default). |
| 8 | **Attachments by stage** | Expand `TRAVEL_DOCUMENT_TYPES`; enforce **required sets by stage** (submit / admin / post-approve booking / retirement). Missing docs block stage transitions with clear errors. |
| 9 | **Workflow visibility** | Detail header shows **Current Stage / Currently With / Next Stage / timestamps** from `ApprovalRequest` + domain sub-status (e.g. `awaiting_finance_dsa`). “Submitted” alone is insufficient. |
| 10 | **Delegated preparation** | Use existing `PreparedOnBehalf` + `DelegationService` (already on travel columns). Wire create/submit UI; stamp audit; **never** require password sharing. |
| 11 | **PIF → Travel** | New `POST /programmes/{id}/send-to-travel` creates **one draft TravelRequest per selected traveller**, prefills purpose/dates/destination/budget/programme link; copies eligible PIF attachments by reference or clone. PIF does **not** replace Travel Requisition. |
| 12 | **Personal vs official** | Day-level flags on itinerary/calendar days: `official` \| `personal_extension` \| `personal_stopover`. Personal days: no DSA; personal cost fields; acknowledgement required. Indirect/expensive route → `personal_incremental_cost` + justification. |
| 13 | **Class & route** | Default **economy** (except SG / donor override with reason). Soft validation + justification for non-economy / non-most-economical route. Hard block of ticket upload marking “booked/committed” before SG approve unless **emergency** flag + authorised override. |
| 14 | **TOIL** | On approved travel (trigger: return date reached or explicit “mark returned”), generate **TOIL candidates** for weekend/NA holiday (existing calendar) **only**. Never auto-create leave. Credit requires: OT authorised → supervisor confirm duty → HR validate → Leave Module credit with **30-day expiry** (SG extension). Replace “raw LIL list as leave-ready” UX with candidate statuses. |
| 15 | **Imprest / retirement** | Link imprest via optional `travel_request_id`. P1 retirement checklist on travel (mission report + receipts + 5 working-day overdue flag). Full imprest engine stays under Finance/Imprest; Travel owns readiness/accountability status. |
| 16 | **Navigation** | Keep top-level **Travel**. **Add children** mapping PRD §6 (role-filtered). Do not remove `/travel` list. |
| 17 | **Mobile** | P1 **web-first** for new queues/Finance DSA/TOIL validation. Mobile keep create/list/detail; parity follow-up. |
| 18 | **Mission group** | **P1 light:** optional `travel_missions` parent (title, programme_id, dates, destination) + `mission_id` on requests. Advanced readiness dashboard = Phase 2. |
| 19 | **Emergency** | `is_emergency` + reason + authorised_by. May accelerate notifications / allow pre-approval booking **only** when `travel.emergency-commit` (or SG) recorded. Still requires eventual SG ratification. |
| 20 | **Reports** | P1: Travel Register CSV/PDF export + basic status/DSA totals. Advanced analytics = Phase 2. |

---

## 1. Approaches considered

### A — Design + phased plan only
Docs without closing demo gaps. Rejected as sole delivery.

### B — PRD §92 Phase 1 mandatory pack on existing core (**recommended**)
Extend `TravelRequest`, itineraries, attachments, workflow, notifications, leave LIL candidate logic, imprest adjacency, PIF programme APIs. Close honest gaps: persist create-form fields, Finance DSA Rate Types, Director Finance + full chain, stage attachments, workflow tracker, PIF prefill, delegation UI, personal days, economy/route rules, booking gate, retirement link, TOIL candidates (not auto-leave), nav children, PDF/audit/reports.

**Why B:** Module already has CRUD, workflow hooks, attachments API, certificate endpoint, ApprovalTimeline UI, `PreparedOnBehalf` columns, workplan link, and Leave weekend/holiday detection. Rewrite would duplicate auth, audit, notifications, and SAAM. Full PRD §§1–94 (C) includes Phase 2 agent/FX/dashboard depth.

### C — Full PRD §§1–94 in one stream
Every submenu depth, travel-agent parsing, advanced mission dashboards, FX feeds, health packs. High risk of unfinished half-features and regression on working list/create/approve paths.

---

## 2. What already exists vs PRD gaps

### 2.1 Exists (keep / harden)

| Capability | Evidence |
|------------|----------|
| Travel CRUD, submit, approve/reject/return/withdraw/resubmit | `TravelService`, `TravelController`, routes under `api/v1/travel` |
| Itinerary legs (basic) | `travel_itineraries`, `TravelItinerary` |
| Attachments upload/download/delete | `TravelAttachmentController`; web detail upload UI |
| Workflow + ApprovalTimeline | `WorkflowService` module `travel`; web `ApprovalTimeline` on detail |
| Notifications (submit/approve/reject) | `NotificationService` + templates |
| Prepared-on-behalf columns + trait | `PreparedOnBehalf` on `TravelRequest`; `DelegationService` |
| Workplan event link | `workplan_event_id`; calendar sync on approve |
| Certificate / print path | `GET .../certificate`; web certificate page |
| DSA rates **table** (flat rate/day) | migration `dsa_rates` — **no model/API/UI** |
| Leave weekend/holiday candidates from approved travel | `LeaveService::getLilAccrualsFromApprovedTravel` (candidates, `is_verified: false`) |
| Rich **create wizard UI** (funding, vehicle, PIF picker) | `web/app/(app)/travel/create/page.tsx` |
| Mobile travel form/detail | `mobile/.../travel_request_*_screen.dart` |
| Imprest module (separate) | `/imprest`, retirement reminders — **no travel FK** |
| PIF → Procurement pattern to mirror | `ProgrammeService::sendToProcurement` + PIF UI |
| Domain policy reference | `skills/sadc-pf/references/travel.md` |
| Feature + e2e smoke | `TravelRequestTest`, `web/tests/e2e/travel.spec.ts` |

### 2.2 Critical honesty — UI ahead of API

Create form POSTs `host_organization`, `programme_id`, `vehicle_type`, `funding_details`, etc. **`TravelController::store` does not validate or persist them.** Funding/vehicle/PIF linkage are currently cosmetic unless separately stored elsewhere (they are not).

`TravelRequest::$fillable` includes `budget_line_id` but **no travel migration adds that column** (dead field risk).

Workflow seed for travel is **Supervisor → SG only** — missing Admin, Finance DSA, Director Finance.

`show()` does not load `approvalRequest` (timeline may be empty unless client fetches elsewhere).

### 2.3 Gap matrix (honest)

| PRD area | Status | Notes |
|----------|--------|-------|
| §5.1 Attachments by type/stage | **Partial** | API + 5 types; missing invitation/agenda/PIF/donor; no stage gates |
| §5.2 Workflow visibility | **Partial** | Timeline component; no Current With / Next Stage header; status often “Submitted” |
| §5.3 Notifications | **Partial** | Email/in-app for 3 events; missing stage-change richness; push optional later |
| §5.4 Delegated preparation | **Partial** | Columns/trait/delegation infra; travel create/submit UI not wired |
| §5.5 PIF integration | **Missing** | Create UI programme dropdown discarded by API; no `send-to-travel` |
| §5.6 / §§54–57 TOIL | **Partial** | Weekend/holiday detection exists; **no** candidate entity, OT gate, 30-day lapse, HR validation workflow; must not auto-leave (**already does not create leave**) |
| §6 Navigation | **Missing children** | Flat “Travel” link only |
| §§12–14 Traveller / funding / matrix | **Partial** | Form UI only; no persisted funding matrix |
| §§17–18 Attachment rules | **Missing** | Conditional required docs |
| §§21–23 Vehicle | **Partial** | UI only; no persistence / fleet link |
| §§24–29 Itinerary / class / personal days | **Partial** | Legs exist; no class, route economy, personal flags |
| §§30–37 Finance DSA / Director Finance / budget | **Missing** | `estimated_dsa` traveller-owned; no Rate Types; no Director Finance step |
| §38–40 SG + visibility | **Partial** | SG in seed; conditions/booking gate thin |
| §§41 Notifications depth | **Partial** | |
| §§42–53 Booking / changes / retirement | **Missing / Partial** | Ticket types exist; amendments/retirement not travel-owned |
| §61 Mission group | **Missing** | Recommend P1 light |
| §85 Permissions | **Partial** | `travel.view/create/approve/admin` only |
| §92 Phase 2 items | **Deferred** | By design |

### 2.4 Demo items (§5) — Phase 1 must close

1. Attachments (types + stage rules) — **must ship**.  
2. Workflow visibility (holder/stage/next) — **must ship**.  
3. Notifications on stage transitions — **must ship** (email + in-app).  
4. Delegated preparation without password sharing — **must wire**.  
5. PIF prefill — **must ship**.  
6. TOIL candidates only (never auto-leave) + OT/HR path — **must ship** (harden existing detector).

---

## 3. Navigation (PRD §6 vs Sidebar)

**Today:** single item `Travel` → `/travel` (no children). Imprest lives under Finance.

**Phase 1 (extend, do not remove working routes):**

| Child | Route | Audience |
|-------|-------|----------|
| Travel Dashboard | `/travel` (enhance) | All with `travel.view*` |
| New Travel Requisition | `/travel/create` | create |
| My Travel Requests | `/travel?scope=mine` | traveller |
| Pending My Approval | `/travel/queues/approval` | recommend/approve roles |
| Administration / Logistics Queue | `/travel/queues/admin` | admin-review |
| Finance Review Queue | `/travel/queues/finance` | finance-review |
| Director Finance Queue | `/travel/queues/director-finance` | director-finance-confirm |
| Approved / Upcoming / Away | `/travel/register` filters or dedicated | view-all |
| Travel Advances / Imprest | deep-link `/imprest?linked=travel` + travel detail panel | manage-imprest |
| Travel Retirement | `/travel/queues/retirement` | review-retirement |
| Potential Leave-in-Lieu | `/travel/toil` | review-toil / HR |
| Travel Register | `/travel/register` | view-all / export |
| Reports | `/travel/reports` | export |
| Travel Settings | `/travel/settings` | travel.admin (DSA register) |

Itinerary Changes: P1 as filter/status on detail + register (not separate heavy module). Mission group: `/travel/missions` optional light list if P1 light ships.

---

## 4. Target architecture (Phase 1)

```
PIF (approved) ──send-to-travel──► TravelRequest (1 per traveller)
                                      │
                                      ├─ funding_lines[] / vehicle
                                      ├─ itinerary legs + personal day flags
                                      ├─ attachments (typed, stage-gated)
                                      ├─ optional travel_mission_id
                                      │
Workflow: HOD → Admin → Finance DSA → Dir Finance → SG
                                      │
                         (post-SG) bookings / tickets
                                      │
                         Imprest (optional FK) → retirement checklist
                                      │
                         TOIL candidates → OT auth → HR → Leave credit (30d)
```

**Ownership:** Travel owns authorisation, logistics record, DSA calculation snapshot, document pack, amendment history, TOIL **candidates**. Leave owns balances/leave requests. PIF owns programme authority. Imprest/Finance owns advances & GL. Budget module remains fund authority; Director Finance confirmation is the travel-side funds gate (reservation or confirmation record — mirror Procurement pattern lightly).

---

## 5. Phase 1 design units

### D1 — Persist request core (close UI/API gap)

- Migration: `programme_id`, `host_organization`, funding JSON or `travel_funding_lines`, vehicle fields, `cabin_class`, `route_justification`, `personal_incremental_cost`, `budget_line_id` (real FK), domain `lifecycle_status` / finance fields, `mission_id` nullable, emergency fields.
- Align `TravelController` + `TravelService` create/update with create wizard.
- Load `approvalRequest.workflow.steps` + history on `show`.

### D2 — Workflow chain + visibility

- Reseed/update travel workflow: Supervisor → Administration role → Finance Controller (or Project Accountant) → Director Finance → SG.
- Domain sub-statuses for Finance calculation / Dir Finance confirm / post-approve booking.
- Detail UI: Current Stage / Currently With / Next Stage / Expected Action (PRD §40).
- Separation of duties: no self Finance DSA / self SG; Admin cannot write DSA without Finance role.

### D3 — Attachments by stage

- Expand types: invitation, agenda, concept_note, approved_pif, itinerary, flight_ticket, travel_insurance, visa_copy, hotel_booking, donor_correspondence, funding_confirmation, mission_report, receipt, other.
- Config map: required for `submit`, `admin_complete`, `mark_booked`, `retire`.
- Block transitions with PRD-style messages.

### D4 — PIF → Travel

- `ProgrammeService::sendToTravel` + route + PIF UI (mirror procurement send).
- Prefill; one requisition per traveller; optional attach to mission group.
- Copy/link PIF attachments of relevant types.

### D5 — Delegated preparation

- Accept `prepared_on_behalf_of` on create when active delegation / `travel.prepare-for-others`.
- Stamp prepared_by; show banner on detail; audit.

### D6 — Finance DSA (Rate Types 1/2/3)

- Extend `dsa_rates` (+ model, CRUD settings, effective dating, rate_type, meal component fields).
- Finance-only endpoints: calculate day lines, meal deductions, terminal/comms, sponsorship top-up flags.
- Persist `travel_dsa_lines` + totals; lock traveller from editing after Finance saves.
- Variance warning if claimed days ≠ itinerary official days.

### D7 — Budget / Director Finance / SG / no premature commitment

- Director Finance confirmation record (funds available + remarks).
- SG approve/reject/return/approve-with-conditions.
- Block `booking_committed` / ticket as financial commitment before SG unless emergency override audited.
- Economy default + justification for exceptions.

### D8 — Personal vs official days & route

- Day classification on date span or itinerary metadata.
- Personal days excluded from DSA; acknowledgement checkbox.
- Indirect/expensive route: official vs personal cost split.

### D9 — Vehicle (P1)

- Persist vehicle request fields; Admin confirm; optional link to assets later (no deep fleet rewrite).

### D10 — Amendments

- Post-approve material changes → amendment draft requiring re-approval of affected steps; preserve original approval snapshot.

### D11 — Retirement + imprest link

- `travel_request_id` on imprest (nullable).
- Travel retirement status + overdue (5 working days after return).
- Block new travel advance when prior linked imprest unretired (reuse imprest rule where possible).

### D12 — TOIL candidates (policy lock)

- Table `travel_toil_candidates` (fields per PRD §57).
- Generate from approved travel non-working days (reuse holiday calendar + weekend logic).
- Statuses: `candidate` → `ot_authorised` → `duty_confirmed` → `hr_validated` → `credited` \| `rejected` \| `lapsed`.
- On `hr_validated`/`credited`: create Leave LIL accrual **via Leave module API/service** with `expires_at = accrual + 30 days`; SG extension updates expiry.
- **Never** auto-create `LeaveRequest`.
- Deprecate presenting unverified travel dates as ready LIL hours without candidate gate (keep read-only “potential” list behind candidate statuses).

### D13 — Nav, PDF, audit, reports, permissions

- Sidebar children (§3).
- Harden Travel PDF (Parts A–D).
- Audit events per PRD §84 (map to `AuditLog::record`).
- Register export.
- Expand permissions toward PRD §85 (map to roles in seeder; avoid breaking existing `travel.*`).

### D14 — Explicitly out of Phase 1

- Automatic airline itinerary parsing; travel-agent booking APIs; advanced mission readiness dashboard; advanced analytics; automatic FX feeds; full health/medical pack; mobile parity for all new queues.

---

## 6. Data / API deltas (Phase 1 summary)

| Change | Notes |
|--------|-------|
| `travel_requests` columns | programme, host, class, route/personal costs, finance totals, confirmation stamps, emergency, mission_id, retirement fields, booking gate |
| `travel_funding_lines` | item, forum/host/agency amounts, budget refs |
| `travel_missions` | optional light group |
| `dsa_rates` extend | rate_type, components, effective dates, versioning |
| `travel_dsa_lines` | day-by-day Finance calculation |
| `travel_toil_candidates` | candidate workflow |
| `imprest_requests.travel_request_id` | nullable FK |
| Attachments types + stage config | |
| Workflow seed | 5-step travel chain |
| Programme `send-to-travel` | |
| Permissions | granular travel.* |
| Web queues + settings + TOIL | |
| Notifications | stage triggers |

---

## 7. Testing strategy (Phase 1)

- Feature: create persistence (funding/vehicle/PIF), delegation, workflow steps, DSA Rate Types + meal deduct, Dir Finance gate, SG booking gate, emergency override, amendment, retirement overdue, TOIL candidate ≠ leave, OT required before credit, 30-day lapse, permission SoD, PIF send-to-travel.
- E2E: create → attach invitation/agenda → approve chain smoke → finance DSA UI → workflow tracker visible → TOIL candidate list.
- Do not regress existing `TravelRequestTest` happy paths; update expectations for new workflow seed.

---

## 8. Spec self-review

- No TBD left for Phase 1 locks; open questions listed in §9 for user Proceed.  
- Scope focused on §92 Phase 1; Phase 2 deferred.  
- Contradictions avoided: Finance owns DSA; TOIL never auto-leave; PIF feeds but does not replace Travel; one traveller per requisition.  
- Extend existing — no parallel module.

---

## 9. Locked answers (was open questions)

| # | Topic | Locked decision |
|---|--------|-----------------|
| 1 | **DSA rate source** | Extend existing `dsa_rates` with Rate Types 1/2/3 + Finance-owned calculation API/UI (traveller `estimated_dsa` is estimate only). |
| 2 | **TOIL generation trigger** | Generate on **mark-returned + nightly**; never auto-create leave; require OT authorisation → supervisor confirm → HR validate → Leave credit + **30-day** expiry unless SG extends. |
| 3 | **Default TOIL hours** | **8 hours** per candidate day (`config('travel.toil_hours_per_day')`). |
| 4 | **Mission group in P1** | **Light Travel Mission** group (group logistics; one requisition per traveller). |
| 5 | **Finance workflow role** | **Finance Controller** / role with `travel.finance-review` once seeded (not Project Accountant). |
| 6 | **Emergency commit** | **SG-only** audited emergency exception (no silent bypass). |
| 7 | **Imprest↔travel FK** | **Optional** link in P1 (do not block on full imprest rewrite). |

---

## 10. Next step

**Proceed received.** Implement Phase 1 plan  
`docs/superpowers/plans/2026-07-26-travel-phase1.md`.
