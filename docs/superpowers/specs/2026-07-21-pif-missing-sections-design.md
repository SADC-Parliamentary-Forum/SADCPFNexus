# PIF Module Completion — Design

## Context

The Programme Implementation Form (PIF), implemented as the `Programme` model/module, is the activity-level request-and-approval form for SADC PF Nexus. A code audit against the PRD found the PIF's workflow, notifications, delegation, attachments, and approval machinery fully implemented, but the `programmes` schema missing most of the PRD's form sections, and the M&E/Procurement connection points either free-text or disconnected.

This is the **third revision** of this spec. The first added 7 sections as JSON/flat columns. The second (after the full PIF Module PRD was supplied) switched Documentation/Arrival-Departure to child tables and added procurement linkage. This revision responds to a detailed review that approved the overall direction but required 10 specific changes before implementation, all incorporated below. Each change was verified against the actual codebase before being written in — not applied blindly.

**Still explicitly out of scope** (unchanged): converting `strategic_alignment`/`strategic_pillars` to FK-backed cascading dropdowns; any change to M&E's own indicators/results-frameworks/evidence-validation logic; Budget Module's own ledger/commitments; Travel, leave-in-lieu, supplier evaluation, RFQ evaluation, purchase orders, payroll/salary advance.

## Product Principle

The PIF is an activity-level request, costing, logistical-planning, and approval form — one PIF per activity. It is not the M&E module, not a procurement/budget system of record, and not a post-activity reporting tool. After approval, its data becomes available to M&E, Procurement, Budget, and Travel, but those modules remain authoritative for their own specialised workflows.

## Architecture

One migration adds new flat columns to `programmes` for Sections C (Venue), D (Budget/Participant Provisions), E (Consultants), F (Interpretation), H (Support Services), M (Conflict of Interest), plus a single simplified declaration block and self-referential amendment tracking. Two new child tables — `programme_documents` and `programme_arrival_departures` — give repeatable rows real, stable, auto-increment IDs, matching the existing `ProgrammeBudgetLine`/`ProgrammeProcurementItem`/`ProgrammeActivity`/`ProgrammeMilestone`/`ProgrammeDeliverable` pattern exactly (verified: each is a simple `HasFactory` model with `belongsTo(Programme::class)`, a matching migration, a controller that validates then delegates to `ProgrammeService`, and routes registered as `Route::apiResource('{programme}/x', XController::class)->only(['store','update','destroy'])`).

**Critically, no M&E-owned data is stored on `programmes` at all.** `MeActivityReport` already has `programme_id` (verified: `app/Models/MeActivityReport.php:35,68-71`, `belongsTo(Programme::class, 'programme_id')`, uses `SoftDeletes`, and its real status field is `review_status` with constants `not_submitted`/`submitted`/`returned`/`reviewed`/`accepted`/`closed`, plus a separate `closure_status`). `Programme` gets a `meActivityReport()` `hasOne(MeActivityReport::class, 'programme_id')` relation and reads through it — nothing is duplicated or cached on the PIF side.

`ProgrammeProcurementItem` gains a nullable `procurement_request_id` FK, plus `currency` and `rfq_required` columns. A programme-level batch action creates one `ProcurementRequest` (with one `ProcurementItem` row per transferred item — verified `ProcurementItem` is `{procurement_request_id, description, quantity, unit, estimated_unit_price, total_price}`) rather than one request per item.

## Data Model

### 1. No M&E fields on `programmes` (Revision 1)

Removed entirely from this spec: `me_classification_required`, `me_activity_report_id`, `me_planned_output`, `me_planned_target`, `me_indicator_id`, `me_reporting_category`. None of these are added to `programmes`. `Programme::meActivityReport()` is the only connection point, and it is a relationship, not a stored field:

```php
public function meActivityReport(): HasOne
{
    return $this->hasOne(MeActivityReport::class, 'programme_id');
}
```

### 2. M&E intake — verified, not assumed (Revision 2)

An intake mechanism **already exists**: `MeActivityReportController::linkablePifs()` (`app/Http/Controllers/Api/V1/MAndE/MeActivityReportController.php:56-83`, routed at `GET /mande/pif-linkages`) lists approved programmes with a `has_report` flag, and `MeActivityReportController::store()` already creates a report linked by `programme_id`. What's genuinely missing, confirmed by reading `ProgrammeService::approve()`: **no notification is dispatched on approval to either the Responsible Officer or M&E**. This spec adds that dispatch (see Notifications below) and adds an `unlinked=true` query filter to `linkablePifs()` so the M&E queue view can show only what still needs a report, rather than requiring client-side filtering of the full approved list.

