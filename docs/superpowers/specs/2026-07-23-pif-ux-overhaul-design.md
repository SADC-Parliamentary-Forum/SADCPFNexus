# PIF UX Overhaul — Design

## Context

The PIF module (Tasks 1–23 of the earlier "PIF Module Completion" plan) is functionally complete but has three usability gaps identified in user feedback:

1. The sidebar menu label "Programmes" doesn't communicate what the module does.
2. "Strategic Pillar" and "Implementing Department" are hardcoded frontend constant arrays (`lib/constants.ts`) with no backend table and no way for an admin to add/edit options without a code change and redeploy.
3. The PIF edit form is a single long flat page (~840 lines, ~65 field-level `useState` hooks across 8 sections) — not broken into digestible steps, and submission (the declaration checkbox + Submit button) lives on a separate page (`/pif/{id}`) from editing (`/pif/{id}/edit`), a seam flagged as confusing during an earlier review.

This spec covers all three, designed together (so the pieces fit — e.g. the multi-step form's first and last steps directly depend on the other two changes) but built in three phases, each independently shippable.

## Product Principle

Keep the same underlying architecture (draft-first creation, per-field/per-row immediate persistence, backend validation unchanged) — this is a presentation and configuration-management overhaul, not a re-architecture. No new business logic is introduced beyond making two currently-hardcoded option lists admin-configurable.

## Phase 1: Menu Rename + Department Source Change

### Menu rename
`web/components/layout/Sidebar.tsx` — change the `label` for the `/pif` entry from `"Programmes"` to `"PIF / Activity Approvals"`. No route change, no other references need updating (the label is presentational only).

### Implementing Department
`Programme.implementing_department` / `implementing_departments` keep their existing schema (plain string / JSON array of strings) — **no migration needed**. The change is entirely on the frontend: the PIF form's department picker(s) fetch options from the existing `GET /departments` endpoint (already built and used by `hr/departments`) instead of importing the hardcoded `DEPARTMENTS` array from `lib/constants.ts`. What's saved on a `Programme` record remains a plain name string — a snapshot at time of selection, not a live foreign key — so renaming or removing a department in HR later doesn't retroactively change historical PIF records. `SUPPORT_DEPARTMENTS` (a separate, smaller constant used for Section I "Supporting Departments," which is a different field from "Implementing Department") is explicitly **not** changed by this phase — only `DEPARTMENTS`/`implementing_department(s)` is affected, since the supporting-departments checklist is a materially different, looser concept (per the original PIF PRD §8.9) that doesn't map to real HR org units the same way.

## Phase 2: Strategic Pillar → M&E Linking

### Data model

Add two new nullable columns to `programmes`:
- `strategic_plan_id` → FK to `strategic_plans.id`, nullable, `nullOnDelete()`
- `strategic_goal_id` → FK to `strategic_goals.id`, nullable, `nullOnDelete()`

The existing `strategic_alignment` (array), `strategic_pillar` (string), `strategic_pillars` (array) columns are **left untouched** — no data migration, no backfill. Historical PIFs keep whatever free-text values they already have. The PIF form's "Strategic Pillar" field is replaced going forward with the new FK-based cascading dropdown; the old free-text fields simply stop being written to by the form (they remain in the schema for historical read access only, e.g. if a report or export still references them).

`Programme` model: add `strategicPlan()` (`belongsTo(StrategicPlan::class)`) and `strategicGoal()` (`belongsTo(StrategicGoal::class)`) relations, add both new fields to `$fillable`.

### API

`ProgrammeController::store()`/`update()` validation gains:
```php
'strategic_plan_id' => ['nullable', 'integer', 'exists:strategic_plans,id'],
'strategic_goal_id' => ['nullable', 'integer', Rule::exists('strategic_goals', 'id')->where(fn ($q) => $q->when(
    request('strategic_plan_id'), fn ($q2) => $q2->where('strategic_plan_id', request('strategic_plan_id'))
))],
```
(exact validation to be finalized during implementation — the intent is: if both are supplied, the goal must genuinely belong to the supplied plan; either may be null independently, since a PIF may not yet have a pillar assigned).

No changes to the M&E module's own `StrategicPlanController` — its existing CRUD (`store`, `update`, `destroy`, `archive`, `activate`, `addGoal`, `deleteNode`) is reused as-is for the new settings page.

### Frontend: new M&E settings page

`web/app/(app)/mande/strategic-plans/page.tsx` (new), gated by the existing `mande.admin` permission for mutations (`mande.view` for read), following the visual/structural conventions of sibling admin settings pages (e.g. `hr/departments`). Lists Strategic Plans (with status: draft/active/archived), and within each plan, its Goals (add/edit/delete, reusing `POST strategic-plans/{id}/goals` and `DELETE strategic-nodes/goal/{id}`). Objectives/Outcomes/Outputs are **not** exposed here — this page only manages the two levels the PIF form consumes (Plan, Goal); deeper M&E configuration (if a future settings page for those is wanted) is out of scope for this spec.

### Frontend: PIF form cascading dropdown

New "Strategic Pillar" field in the form (Step 1 — see Phase 3): a Plan `<select>` (only `active` plans shown, matching how M&E already filters elsewhere) followed by a Goal `<select>` scoped to the chosen plan, populated via `GET /mande/strategic-plans/{id}` (already returns nested goals per the existing `show()` endpoint — verify during implementation whether goals are eager-loaded on `show()` or need a separate fetch, and adjust accordingly). Both are optional (nullable) — a PIF can be saved/submitted without a pillar assigned, matching the existing "light-touch" intent from the original PIF PRD.

## Phase 3: Multi-Step Edit Form

### Component reuse

`web/components/ui/Stepper.tsx` already exists and is used by `travel/create`, `leave/create`, `imprest/create`, `procurement/create`. Extend it with an optional `onStepClick?: (step: number) => void` prop (backward compatible — omitting it preserves current display-only behavior for those other pages) so the PIF edit form's stepper is clickable for free navigation between steps.

### Step breakdown

`pif/[id]/edit/page.tsx` is restructured from 8 flat sections into 6 steps, each rendered as its own view within the same page component (no route changes — still `/pif/{id}/edit`, step state is local, e.g. a `?step=` query param or plain component state):

1. **Activity & Classification** — title, dates, committee/organ, thematic area, activity format, summary/objectives, Strategic Pillar (new cascading dropdown from Phase 2), Implementing Department (HR-sourced from Phase 1)
2. **Venue & Logistics** — existing Venue fields + `ArrivalDepartureSection` component (already built, reused as-is)
3. **People & Language Support** — existing Personnel/Consultants fields + Interpretation fields
4. **Budget & Procurement** — existing Budget variance fields + Procurement items
5. **Documents & Support Services** — `DocumentsSection` component (already built, reused as-is) + Support Services checkboxes
6. **Review, Compliance & Submit** — a read-only summary of everything entered across steps 1–5 (reusing field-rendering patterns from the existing `ReadOnlySections.tsx` component where practical, to avoid duplicating display logic), the M&E Linkage Summary (read-only, unchanged), Conflict of Interest fields (still editable here, not read-only, since it's not covered by an earlier step), the single declaration checkbox, and the Submit button — **replacing** the current separate submit action on `pif/[id]/page.tsx`.

### Navigation

The `Stepper` at the top of the page is clickable — clicking any step number/label jumps directly there, since every field/row already persists individually via existing API calls (no "unsaved step" risk). Next/Back buttons at the bottom of each step move sequentially as a convenience but aren't required for navigation. No step is "locked" pending completion of a prior step — this matches how the current flat form already lets users fill fields in any order.

### Submit relocation

`pif/[id]/page.tsx` loses its declaration checkbox + Submit button (currently in the Approval tab's Actions block, per the earlier PIF work). The Approval tab keeps everything else it currently shows (approval history, Approve/Reject/Amend actions for approvers) — only the requester-facing "submit a draft" action moves into the edit wizard's final step. `programmeApi.submit()`'s signature (`(id, { declaration_confirmed: boolean })`) is unchanged; only the call site moves.

## Explicitly Out of Scope

- Any change to `SUPPORT_DEPARTMENTS`, `PIF_STRATEGIC_PILLARS`'s removal is superseded by the new FK fields but the constant itself may be left in `lib/constants.ts` as dead code for this spec (cleanup is a trivial follow-up, not blocking).
- M&E Objective/Outcome/Output settings UI (only Plan/Goal are exposed).
- Any change to how documents/arrival-departure rows persist (still per-row immediate API calls, unchanged from the existing components).
- Backfilling `strategic_plan_id`/`strategic_goal_id` on existing PIF records from their old free-text `strategic_pillar` values — no automatic migration/matching is attempted; existing records simply show "not set" for the new field until someone edits them.
- Changing the underlying validation/persistence mechanics established in the earlier PIF Module Completion plan (conditional-field reaffirmation logic, DB-fallback patterns, etc.) — this spec only changes how fields are grouped and presented, and adds the two new FK fields.

## Testing

**Backend**: feature tests for the two new FK fields' validation (valid plan+goal combination, goal-not-belonging-to-plan rejection, both nullable independently), and a regression test confirming `implementing_department`'s validation still accepts any string (not newly restricted to an enum, since it remains free text sourced client-side from HR's list, not server-enforced).

**Frontend**: Playwright coverage for the new Strategic Plans settings page (create plan, add goal, edit, delete), the cascading dropdown in the PIF form (selecting a plan filters the goal options), stepper click-navigation (jump from step 1 to step 6 and back), and an updated version of the existing `pif-sections.spec.ts` happy-path test reflecting the new step structure and the relocated Submit action.
