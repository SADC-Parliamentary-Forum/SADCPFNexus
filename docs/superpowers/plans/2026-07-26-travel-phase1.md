# Travel Requisition Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Locked 2026-07-26 — user Proceed (recommended defaults)  
**Spec:** `docs/superpowers/specs/2026-07-26-travel-requisition-design.md`  
**PRD:** §§1–94; Phase 1 priority §92; demo locks §5 + §93  

**Locked decisions (Proceed, no overrides):** DSA Types 1/2/3 on `dsa_rates` + Finance-owned calc; TOIL on mark-returned + nightly (candidates only, 8h/day, 30-day expiry); Light Travel Mission; Finance Controller for DSA step; SG-only emergency commit; optional imprest FK; workflow HOD/Supervisor → Admin → Finance DSA → Director Finance → SG.

**Goal:** Close PRD §92 Phase 1 mandatory gaps on the existing Travel module (persist create-form fields, PIF prefill, stage attachments, full approval chain with Finance DSA Rate Types 1/2/3 + Director Finance, workflow tracker, notifications, delegation, personal/official split, economy/route + no premature booking, amendments, retirement/imprest link, TOIL candidates only, nav/PDF/audit/reports) without rewriting working list/create/approve paths.

**Architecture:** Extend `api/app/Modules/Travel`, `TravelRequest` / itineraries / attachments, Spatie workflow seed, Programme `send-to-travel`, Leave TOIL candidate table (credit via Leave), optional imprest FK. Web `/travel/*` queues + settings. Mobile web-first for new queues.

**Tech Stack:** Laravel (API), Next.js App Router (web), existing WorkflowService / NotificationService / DelegationService / AuditLog / DomPDF patterns. **Do not modify Salary Advance or Procurement feature code** (PIF Programme service + Imprest FK only as integration points).

I'm using the writing-plans skill to create this implementation plan.

---

## File map (Phase 1)

| Area | Create / Modify |
|------|-----------------|
| Request schema | Migration(s) on `travel_requests`; `travel_funding_lines`; optional `travel_missions` |
| DSA register | Extend `dsa_rates`; model `DsaRate`; `travel_dsa_lines` |
| TOIL | `travel_toil_candidates`; service methods; Leave credit handoff |
| Imprest link | Migration `imprest_requests.travel_request_id` |
| Services | `TravelService`, new `TravelDsaService`, `TravelToilService`; `ProgrammeService::sendToTravel` |
| Controllers / routes | Travel + attachments + programme send-to-travel; settings |
| Workflow | `WorkflowSeeder` travel steps; permissions seeder |
| Config | `api/config/travel.php` (attachment stage rules, economy default, retirement days, TOIL hours/expiry) |
| Web | create persist; detail tracker; queues; settings; TOIL; Sidebar children; PIF send UI; `web/lib/api.ts` |
| PDF / audit | Certificate/PDF + AuditLog events |
| Tests | Extend `TravelRequestTest`; new feature tests; e2e smoke |
| Mobile | Touch only if API contract breaks form payload |

---

### Task 1: Config + failing tests for core locks

**Files:**
- Create: `api/config/travel.php`
- Create: `api/tests/Feature/Travel/TravelPhase1PolicyTest.php`

- [ ] **Step 1: Write failing policy assertions**

```php
public function test_travel_config_locks(): void
{
    $this->assertSame('economy', config('travel.default_cabin_class'));
    $this->assertSame(5, config('travel.retirement_working_days'));
    $this->assertSame(8.0, (float) config('travel.toil_hours_per_day'));
    $this->assertSame(30, config('travel.toil_expiry_days'));
    $this->assertFalse(config('travel.auto_create_leave_from_travel'));
}
```

- [ ] **Step 2: Add `api/config/travel.php`**

```php
return [
    'default_cabin_class' => env('TRAVEL_DEFAULT_CABIN', 'economy'),
    'retirement_working_days' => 5,
    'toil_hours_per_day' => 8.0,
    'toil_expiry_days' => 30,
    'auto_create_leave_from_travel' => false,
    'attachment_requirements' => [
        'submit' => ['invitation', 'agenda'], // PIF-linked adds approved_pif via programme_id
        'admin_complete' => ['travel_itinerary'],
        'mark_booked' => ['flight_ticket'], // hotel/visa/insurance conditional flags
        'retire' => ['mission_report'],
    ],
];
```