### 3. Draft-first creation (Revision 3)

Adopted the recommended approach. A new PIF is no longer built entirely in frontend state and submitted atomically. Instead:
- The frontend's `pif/create` page, on mount, immediately calls `POST /programmes` with a minimal payload (`{ title: <user-entered activity name or a timestamped placeholder> }`), gets back a draft `Programme` with a real `id`, and redirects (`router.replace`) to `pif/{id}/edit`.
- `pif/{id}/edit` becomes the single real authoring surface for both truly-new and in-progress drafts — no separate "create" form logic to maintain.
- Documents, arrival/departure rows, and attachments can now be created immediately via their nested endpoints (`POST /programmes/{id}/documents`, etc.) from the moment the draft exists, because a real `programme_id` is always available. This also gives the frontend a natural autosave anchor (PUT the changed section on blur) and interrupted-session recovery (reopening `pif/{id}/edit` reloads whatever was already saved).

### 4. Batched procurement transfer (Revision 4)

Replaces the earlier per-item endpoint. New programme-level action:

```
POST /programmes/{programme}/send-to-procurement
{ "procurement_item_ids": [1,2,3], "request_title": "Procurement requirements for approved activity" }
```

Creates one `ProcurementRequest` (title = `request_title`, `requester_id` = acting user, `budget_line`/currency defaulted from the `Programme`), one `ProcurementItem` per transferred `ProgrammeProcurementItem` (copying `description`→`description`, `estimated_cost`→`estimated_unit_price`/`total_price`), and sets `procurement_request_id` on each transferred `ProgrammeProcurementItem`. Guarded: only callable when `Programme::isApproved()`, and rejects (409) if any selected item already has a `procurement_request_id`. Users may still call it multiple times with different subsets to create separate requests where genuinely needed (e.g. different procurement methods), but the UI defaults to selecting all untransferred items into one batch.

### 5. Full PIF PDF is in scope (Revision 5)

Verified reusable infrastructure: `barryvdh/laravel-dompdf` is already a dependency and already used via `Pdf::loadView('pdf.signed_document', [...])` in `app/Services/SaamService.php:173`; QR code generation is already available via `Endroid\QrCode\Builder\Builder` (also used in `SaamService`). This spec adds:
- A new Blade view `resources/views/pdf/programme.blade.php` rendering every completed section (A–N), the attachments index (type/uploaded-by/date per `Attachment`), the full approval history (from the existing `ApprovalRequest`/`ApprovalHistory` records already surfaced by `WorkflowService::snapshot()`), signatory names/positions/decisions/dates, the PIF reference number, and a QR code encoding a verification URL (`/pif/{id}/verify` or similar), reusing the existing `Endroid\QrCode` call pattern.
- `GET /programmes/{programme}/pdf` on `ProgrammeController`, permission-gated identically to `show()`, streaming the rendered PDF via `Pdf::loadView(...)->stream(...)`.
- Excel/CSV register-level reporting (PIF list, PIF-by-officer, etc.) remains a separate, already-flagged pre-existing gap in `ReportsController` and is **not** part of this spec — only the single-record full PDF is in scope, per the review's distinction.

### 6. Simplified single declaration (Revision 6)

Replaces the five booleans with one:

```php
'declaration_confirmed'   => boolean
'declaration_confirmed_by'=> foreignId → users, nullable, set server-side
'declaration_confirmed_at'=> datetime, nullable, set server-side
'declaration_version'     => string, e.g. "v1", identifying which stored declaration text was shown
```

The declaration text itself (*"I confirm that this PIF relates to one activity, the information provided is accurate to the best of my knowledge, required supporting documents have been included, and any known conflict of interest has been disclosed."*) is stored as a versioned constant (e.g. `config('pif.declaration_versions.v1')`) rather than duplicated per-record, so `declaration_version` is enough to reconstruct exactly what the requester agreed to, satisfying the audit requirement without storing the full text on every row.

### 7. Document owner supports internal and external people (Revision 7)

