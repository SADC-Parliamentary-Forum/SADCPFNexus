# PIF Missing Sections — Design

## Context

The Programme Implementation Form (PIF), implemented as the `Programme` model/module, is the activity-level request-and-approval form for SADC PF Nexus. A code audit against the updated PRD (2026-07-21) found that while the PIF's workflow, notifications, delegation, attachments, and approval machinery are fully implemented, the `programmes` table is missing 8 of the PRD's form sections outright: Venue, Budget/Participant Variance, Consultants & Support Personnel, Interpretation & Languages, Documentation & Translation, Support Services, Arrival/Departure, and Conflict of Interest. A ninth section — M&E Linkage Summary — is explicitly required by the PRD as a lightweight, read-only summary connecting the PIF to the separate M&E / Results Monitoring module.

This spec covers closing that gap: extending the `programmes` schema, model, API validation, and the web PIF forms (create/edit/view) to include all 8 missing sections plus the M&E Linkage Summary, while keeping the PIF itself simple — it must remain a request-and-approval tool, not become the M&E module.

**Explicitly out of scope for this spec** (deferred to future specs):
- Converting `strategic_alignment`/`strategic_pillars` from free-text arrays to FK-backed cascading dropdowns sourced from the M&E Strategic Plan configuration.
- Wiring `ProgrammeProcurementItem` to actually create/link a real `ProcurementRequest` (separate "procurement link from PIF" gap).
- Any change to the M&E module itself — it already exists as a separate menu/module and is out of scope here.
- Budget module FK linkage (`budget_line_id` dead-field gap) — separate spec.
- Salary advance consolidation, reports export formats — unrelated gaps, separate specs.

## Architecture

One migration adds the new columns to the existing `programmes` table. Simple/single-value fields become individual nullable columns, matching the table's existing pattern (e.g. `primary_currency`, `contingency_pct`). The two genuinely repeating sections — Documentation and Arrival/Departure — become `json`-cast array columns, following the existing `funding_sources` pattern already on `Programme`. No new tables, models, controllers, or routes are introduced; everything extends the existing `Programme` model, `ProgrammeController`, and `ProgrammeService`.

