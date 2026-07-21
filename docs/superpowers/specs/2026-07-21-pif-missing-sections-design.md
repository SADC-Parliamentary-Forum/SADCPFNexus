# PIF Module Completion — Design

## Context

The Programme Implementation Form (PIF), implemented as the `Programme` model/module, is the activity-level request-and-approval form for SADC PF Nexus. A code audit against the PRD found that while the PIF's workflow, notifications, delegation, attachments, and approval machinery are fully implemented, the `programmes` schema is missing most of the PRD's form sections (Sections C–N below), and the M&E and Procurement connection points are either free-text or entirely disconnected.

This spec was revised after the user supplied a full, detailed PIF Module PRD (Sections 1–21) superseding the earlier lighter-weight version of this spec. It closes the gap end to end: schema, model, API, permissions, and the web PIF forms — while keeping the PIF itself simple and strictly separate from the M&E module, which remains its own menu item and owns all reporting/indicator/evidence logic.

**Two design decisions were revised from the original draft of this spec, driven by explicit new requirements:**

1. **Documentation (§8.7) and Arrival/Departure (§8.10) become real child tables**, not JSON array columns. The PRD requires each row to have "its own stable record identifier" and requires attachments to "link to the document record, not merely to a document title" (§17.3: *"Module links must not depend on mutable text such as document titles"*). A JSON array element has no queryable, FK-able identity, so this uses the same child-table pattern already established 5× elsewhere on `Programme` (`ProgrammeActivity`, `ProgrammeMilestone`, `ProgrammeDeliverable`, `ProgrammeBudgetLine`, `ProgrammeProcurementItem`).
2. **Procurement linkage is now in scope.** §8.11 and §12.2 require a real `linked_procurement_request` reference and the ability to transfer approved PIF procurement items into the Procurement module. `ProgrammeProcurementItem` already exists — this spec adds the FK and the transfer action rather than deferring it.

**Still explicitly out of scope** (per PRD §20 and unchanged from the original deferral):
- Converting `strategic_alignment`/`strategic_pillars` to FK-backed cascading dropdowns sourced from M&E's Strategic Plan configuration.
- Any change to the M&E module's own indicators, results frameworks, evidence validation, or reporting logic — M&E only *reads* approved PIF data and *writes back* a linkage/status pointer.
- Budget Module's own ledger, commitments, and variance reporting (Budget remains authoritative; PIF only reads budget lines and displays what Finance sets).
- Travel, leave-in-lieu, supplier evaluation, RFQ evaluation, purchase orders, payroll/salary advance — all explicitly out of scope per PRD §20.

## Product Principle (from PRD §2–3)

The PIF is an activity-level request, costing, logistical-planning, and approval form — one PIF per activity, owned by the Programme/Requesting Officer. It is not the M&E module, not a procurement/budget system of record, and not a post-activity reporting tool. After approval, its data becomes available to M&E, Procurement, Budget, and Travel, but those modules remain authoritative for their own specialised workflows.

## Architecture

One migration adds the new flat/simple columns to `programmes` (Sections C, D, E, F, H, M, N below). Two new child tables — `programme_documents` and `programme_arrival_departures` — replace what would otherwise be JSON blobs, each with a real auto-increment `id`, matching the existing `Programme` child-table pattern. `Attachment`'s existing generic `MorphTo attachable` relation (no hardcoded allowlist of target models — confirmed in `app/Models/Attachment.php`) lets attachments polymorphically target a specific `ProgrammeDocument` row directly, satisfying the "not merely a title" requirement with zero changes to `Attachment` itself beyond a new `PIF_DOCUMENT_TYPES` constant.

`ProgrammeProcurementItem` gains a nullable `procurement_request_id` FK plus `currency` and `rfq_required` columns, and a new service action creates/links a real `ProcurementRequest` from selected approved items.

Section D (Budget) fields `budget_availability_status` and `finance_comments` are **not** editable via the general `ProgrammeController::update()` — they're gated behind a separate authorization check (new `programme.finance-review` permission), enforcing PRD §8.4/§13.3's "Programme Officers must not edit Finance-only fields" at the API layer, not just the UI layer.

Section N (Declaration and Submission) is a submit-time gate, not a draft-time field: five boolean confirmations plus a timestamp, captured only when `submit()` is called, not editable afterward.

Section 11's read-only M&E status block reads `MeActivityReport.status` (existing values: `Not Submitted`, `Submitted for M&E Review`, `Returned for Correction`, `M&E Reviewed`, `Accepted`, `Closed`) through a small mapping function into the PRD's stated PIF-facing labels (`Not Yet Linked`, `Reporting Record Created`, `Report Pending`, `Report Submitted`, `Returned for Correction`, `M&E Reviewed`, `Closed`) — this spec does not touch the M&E module's own status enum, only how the PIF displays it.