On `programme_documents`: `owner_user_id` (nullable FK → `users`), `owner_name` (nullable string), `owner_organisation` (nullable string). Validation requires at least one of `owner_user_id` or `owner_name` to be present when the document row is saved.

### 8. Distinct, honest M&E link statuses (Revision 8)

`Programme::getMeStatusAttribute()` no longer collapses every non-happy-path into `not_yet_linked`. Using the verified `MeActivityReport` fields (`SoftDeletes`, `review_status`, `closure_status`):

```php
public function getMeStatusAttribute(): string
{
    $report = $this->meActivityReport; // excludes trashed by default
    if ($report) {
        if ($report->closure_status === 'closed' || $report->review_status === MeActivityReport::STATUS_CLOSED) {
            return 'closed';
        }
        return match ($report->review_status) {
            MeActivityReport::STATUS_NOT_SUBMITTED => 'report_pending',
            MeActivityReport::STATUS_SUBMITTED     => 'report_submitted',
            MeActivityReport::STATUS_RETURNED      => 'returned_for_correction',
            MeActivityReport::STATUS_REVIEWED      => 'me_reviewed',
            MeActivityReport::STATUS_ACCEPTED       => 'accepted',
            default => 'link_unavailable',
        };
    }
    // No live record — check whether one existed and was archived (soft-deleted)
    $trashed = MeActivityReport::onlyTrashed()->where('programme_id', $this->id)->exists();
    return $trashed ? 'linked_record_archived' : 'not_yet_linked';
}
```

This distinguishes "never linked" from "was linked, record archived" from "linked but in an unexpected state" rather than flattening all three to one misleading label.

### 9. Array-safe, complete conditional validation (Revision 9)

`support_services` and similar array fields use `Rule::requiredIf(fn () => in_array('other', request()->input('support_services', []), true))` instead of `required_if:support_services,other`, which does not evaluate correctly against array-typed inputs. Full validation rule set added (see API section) for every conditional case called out in the review: DSA-variance reason required when `proposed_dsa_rate` ≠ `original_budget_rate`; participant-variance reason required when `proposed_participants` ≠ `budgeted_participants`; `target_languages` required on a `programme_documents` row when `translation_required`; interpreter count required when the corresponding language pair is selected; `arrival_date` must not be after `departure_date`; all rate/count fields `min:0`; `venue_accommodation_count` required and `>0` when `venue_accommodation_required`; currency present for every new monetary field (reuses `Programme.primary_currency` as the default rather than requiring it per-field, since PRD §17.3 already establishes currency-per-financial-value at the `Programme` level); `conflict_mitigation` required when `conflict_declared`.

### 10. Controlled amendment after approval (Revision 10)

New self-referential column on `programmes`: `amended_from_id` (nullable FK → `programmes.id`), `superseded_at` (nullable datetime). Status enum extended with `amendment_draft`, `amendment_pending_approval`, `amended`, `superseded` (alongside existing `draft`/`submitted`/`approved`/`rejected`/etc.).

- `ProgrammeService::createAmendment(Programme $approved, User $user): Programme` — guarded to only run on an `isApproved()` programme with no existing open amendment (`amendment_draft`/`amendment_pending_approval` status referencing it via `amended_from_id`); clones the approved programme's fillable attributes and its child rows (`documents`, `arrivalDepartures`, `procurementItems` — cloned without their `procurement_request_id`, since a new amendment's procurement needs are re-evaluated) into a new `Programme` with `status = 'amendment_draft'`, `amended_from_id = $approved->id`, `reference_number = "{$approved->reference_number}-A{n}"`.
- `ProgrammeService::submitAmendment()` moves the amendment to `amendment_pending_approval` and routes it through the existing approval workflow (`WorkflowService`), unchanged from how normal submissions work.
- On amendment approval: amendment → `amended`, original → `superseded` (+ `superseded_at = now()`). The original approved record is never mutated or deleted — it just changes status, preserving full history per PRD §17.3 "historical values must remain intact."
- `GET /programmes/{amendment}/diff` — new read-only endpoint doing a field-by-field comparison of the amendment's fillable attributes against `amended_from`'s, returning only the fields that differ. This is intentionally simple (no per-field change tracking/versioning infrastructure) — sufficient for an approver to see what changed before approving an amendment.