The M&E Linkage Summary section uses two real foreign keys — `me_activity_report_id` (→ `me_activity_reports`) and `me_indicator_id` (→ `indicators`) — reusing the existing M&E tables instead of inventing free-text duplicates. Both are set only by the M&E side of the system (not by the PIF's own create/update endpoints); the PIF renders this section as read-only. The section's review status is **not stored** on `programmes` — it's derived at read time from the linked `MeActivityReport.status`, so the PIF never holds a second, potentially stale copy of a status the M&E module owns.

## Data Model

### New columns on `programmes` (all nullable)

**Venue**
- `venue_country` string
- `venue_city` string
- `venue_proposed_hotels` text
- `venue_accommodation_required` boolean
- `venue_accommodation_count` integer
- `venue_conferencing_required` boolean
- `venue_conferencing_participants` integer
- `venue_quotation_attached` boolean
- `venue_hotel_quotations_attached` boolean
- `venue_accessibility_requirements` text
- `venue_security_considerations` text
- `venue_comments` text

**Budget & Participant Variance**
- `proposed_dsa_rate` decimal(10,2)
- `original_budget_rate` decimal(10,2)
- `dsa_variance_reason` text
- `proposed_participants` integer
- `budgeted_participants` integer
- `participants_variance_reason` text
- `proposed_funding_difference` decimal(15,2)
- `budget_availability_status` string (enum-like: `available` / `partial` / `unavailable`)
- `finance_comments` text

**Consultants & Support Personnel**
- `secretariat_staff_required` boolean, `secretariat_staff_count` integer
- `consultants_required` boolean, `consultants_count` integer, `consultant_rate` decimal(10,2)
- `resource_persons_required` boolean, `resource_persons_count` integer, `resource_person_rate` decimal(10,2)
- `rapporteurs_required` boolean, `rapporteurs_count` integer, `rapporteur_rate` decimal(10,2)
- `media_liaison_required` boolean, `media_liaison_count` integer
- `local_support_required` boolean, `local_support_count` integer, `local_support_rate` decimal(10,2)
- `consultants_comments` text

**Interpretation & Languages**
- `interpretation_required` boolean
- `en_fr_interpretation_required` boolean, `en_fr_interpreters_count` integer
- `en_pt_interpretation_required` boolean, `en_pt_interpreters_count` integer
- `fr_pt_interpretation_required` boolean, `fr_pt_interpreters_count` integer
- `interpreter_rate` decimal(10,2)
- `interpreter_source` string (enum: `internal` / `supplier` / `partner` / `other`)
- `interpretation_equipment_required` boolean
- `translation_required` boolean
- `languages_required` json (array of strings)
- `interpretation_comments` text

**Documentation** (json array column: `documents`)
Each element: `{ title, type, word_count, translation_required, source_language, target_languages: [], owner, deadline, budget_line, comments }`. File uploads for each document go through the existing `Attachment` morph relation with document type `pif_translation_doc`, cross-referenced by document title.

**Support Services** (json array column: `support_services`, plus `support_services_other_note` text)
Array of selected keys from: `ground_transport`, `air_travel`, `interpretation_equipment`, `zoom_hybrid`, `audio_recording`, `video_recording`, `live_streaming`, `data_projector`, `conference_bags`, `regalia`, `report_newsletter`, `ict_support`, `comms_support`, `procurement_support`, `finance_support`, `admin_support`, `other`.

**Arrival/Departure** (json array column: `arrival_departure`)
Each element: `{ category, arrival_date, departure_date, airport, flight_details, transport_required, accommodation_required, comments }`.

**Conflict of Interest**
- `conflict_declared` boolean
- `conflict_details` text
- `conflict_mitigation` text
- `conflict_declared_by` foreignId → `users`, nullable
- `conflict_declared_at` datetime, nullable

**M&E Linkage Summary**
- `me_classification_required` boolean
- `me_activity_report_id` foreignId → `me_activity_reports`, nullable
- `me_planned_output` text
- `me_planned_target` string, nullable
- `me_indicator_id` foreignId → `indicators`, nullable
- `me_reporting_category` string

### Model changes (`app/Models/Programme.php`)

- Add all new columns to `$fillable`.
- Add appropriate `$casts` (`boolean` for flags, `decimal:2` for rates/amounts, `array` for the JSON columns, `date`/`datetime` where relevant).
- Add relations: `conflictDeclaredBy()` belongsTo `User`, `meActivityReport()` belongsTo `MeActivityReport`, `meIndicator()` belongsTo `Indicator`.
- Add accessor `getMeReviewStatusAttribute()` (or a computed method) that returns `$this->meActivityReport?->status ?? 'not_linked'` — never stored, always derived.

## API Changes

`ProgrammeController::store()` and `update()` validation arrays are extended with rules for every new field, following existing conventions (`nullable`, typed, `sometimes` on update). The JSON array fields validate their sub-structure, e.g.:

```php
'documents'                    => ['nullable', 'array'],
'documents.*.title'            => ['required_with:documents', 'string', 'max:255'],
'documents.*.translation_required' => ['nullable', 'boolean'],
'documents.*.target_languages'     => ['nullable', 'array'],
'arrival_departure'             => ['nullable', 'array'],
'arrival_departure.*.category'  => ['required_with:arrival_departure', 'string', 'max:255'],
'arrival_departure.*.arrival_date'   => ['nullable', 'date'],
'arrival_departure.*.departure_date' => ['nullable', 'date'],
```

`me_activity_report_id` and `me_indicator_id` are **not** included in `store()`/`update()` validation — they are only ever written by M&E-side endpoints (existing `MAndE/*` controllers), enforcing that the PIF's own create/edit flow cannot self-assign its M&E link. `ProgrammeService::create()`/`update()` requires no new business logic beyond mass-assignment; the `me_review_status` value is computed on read via the model accessor and included in `ProgrammeService::get()`'s response shape.

## Frontend Changes

`web/app/(app)/pif/create/page.tsx` and `web/app/(app)/pif/[id]/edit/page.tsx` each gain 8 new form sections (Venue, Budget Variance, Consultants, Interpretation, Documentation, Support Services, Arrival/Departure, Conflict of Interest), using the existing accordion/section UI pattern already present in those files. `documents` and `arrival_departure` use a repeatable-row sub-form (add/remove row), matching the pattern used for `funding_sources`.

The M&E Linkage Summary renders as a **read-only info block**, not an editable form section — it shows classification, linked M&E record (as a link to that activity report when present), planned output/target/indicator, and the live `me_review_status`. It never appears as user-editable inputs in create/edit.

`web/app/(app)/pif/[id]/page.tsx` (the read-only view page) gets matching display blocks for all 9 sections.

## Error Handling

Standard Laravel validation errors surface identically to existing PIF fields — no new error-handling patterns introduced. One specific case: if `me_activity_report_id` references a soft-deleted or otherwise unresolvable `MeActivityReport`, the `me_review_status` accessor returns `"not_linked"` rather than throwing, so a broken M&E link never blocks viewing or editing the PIF.

## Testing

**Backend**: extend `ProgrammeController` feature tests to cover create/update with the new fields, including valid and invalid payloads for the JSON array sub-fields (`documents`, `arrival_departure`, `support_services`, `languages_required`). Add a test confirming `me_review_status` correctly reflects a linked `MeActivityReport.status` and degrades to `"not_linked"` when unlinked or the link is broken.

**Frontend**: no existing PIF e2e coverage was found in the codebase — this is a pre-existing gap, not something this spec is responsible for backfilling wholesale. This spec adds basic Playwright coverage (following `sadcpf-playwright-e2e` conventions) for the new sections' happy path only: fill all 8 new editable sections, submit, and verify the values persist and display correctly on the view page.

## Acceptance Criteria

- A user can fill in Venue, Budget Variance, Consultants, Interpretation, Documentation, Support Services, Arrival/Departure, and Conflict of Interest when creating or editing a PIF.
- All new fields persist correctly, including the two JSON array sections with multiple rows.
- The M&E Linkage Summary renders correctly as read-only, showing "not linked" when no `MeActivityReport` is associated, and the live status when one is.
- The PIF's own `store`/`update` endpoints cannot set `me_activity_report_id` or `me_indicator_id`.
- Existing PIF functionality (workflow, notifications, delegation, attachments, existing sections) is unaffected.
- Backend feature tests and basic frontend e2e coverage pass.