## Data Model

### New columns on `programmes` (all nullable unless noted)

**Section C — Venue**
`venue_country`, `venue_city`, `venue_proposed_hotel` string; `venue_accommodation_required` boolean; `venue_accommodation_count` integer; `venue_conferencing_required` boolean; `venue_conferencing_participants` integer; `venue_quotation_attached` boolean; `venue_hotel_quotation_attached` boolean; `venue_accessibility_requirements`, `venue_security_considerations`, `venue_comments` text.

**Section D — Budget and Participant Provisions**
`proposed_dsa_rate`, `original_budget_rate` decimal(10,2); `dsa_variance_reason` text; `proposed_participants`, `budgeted_participants` integer; `participants_variance_reason` text; `proposed_funding_difference` decimal(15,2); `estimated_activity_amount` decimal(15,2); `budget_availability_status` string, enum: `not_checked` / `available` / `partially_available` / `unavailable` / `confirmed_with_conditions`, default `not_checked`; `finance_comments` text. (`primary_currency`/`budget_line`/`funding_source` already exist on `Programme`.)

**Section E — Consultants and Support Personnel**
Per category (`secretariat_staff`, `consultants`, `resource_persons`, `rapporteurs`, `media_liaison`, `local_support`): `{category}_required` boolean, `{category}_count` integer, and `{category}_rate` decimal(10,2) for the categories with rates (consultants, resource_persons, rapporteurs, local_support). `personnel_comments` text.

**Section F — Interpretation and Languages**
`interpretation_required` boolean; per pair (`en_fr`, `en_pt`, `fr_pt`): `{pair}_required` boolean, `{pair}_interpreters_count` integer; `interpreter_rate` decimal(10,2); `interpreter_source` string enum: `internal`/`supplier`/`partner`/`other` (+ `interpreter_source_other_note` when `other`); `interpretation_equipment_required` boolean; `translation_required` boolean; `languages_required` json array of strings; `interpretation_comments` text.

**Section H — Support Services Required**
`support_services` json array of selected keys (`ground_transport`, `air_travel`, `interpretation_equipment`, `zoom_hybrid`, `audio_recording`, `video_recording`, `live_streaming`, `data_projector`, `conference_bags`, `regalia`, `report_newsletter`, `ict_support`, `comms_support`, `procurement_support`, `finance_support`, `admin_support`, `research_support`, `other`); `support_services_other_note` text (required when `other` selected).

**Section M — Conflict of Interest**
`conflict_declared` boolean; `conflict_details`, `conflict_mitigation` text; `conflict_declared_by` foreignId → `users`, nullable; `conflict_declared_at` datetime, nullable. Required-when-declared rules enforced at validation (see API section).

**Section N — Declaration and Submission** (captured at submit time only)
`declaration_info_accurate`, `declaration_documentation_complete`, `declaration_single_activity_confirmed`, `declaration_conflict_disclosed`, `declaration_funding_estimate_acknowledged` — five booleans; `declaration_confirmed_at` datetime.