## Data Model — full column reference

### New columns on `programmes`

**Venue (C)**: `venue_country`, `venue_city`, `venue_proposed_hotel` string; `venue_accommodation_required` boolean; `venue_accommodation_count` integer; `venue_conferencing_required` boolean; `venue_conferencing_participants` integer; `venue_quotation_attached` boolean; `venue_hotel_quotation_attached` boolean; `venue_accessibility_requirements`, `venue_security_considerations`, `venue_comments` text.

**Budget/Participant Provisions (D)**: `proposed_dsa_rate`, `original_budget_rate` decimal(10,2); `dsa_variance_reason` text; `proposed_participants`, `budgeted_participants` integer; `participants_variance_reason` text; `proposed_funding_difference`, `estimated_activity_amount` decimal(15,2); `budget_availability_status` string enum `not_checked`/`available`/`partially_available`/`unavailable`/`confirmed_with_conditions`, default `not_checked`; `finance_comments` text — **both of the last two are excluded from `ProgrammeController::update()` and only writable via the finance-review endpoint (unchanged from prior revision).**

**Consultants (E)**: per category (`secretariat_staff`, `consultants`, `resource_persons`, `rapporteurs`, `media_liaison`, `local_support`): `{category}_required` boolean, `{category}_count` integer, `{category}_rate` decimal(10,2) where PRD specifies a rate. `personnel_comments` text.

**Interpretation (F)**: `interpretation_required` boolean; per pair (`en_fr`, `en_pt`, `fr_pt`): `{pair}_required` boolean, `{pair}_interpreters_count` integer; `interpreter_rate` decimal(10,2); `interpreter_source` enum `internal`/`supplier`/`partner`/`other` (+`interpreter_source_other_note`); `interpretation_equipment_required` boolean; `translation_required` boolean; `languages_required` json array of strings; `interpretation_comments` text.

**Support Services (H)**: `support_services` json array of keys (`ground_transport`, `air_travel`, `interpretation_equipment`, `zoom_hybrid`, `audio_recording`, `video_recording`, `live_streaming`, `data_projector`, `conference_bags`, `regalia`, `report_newsletter`, `ict_support`, `comms_support`, `procurement_support`, `finance_support`, `admin_support`, `research_support`, `other`); `support_services_other_note` text.

**Conflict of Interest (M)**: `conflict_declared` boolean; `conflict_details`, `conflict_mitigation` text; `conflict_declared_by` foreignId → `users`, nullable, set server-side; `conflict_declared_at` datetime, nullable, set server-side.

**Declaration (N, simplified per Revision 6)**: `declaration_confirmed` boolean; `declaration_confirmed_by` foreignId → `users`, nullable; `declaration_confirmed_at` datetime, nullable; `declaration_version` string, nullable.

**Amendment tracking (Revision 10)**: `amended_from_id` foreignId → `programmes.id`, nullable; `superseded_at` datetime, nullable.

*(No M&E columns — see Revision 1.)*

### New table: `programme_documents` (Section G)

`id`, `programme_id` foreignId, `title` string, `document_type` string, `word_count` integer nullable, `translation_required` boolean, `source_language` string nullable, `target_languages` json array of strings, `owner_user_id` foreignId → `users` nullable, `owner_name` string nullable, `owner_organisation` string nullable, `deadline` date nullable, `budget_line` string nullable, `comments` text nullable, timestamps, soft deletes. `ProgrammeDocument belongsTo Programme` and `belongsTo(User::class, 'owner_user_id')`; `Programme::documents()` hasMany. Attachments target it directly via `attachable_type = ProgrammeDocument::class`.

### New table: `programme_arrival_departures` (Section J)

`id`, `programme_id` foreignId, `category` string, `arrival_date` date nullable, `departure_date` date nullable, `airport` string nullable, `flight_details` text nullable, `transport_required` boolean, `accommodation_required` boolean, `comments` text nullable, timestamps, soft deletes. Validation: `departure_date` must not be before `arrival_date`.

### Changes to `ProgrammeProcurementItem` (Section K)

Add `procurement_request_id` foreignId → `procurement_requests`, nullable (set only by `send-to-procurement`); `currency` string; `rfq_required` boolean.

## API Changes