- [ ] **Step 3: Run test — expect FAIL then PASS after config exists**

```bash
cd api && php artisan test --filter=TravelPhase1PolicyTest
```

- [ ] **Step 4: Commit** when user asked

---

### Task 2: Schema — travel request enrichment + funding lines + mission (light)

**Files:**
- Create: `api/database/migrations/2026_07_26_100001_travel_phase1_core_schema.php`
- Modify: `api/app/Models/TravelRequest.php`
- Create: `api/app/Models/TravelFundingLine.php`
- Create: `api/app/Models/TravelMission.php` (if mission light locked in)

- [ ] **Step 1: Failing test — create persists programme/funding/vehicle**

```php
public function test_create_persists_pif_funding_and_vehicle(): void
{
    // POST with programme_id, funding_details[], vehicle_type, cabin_class
    // assert DB rows + JSON response
}
```

- [ ] **Step 2: Migration**

Add to `travel_requests` (guarded `Schema::hasColumn`):  
`programme_id`, `host_organization`, `budget_line_id`, `cabin_class` default economy, `route_is_most_economical` bool, `route_justification`, `personal_incremental_cost`, `personal_cost_acknowledged_at`, `vehicle_type`, `driver_required`, `driver_name`, `finance_status`, `director_finance_confirmed_at/by`, `booking_committed_at`, `is_emergency`, `emergency_reason`, `emergency_authorised_by`, `mission_id`, `returned_at`, `retirement_status`, `retirement_due_at`, official/personal day JSON or rely on day table.

Create `travel_funding_lines` (travel_request_id, item, forum_amount, host_amount, funding_agency, project, budget_line, sort_order).

Optional: `travel_missions` (tenant_id, title, programme_id, destination_country, start_date, end_date).

- [ ] **Step 3: Update model fillable/relations/casts**

- [ ] **Step 4: Wire `TravelController::store/update` validation + `TravelService::create/update`**

Persist itineraries + funding lines; ignore unknown Salary Advance fields.

- [ ] **Step 5: `show` loads `approvalRequest.workflow.steps`, `approvalRequest.history.user`, `fundingLines`, `programme`, `attachments` summary**

- [ ] **Step 6: Run tests**

```bash
cd api && php artisan test --filter=TravelRequestTest
cd api && php artisan test --filter=test_create_persists_pif_funding_and_vehicle
```

---

### Task 3: Attachment types + stage gates

**Files:**
- Modify: `api/app/Models/Attachment.php` (`TRAVEL_DOCUMENT_TYPES`)
- Modify: `web/lib/api.ts` `TRAVEL_DOCUMENT_TYPES`
- Modify: `TravelService` submit / admin / book / retire methods
- Test: `TravelAttachmentStageTest.php`

- [ ] **Step 1: Failing test — submit without invitation/agenda → 422**

- [ ] **Step 2: Expand document types** to include invitation, agenda, concept_note, approved_pif, donor_correspondence, funding_confirmation, mission_report, receipt (keep existing).

- [ ] **Step 3: Helper `assertAttachmentsForStage(TravelRequest $t, string $stage)`

- [ ] **Step 4: Call from submit and later stage transitions**

- [ ] **Step 5: Web upload dropdown lists new types; show missing-required checklist on detail**

---

### Task 4: Workflow seed + visibility + permissions

**Files:**
- Modify: `api/database/seeders/WorkflowSeeder.php`
- Modify: `api/database/seeders/RolesAndPermissionsSeeder.php` (+ migration grant if pattern used)
- Modify: `web/app/(app)/travel/[id]/page.tsx`
- Modify: `TravelController::show` (already loading approval)

- [ ] **Step 1: Failing test — initiate travel workflow has ≥5 steps including Finance + SG**

- [ ] **Step 2: Seed steps**

```php
// supervisor → Administration Officer role → Finance Controller → Director → Secretary General
```

Use existing role names in DB; if Director Finance role missing, map to closest (`Director` / `Finance Controller`) and document in Travel Settings copy — **lock on Proceed answers**.