**Section 11.4 — M&E Linkage Summary** (read-only from the PIF's own endpoints; unchanged from the earlier draft of this spec)
`me_classification_required` boolean; `me_activity_report_id` foreignId → `me_activity_reports`, nullable, writable only by M&E-side endpoints; `me_planned_output` text; `me_planned_target` string, nullable; `me_indicator_id` foreignId → `indicators`, nullable, writable only by M&E-side endpoints; `me_reporting_category` string. No stored status column — see mapping function above.

### New table: `programme_documents` (Section G)

`id`, `programme_id` foreignId, `title` string, `document_type` string, `word_count` integer nullable, `translation_required` boolean, `source_language` string nullable, `target_languages` json array of strings, `owner` string (or `owner_user_id` foreignId → `users`, nullable — see open question below), `deadline` date nullable, `budget_line` string nullable, `comments` text nullable, timestamps, soft deletes. Model `ProgrammeDocument belongsTo Programme`, `hasMany` via `Programme::documents()`. Attachments target it via `attachable_type = ProgrammeDocument::class`.

### New table: `programme_arrival_departures` (Section J)

`id`, `programme_id` foreignId, `category` string (participant/secretariat/rapporteur/consultant/resource_person/media_liaison/expert/ict_support/interpreter/local_support/other), `arrival_date` date nullable, `departure_date` date nullable, `airport` string nullable, `flight_details` text nullable, `transport_required` boolean, `accommodation_required` boolean, `comments` text nullable, timestamps, soft deletes. Model `ProgrammeArrivalDeparture belongsTo Programme`, `hasMany` via `Programme::arrivalDepartures()`. Validation: `departure_date` must not be before `arrival_date`.

### Changes to `ProgrammeProcurementItem` (Section K)

Add `procurement_request_id` foreignId → `procurement_requests`, nullable (set only by the transfer action, never directly editable); `currency` string; `rfq_required` boolean. `linked_procurement_request` is exposed in API responses as the related `ProcurementRequest`'s summary (reference number, status), read-only.

### Model changes (`app/Models/Programme.php`)

- Extend `$fillable`/`$casts` with all new flat columns above.
- New relations: `documents()` hasMany `ProgrammeDocument`, `arrivalDepartures()` hasMany `ProgrammeArrivalDeparture`, `conflictDeclaredBy()` belongsTo `User`, `meActivityReport()` belongsTo `MeActivityReport`, `meIndicator()` belongsTo `Indicator`.
- Accessor `getMeStatusAttribute()` — implements the status-label mapping described above, returning `not_yet_linked` when `me_activity_report_id` is null, otherwise the mapped label from `meActivityReport->status`, degrading to `not_yet_linked` if the linked record is unresolvable (soft-deleted, etc.).

## API Changes

`ProgrammeController::store()`/`update()` validation is extended with rules for all new flat fields, following existing conventions. Key conditional/cross-field rules (mirroring PRD conditional-behaviour requirements):

```php
'venue_accommodation_count'  => ['required_if:venue_accommodation_required,true', 'nullable', 'integer', 'min:0'],
'venue_conferencing_participants' => ['required_if:venue_conferencing_required,true', 'nullable', 'integer', 'min:0'],
'conflict_details'    => ['required_if:conflict_declared,true', 'nullable', 'string'],
'conflict_mitigation' => ['required_if:conflict_declared,true', 'nullable', 'string'],
'support_services_other_note' => ['required_if:support_services,other', 'nullable', 'string'],
'interpreter_source_other_note' => ['required_if:interpreter_source,other', 'nullable', 'string'],
```

`conflict_declared_by`/`conflict_declared_at` are set server-side from the authenticated user, never accepted from the request payload — matching PRD §8.13 "another user must not overwrite the requester's declaration."

`budget_availability_status` and `finance_comments` are **excluded** from the standard `update()` validation entirely and instead handled by a new `ProgrammeController::updateFinanceReview()` endpoint gated by `$this->authorize('finance-review', $programme)` (new policy method backed by a `programme.finance-review` permission) — this is the API-layer enforcement of PRD §13.3, not just a hidden/disabled UI field.

`me_activity_report_id`/`me_indicator_id` remain excluded from the PIF's own `store()`/`update()`, unchanged from the earlier draft — only M&E-side endpoints write them.

**New nested endpoints** (matching the existing `ProgrammeBudgetLine`/`ProgrammeProcurementItem` nested-resource pattern):
- `POST/PUT/DELETE /programmes/{programme}/documents/{document?}` → `ProgrammeDocumentController`
- `POST/PUT/DELETE /programmes/{programme}/arrival-departures/{row?}` → `ProgrammeArrivalDepartureController`
- `POST /programmes/{programme}/procurement-items/{item}/send-to-procurement` → creates/links a `ProcurementRequest` from that item, sets `procurement_request_id`, only callable once the `Programme` is approved (guards against pre-approval procurement creation).

**Submission endpoint** (`ProgrammeController::submit()`) now requires the five `declaration_*` booleans to all be `true` in the request payload (or already true if resubmitting), rejecting with a validation error naming which confirmation is missing, and stamps `declaration_confirmed_at = now()`.

## Frontend Changes

`web/app/(app)/pif/create/page.tsx` and `web/app/(app)/pif/[id]/edit/page.tsx` gain sections C through N as collapsible accordion sections, following the existing pattern in those files, with conditional field visibility exactly as specified in PRD §15.2 (e.g., interpretation details hidden until `interpretation_required` is checked, venue/accommodation fields hidden for `activity_format = virtual`). Documents and Arrival/Departure become proper repeatable-row sub-forms backed by the new nested endpoints (add/edit/remove per row, with each row's real database `id` used for edit/delete rather than array index). Section D's `budget_availability_status`/`finance_comments` render as **read-only** for non-Finance users and as editable only for users with the `programme.finance-review` permission (matching a pattern that should already exist for other permission-gated fields elsewhere in the app — reuse rather than invent). Section N renders as a final confirmation checklist immediately before the Submit action, blocking submission client-side until all five boxes are checked, in addition to the server-side enforcement.

`web/app/(app)/pif/[id]/page.tsx` (view page) gets matching read-only display blocks for all sections, the workflow tracker (already exists per the audit), and the read-only M&E status block (§11.4) showing the mapped status label and a link to the linked M&E record when permitted.

## Permissions

New permission: `programme.finance-review` (controls editing `budget_availability_status`/`finance_comments`), assigned to Finance/Project Accountant/Director Finance roles in the seeder. All other new fields follow the existing `Programme` authorization already in place (requester edits own drafts, approvers act on pending-with-them records, auditors get read-only). M&E-side write access to `me_activity_report_id`/`me_indicator_id` continues to be governed by the existing `mande.admin` permission on the M&E controllers, not by anything new here.

## Audit Trail

New audit events, following the existing `AuditLog::record()` call pattern already used ~182 times across the codebase: `programme.document_added`, `programme.document_removed`, `programme.arrival_departure_added`, `programme.arrival_departure_removed`, `programme.conflict_declared`, `programme.conflict_amended`, `programme.finance_review_updated`, `programme.procurement_item_sent_to_procurement`, `programme.declaration_confirmed`.

## Error Handling

Standard Laravel validation errors throughout, consistent with existing PIF fields. Specific cases: (1) a broken/soft-deleted `MeActivityReport` link degrades the status accessor to `not_yet_linked` rather than throwing; (2) `send-to-procurement` on an item that already has a `procurement_request_id` returns a 409 rather than creating a duplicate; (3) attempting to edit `budget_availability_status`/`finance_comments` without the `programme.finance-review` permission returns 403, not a silent no-op, so the UI can surface a clear message.

## Testing

**Backend**: feature tests for `ProgrammeController` covering the new flat-field validation (including all `required_if` conditional rules), `ProgrammeDocumentController`/`ProgrammeArrivalDepartureController` CRUD, the finance-review permission gate (403 for non-Finance, 200 for Finance), the `send-to-procurement` action (success, duplicate-guard, pre-approval-guard), the declaration gate on `submit()`, and the `me_status` accessor mapping (all six mapped states plus `not_yet_linked`/unresolvable). Regression tests confirm existing workflow, notifications, delegation, attachments, approvals, and audit logging are unaffected (per PRD §19).

**Frontend**: Playwright coverage (via `sadcpf-playwright-e2e` conventions) for: happy-path creation through all sections, conditional section show/hide behavior, repeatable-row add/edit/remove for documents and arrival/departure, the declaration checklist blocking submission until complete, and the read-only rendering of Finance-only and M&E-linkage fields for a non-privileged user. No existing PIF e2e suite was found in the codebase (pre-existing gap, not fully backfilled by this spec).

## Acceptance Criteria

Adopting PRD §18 directly as the acceptance criteria for this spec:
- One PIF per activity; requester auto-captured and visible throughout; one Responsible Officer, multiple Supporting Officers; delegated preparation recorded; draft save and submit both work.
- Venue, Budget, Personnel, Interpretation/Documentation, Support Services, Arrival/Departure, and Conflict of Interest sections all behave per §18.2–§18.8, including all conditional-visibility and required-when-declared rules.
- Workflow tracker shows current holder, stage, and full history (§18.9) — already implemented, unaffected by this spec.
- M&E connection: no editable M&E fields appear in create/edit; approved PIFs appear in the M&E intake queue (existing M&E-side mechanism, unaffected); M&E cannot edit the approved PIF; the PIF shows the read-only, non-duplicated M&E status (§18.10).
- Full PIF PDF/exports include all completed sections and approval history (§18.11) — PDF/Excel export generation itself is flagged as a separate pre-existing gap (`ReportsController` has no PDF/Excel path today); this spec ensures the new fields are *available* to be included once that export capability exists, but does not build PDF/Excel generation itself.
- Regression: existing workflows, notifications, delegations, attachments, approvals, and audit logs continue to work unchanged.

## Open Question for Implementation

PRD §8.7 lists "Document owner" as a field but doesn't specify whether it's a free-text name or a `User` reference. Given the rest of the PIF consistently uses real `User` FKs for accountable roles (Responsible Officer, Supporting Officers, Conflict declarant), the plan defaults to `owner_user_id` (nullable FK → `users`) for consistency — flagging here rather than silently deciding, since it's a real judgment call the implementer should confirm against how the frontend team wants to render the picker.