`ProgrammeController::store()` becomes minimal — only `title` (or a default) is required to create a draft; all other fields move to `update()`, which continues to require `isDraft()` (or, for amendments, `amendment_draft`). Conditional/cross-field validation (Revision 9), representative examples:

```php
'venue_accommodation_count'   => ['required_if:venue_accommodation_required,true', 'nullable', 'integer', 'min:1'],
'support_services'            => ['nullable', 'array'],
'support_services_other_note' => [Rule::requiredIf(fn () => in_array('other', request()->input('support_services', []), true)), 'nullable', 'string'],
'dsa_variance_reason'         => [Rule::requiredIf(fn () => request()->input('proposed_dsa_rate') != request()->input('original_budget_rate')), 'nullable', 'string'],
'participants_variance_reason'=> [Rule::requiredIf(fn () => request()->input('proposed_participants') != request()->input('budgeted_participants')), 'nullable', 'string'],
'conflict_details'            => ['required_if:conflict_declared,true', 'nullable', 'string'],
'conflict_mitigation'         => ['required_if:conflict_declared,true', 'nullable', 'string'],
```

`programme_documents` row validation: `target_languages` `required_if:translation_required,true`; at least one of `owner_user_id`/`owner_name` required (`Rule::requiredIf` closure checking both). `programme_arrival_departures` row validation: `departure_date` `after_or_equal:arrival_date`.

`budget_availability_status`/`finance_comments` remain on the separate `ProgrammeController::updateFinanceReview()` endpoint, gated by the `programme.finance-review` permission (new — seeded and assigned to Finance/Project Accountant/Director Finance roles, following the exact pattern already used for `mande.*` permissions in `RolesAndPermissionsSeeder`, verified lines 55-62 and 237-260: a flat permission-name array, then `$role->givePermissionTo(Permission::whereIn('name', [...])->where('guard_name', $guard)->get())` per role per guard).

`conflict_declared_by`/`conflict_declared_at`/`declaration_confirmed_by`/`declaration_confirmed_at` are always set server-side from the authenticated user — never accepted from the request payload.

**New/changed endpoints:**
- `POST /programmes` — minimal draft creation (Revision 3).
- `POST/PUT/DELETE /programmes/{programme}/documents/{document?}` → `ProgrammeDocumentController` (mirrors `ProgrammeBudgetLineController` exactly).
- `POST/PUT/DELETE /programmes/{programme}/arrival-departures/{row?}` → `ProgrammeArrivalDepartureController`.
- `PUT /programmes/{programme}/finance-review` → `ProgrammeController::updateFinanceReview()`.
- `POST /programmes/{programme}/send-to-procurement` (Revision 4, batched).
- `GET /programmes/{programme}/pdf` (Revision 5).
- `POST /programmes/{programme}/amend` → `createAmendment()`; `POST /programmes/{amendment}/submit-amendment`; `GET /programmes/{amendment}/diff` (Revision 10).
- `GET /mande/pif-linkages?unlinked=true` — extends the existing endpoint with a filter (Revision 2).
- `ProgrammeController::submit()` requires `declaration_confirmed = true` in the payload (or already true, for resubmission), stamping `declaration_confirmed_by`/`declaration_confirmed_at`/`declaration_version` server-side.

## Notifications (Revision 2)

`ProgrammeService::approve()` gains a dispatch (following the existing `NotificationService::dispatch()` pattern already used identically in `ProcurementRequest::onWorkflowApproved()`): notify the Responsible Officer ("Your approved PIF is ready for M&E reporting") and all users holding `mande.create` ("A new approved PIF is available for M&E linkage"), each with a deep link — the PIF for the officer, the M&E PIF-linkages queue for M&E.

## Frontend Changes

`pif/create/page.tsx` becomes a thin redirect shell (Revision 3): on mount, POST a minimal draft, then `router.replace('/pif/{id}/edit')`. `pif/{id}/edit/page.tsx` gains all new sections as collapsible accordions matching the existing pattern, with conditional visibility per PRD §15.2. Documents and Arrival/Departure become repeatable-row sub-forms backed by their real nested endpoints, using each row's database `id` (not array index) for edit/delete. Section D's Finance-only fields render read-only for users without `programme.finance-review`. Section N renders as a single confirmation checkbox with the versioned declaration text, blocking submission until checked (mirrored server-side). An "Amend" action appears on approved PIFs (visible to the Responsible Officer / users with `pif.approve`), creating an amendment draft and routing to its own edit view; the diff endpoint powers a simple before/after view for approvers reviewing an amendment. A "Download PDF" action appears on the view page, hitting the new `/pdf` endpoint.