- [ ] **Step 3: Detail header UI**

Show Current Stage, Currently With (from pending step assignees), Next Stage, Submitted On.

- [ ] **Step 4: Add permissions** (additive): `travel.prepare-for-others`, `travel.recommend`, `travel.admin-review`, `travel.finance-review`, `travel.director-finance-confirm`, `travel.final-approve`, `travel.review-retirement`, `travel.review-toil`, `travel.export` — map onto roles; keep legacy `travel.approve` working.

- [ ] **Step 5: SoD tests — requester cannot approve own; non-Finance cannot PATCH DSA**

---

### Task 5: Delegated preparation UI + API

**Files:**
- Modify: `TravelController::store`, `TravelService::create`
- Modify: `web/app/(app)/travel/create/page.tsx`
- Test: extend `DelegationWorkflowTest` or `TravelDelegationTest`

- [ ] **Step 1: Failing test — delegate creates request with prepared_on_behalf_of = principal**

- [ ] **Step 2: Call `DelegationService` validation; set `prepared_by`, `prepared_on_behalf_of`, `requester_id` = traveller subject

- [ ] **Step 3: UI: “Prepare on behalf of” user picker when permitted

- [ ] **Step 4: Detail banner: “Prepared on behalf of X by Y”

---

### Task 6: PIF send-to-travel

**Files:**
- Modify: `api/app/Modules/Programmes/Services/ProgrammeService.php`
- Modify: `ProgrammeController` + `api/routes/api.php`
- Modify: `web/app/(app)/pif/[id]/page.tsx`
- Modify: `web/lib/api.ts`
- Test: `ProgrammeTravelTransferTest.php`

- [ ] **Step 1: Failing test — approved programme + traveller ids → N draft TravelRequests**

- [ ] **Step 2: Implement `sendToTravel(Programme $p, array $data, User $user)`**

Prefill purpose, dates, destination, programme_id, budget_line_id if present; optional `mission_id`; clone/link attachments.

- [ ] **Step 3: PIF UI button “Send to Travel” (do not remove Send to Procurement)

- [ ] **Step 4: One requisition per traveller — assert count**

---

### Task 7: DSA Rate Register + Finance calculation

**Files:**
- Migration extend `dsa_rates` + create `travel_dsa_lines`
- Create: `api/app/Models/DsaRate.php`, `TravelDsaLine.php`
- Create: `api/app/Modules/Travel/Services/TravelDsaService.php`
- Routes under `travel/dsa-rates` (admin) + `travel/requests/{id}/dsa`
- Web: Finance queue + calculation panel; Settings rates CRUD
- Test: `TravelDsaCalculationTest.php`

- [ ] **Step 1: Failing tests — Rate Type 1/2/3 totals; meal deduction; personal days excluded**

- [ ] **Step 2: Schema**

`dsa_rates`: add `rate_type` (1|2|3), `accommodation_component`, `meal_component`, `incidentals_component`, `effective_from`, `effective_to`, `version`.

`travel_dsa_lines`: date, destination, rate_type, daily_rate, adjustments, daily_payable, is_personal (false for payable).

- [ ] **Step 3: Finance-only `calculate` / `save` endpoints**

Traveller `estimated_dsa` remains estimate; `actual_dsa` / totals set by Finance.

- [ ] **Step 4: Variance warning when official day count ≠ lines**

- [ ] **Step 5: UI only for `travel.finance-review`**

---

### Task 8: Director Finance confirm + booking gate + economy/route

**Files:**
- Modify: `TravelService`
- Routes: `confirm-funds`, `mark-booked`
- Web detail actions
- Test: `TravelCommitmentGateTest.php`

- [ ] **Step 1: Failing test — markBooked before SG approve → 422**

- [ ] **Step 2: Failing test — emergency override with authorised_by succeeds + audit**

- [ ] **Step 3: Director Finance confirm endpoint stamps confirmation; required before SG final (or as workflow step action)

- [ ] **Step 4: Default cabin_class economy; non-economy requires justification**

- [ ] **Step 5: Personal day flags exclude DSA in TravelDsaService**

---

### Task 9: Amendments (controlled)