`pif/[id]/page.tsx` gets matching read-only display blocks for all sections, the workflow tracker (already implemented), and the M&E status block using the 9-state mapping from Revision 8 with human-readable labels (Not Yet Linked / Report Pending / Report Submitted / Returned for Correction / M&E Reviewed / Accepted / Closed / Linked Record Archived / Link Unavailable).

## Permissions

`programme.finance-review` (new) — Finance/Project Accountant/Director Finance roles, seeded following the verified `RolesAndPermissionsSeeder` pattern. `pif.approve` (existing) gates the amend action. M&E-side access to `MeActivityReport` continues to be governed entirely by the existing `mande.*` permissions — this spec adds no new M&E permissions since M&E now has zero write surface on `Programme` itself (Revision 1).

## Audit Trail

New events via the verified `AuditLog::record('event.name', ['auditable_type' => ..., 'auditable_id' => ..., 'new_values' => [...], 'tags' => 'programme'])` pattern: `programme.document_added/removed`, `programme.arrival_departure_added/removed`, `programme.conflict_declared/amended`, `programme.finance_review_updated`, `programme.procurement_sent` (batched — logs the item IDs and the created `ProcurementRequest` id), `programme.declaration_confirmed`, `programme.amendment_created`, `programme.amendment_approved`, `programme.superseded`, `programme.pdf_generated`.

## Error Handling

Standard Laravel validation throughout. Specific cases: `send-to-procurement` returns 409 on any already-linked item; `finance-review` endpoint returns 403 (not a silent no-op) for unauthorized users; `getMeStatusAttribute()` never throws — it always resolves to one of the 9 defined states; `createAmendment()` returns a validation error (not a 500) if an open amendment already exists for the target programme.

## Testing

**Backend**: feature tests for all new flat-field validation (every conditional rule from Revision 9, individually), `ProgrammeDocumentController`/`ProgrammeArrivalDepartureController` CRUD, the finance-review permission gate (403/200), `send-to-procurement` (success, duplicate-guard, pre-approval-guard, verifying one `ProcurementRequest` with N `ProcurementItem`s is created), the declaration gate on `submit()`, the `me_status` accessor across all 9 states (including a soft-deleted `MeActivityReport` producing `linked_record_archived`), the draft-first creation flow, the amendment lifecycle (`createAmendment` → `submitAmendment` → approval → original superseded), the `/diff` endpoint, and PDF generation (asserting a 200 response with `application/pdf` content type and that the rendered view includes data from each section). Regression tests confirm existing workflow, notifications, delegation, attachments, approvals, and audit logging are unaffected.

**Frontend**: Playwright coverage for the draft-first create-then-redirect flow, conditional section show/hide, repeatable-row CRUD for documents and arrival/departure, the single declaration checkbox blocking submission, read-only rendering of Finance-only and M&E status fields for a non-privileged user, the amend action and diff view, and the PDF download action.

## Acceptance Criteria

- No M&E-owned field is stored on `programmes`; the only connection is the `meActivityReport()` relationship.
- Approving a PIF notifies the Responsible Officer and M&E, and the PIF appears in the (now filterable) M&E intake queue.
- Creating a new PIF returns a real draft ID immediately, before any other section is filled in; documents/arrival-departure rows can be added from that point onward.
- Procurement items can be transferred to a single batched `ProcurementRequest`, not one-per-item.
- A complete PIF PDF — all sections, attachments index, approval history, signatories, QR verification — can be generated and downloaded.
- Submission requires exactly one declaration confirmation, recorded with who/when/which version.
- Document rows accept an internal user, an external name, or both.
- The M&E status shown on a PIF distinguishes never-linked, archived-link, and unavailable-link from the real review states, and is never stored redundantly.
- All conditional validation rules from Revision 9 are enforced server-side, including array-typed fields.
- Approved PIFs cannot be edited directly; amendments go through a controlled draft → pending → approved cycle that supersedes (never deletes) the original, with a diff visible to approvers.
- Existing workflows, notifications, delegations, attachments, approvals, and audit logs continue to work unchanged.