**Files:**
- Migration: `travel_amendments` or status `amendment_draft` + snapshot JSON on approve
- Service methods createAmendment / submitAmendment
- Test: `TravelAmendmentTest.php`

- [ ] **Step 1: Failing test — changing dates after approve requires amendment workflow; original snapshot preserved**

- [ ] **Step 2: Implement minimal amendment: clone proposed fields; block silent update when status=approved**

- [ ] **Step 3: UI “Request amendment” on approved detail**

---

### Task 10: Retirement + imprest link

**Files:**
- Migration: `imprest_requests.travel_request_id` nullable
- Modify: `ImprestRequest` model + create validation optional link
- Travel retirement fields + queue UI
- Test: `TravelRetirementTest.php`

- [ ] **Step 1: Failing test — retirement_due_at = return_date + 5 working days; overdue flag**

- [ ] **Step 2: markReturned sets returned_at + due date; require mission_report attachment to complete retirement**

- [ ] **Step 3: Optional link imprest; document integration — do not rewrite imprest retire engine**

- [ ] **Step 4: Queue page `/travel/queues/retirement`**

---

### Task 11: TOIL candidates (never auto-leave)

**Files:**
- Create: migration + `TravelToilCandidate` model
- Create: `TravelToilService`
- Modify: `LeaveService::getLilAccrualsFromApprovedTravel` to read **validated/credited** candidates only for leave linking (or keep potentials separate endpoint)
- Web: `/travel/toil`
- Test: `TravelToilCandidateTest.php`

- [ ] **Step 1: Failing test — generate candidates for weekend/holiday; assert no LeaveRequest created**

- [ ] **Step 2: Failing test — credit without OT authorised → 422**

- [ ] **Step 3: Failing test — after HR validate, LIL accrual exists with expires_at = +30 days**

- [ ] **Step 4: Implement generate on `markReturned` + scheduled command catch-up**

- [ ] **Step 5: Status transitions + SG extend expiry endpoint**

- [ ] **Step 6: UI list with validate/reject; copy: “Travel date ≠ automatic TOIL”**

---

### Task 12: Notifications depth

**Files:**
- Modify: `NotificationService` / `NotificationTemplateController` seeds
- Dispatch on: admin start, finance required, dir finance, SG, returned, booked, retirement due, TOIL candidate

- [ ] **Step 1: Add trigger keys + templates**

- [ ] **Step 2: Wire dispatches in service methods**

- [ ] **Step 3: Feature assert notification rows or fake mail**

---

### Task 13: Nav, register, reports, PDF, audit

**Files:**
- Modify: `web/components/layout/Sidebar.tsx` — Travel children per design §3
- Create queue/register/settings/toil/report pages (thin wrappers over filtered list + actions)
- Harden certificate/PDF Parts A–D with DSA lines
- AuditLog events for key transitions
- Test: register export endpoint if added

- [ ] **Step 1: Sidebar children (role-filtered like other menus)**

- [ ] **Step 2: `/travel/settings` DSA rates admin**

- [ ] **Step 3: `/travel/register` + CSV export**

- [ ] **Step 4: PDF includes funding + DSA table + approval history**

- [ ] **Step 5: E2E smoke update `web/tests/e2e/travel.spec.ts` for tracker text / create persistence**

---

### Task 14: Regression + acceptance checklist

- [ ] **Step 1: Run full Travel + Leave LIL + Programme transfer tests**

```bash
cd api && php artisan test --filter=Travel
cd api && php artisan test --filter=Leave
cd api && php artisan test --filter=ProgrammeTravel
```

- [ ] **Step 2: Manual UAT against PRD §91 items 1–30 (Phase 1 depth)**

- [ ] **Step 3: Confirm Salary Advance & Procurement untouched (`git diff` exclude programmes send-to-travel + imprest FK)**

- [ ] **Step 4: Commit stream** only when user requests

---

## Deferred to Phase 2 (§92)

- Travel-agent integration / airline itinerary parsing  
- Advanced visa reminder engine  
- Advanced mission-group readiness dashboards  
- Advanced travel analytics  
- Automatic FX rate feeds  
- Full mobile parity for Finance/TOIL queues  

---

## Open questions — **resolved Locked 2026-07-26**

See design §9 locked answers. Implementation uses recommended defaults throughout.
