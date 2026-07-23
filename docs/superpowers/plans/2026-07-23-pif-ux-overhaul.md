# PIF UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the PIF menu item to something intuitive, make Strategic Pillar and Implementing Department admin-configurable (Department via the existing HR list, Strategic Pillar via a real link to M&E's Strategic Plan/Goal hierarchy with a new settings page), and restructure the PIF edit form from one 850+ line flat page into a 6-step wizard that ends with the submission action (currently on a separate page).

**Architecture:** Phase 1 and 2 are additive, non-breaking changes to the existing flat edit form (so they're independently shippable and testable before the wizard exists). Phase 3 extracts the now-larger flat form into 6 step components under a new orchestrator, reusing the existing `Stepper` UI component (extended with click-navigation) and the existing `DocumentsSection`/`ArrivalDepartureSection` components unchanged.

**Tech Stack:** Laravel 11 (PHP) for the two new nullable FK columns and validation; Next.js/React/TypeScript for all UI work, reusing the already-built `mandeApi` client (strategic plan CRUD is already fully implemented there) and `adminApi.listDepartments()`.

**Source spec:** `docs/superpowers/specs/2026-07-23-pif-ux-overhaul-design.md`

---

## Corrections from the spec (verified against current code, not assumed)

1. The spec proposed a new page at `web/app/(app)/mande/strategic-plans/page.tsx`. The sidebar (`web/components/layout/Sidebar.tsx:164`) **already has a dead link** to `/mande/strategic-plan` (singular, no `s`) that has never had a page built for it. This plan builds the page at that existing route instead of inventing a new one, so the already-present nav link starts working rather than creating a second, redundant route.
2. The spec said `components/ui/Stepper.tsx` is "used by `travel/create`, `leave/create`, `imprest/create`, `procurement/create`." Verified this is **wrong** — those four pages each have their own hand-rolled, duplicated inline stepper JSX. The real shared `Stepper` component is used by exactly two places: `web/app/setup/page.tsx` (a genuine multi-step wizard, `<Stepper steps={STEPS} currentStep={step} />`, no click support) and `web/app/(app)/imprest/[id]/page.tsx` (a status-progress display, different use case). This plan still uses the shared `Stepper` component (extending it, per the spec's intent) — `setup/page.tsx` is the correct precedent to follow, not the four create-flow pages, which are out of scope and untouched by this plan.
3. `adminApi.listDepartments()` already exists (`web/lib/api.ts:370`, `GET /admin/departments`) and is usable by any authenticated user — despite the `/admin` URL prefix, `DepartmentPolicy::viewAny()` returns `true` unconditionally (`api/app/Policies/DepartmentPolicy.php:15`), so no new backend endpoint or permission change is needed for Phase 1.
4. `mandeApi` (`web/lib/api.ts:5246`) already has full, correctly-typed CRUD for strategic plans and goals (`listPlans`, `getPlan`, `createPlan`, `updatePlan`, `deletePlan`, `archivePlan`, `activatePlan`, `addGoal`, `deleteNode`). Phase 2's frontend work is therefore just building the settings page UI against this already-complete client — no new frontend API methods are needed.

---

## Phase 1: Menu Rename + Department Source

### Task 1: Rename the PIF menu item

**Files:**
- Modify: `web/components/layout/Sidebar.tsx:89`

- [ ] **Step 1: Make the change**

In `web/components/layout/Sidebar.tsx`, line 89, change:

```tsx
  { label: "Programmes", href: "/pif", icon: "account_tree", section: "Management" },
```

to:

```tsx
  { label: "PIF / Activity Approvals", href: "/pif", icon: "account_tree", section: "Management" },
```

- [ ] **Step 2: Verify in the browser**

Run: `cd web && npm run dev` (or use the already-running dev server for this project). Log in, confirm the sidebar under "Management" now reads "PIF / Activity Approvals" and still links to `/pif`.

- [ ] **Step 3: Commit**

```bash
git add web/components/layout/Sidebar.tsx
git commit -m "feat(pif): rename sidebar menu item to 'PIF / Activity Approvals'"
```

---

### Task 2: Source Implementing Department from the real HR department list

**Files:**
- Modify: `web/app/(app)/pif/[id]/edit/page.tsx`

- [ ] **Step 1: Read the current implementation**

In `web/app/(app)/pif/[id]/edit/page.tsx`, the department field currently renders as a plain `<select>` populated from a hardcoded `IMPLEMENTING_DEPARTMENTS` array (imported from `@/lib/constants`, mirroring the pattern already fixed for `create/page.tsx` in an earlier task). Confirm this by reading the file's imports and the JSX around the `implementingDepartment` state variable (declared at line 22) before editing — the exact surrounding markup must be matched, not guessed.

- [ ] **Step 2: Fetch real departments on mount**

Add a new state variable and fetch call. Near the existing `tenantUsers` fetch (the component already calls `tenantUsersApi.list()` in its load effect — follow the identical pattern), add:

```tsx
const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
```

In the same `useEffect` that currently loads `tenantUsers` (do not add a second effect — extend the existing one so both fetches run together), add:

```tsx
adminApi.listDepartments().then((res) => setDepartments(res.data.data.map((d) => ({ id: d.id, name: d.name })))).catch(() => {});
```

Add `adminApi` to the existing `import { programmeApi, tenantUsersApi, ... } from "@/lib/api";` line at the top of the file.

- [ ] **Step 3: Replace the hardcoded select options**

Find the `<select>` (or equivalent) bound to `implementingDepartment` and replace its hardcoded `IMPLEMENTING_DEPARTMENTS.map(...)` options with:

```tsx
{departments.map((d) => (
  <option key={d.id} value={d.name}>{d.name}</option>
))}
```

Leave the surrounding `<select>` element, its `value={implementingDepartment}` binding, and its `onChange` handler untouched — only the options source changes. The saved value remains a plain string (the department's `name` at time of selection), matching the existing `implementing_department` field's type on `Programme` — no backend change in this task.

Remove the now-unused `IMPLEMENTING_DEPARTMENTS` (and its `DEPARTMENTS` import from `@/lib/constants`) if this was the only place in the file using it — grep the file first to confirm before removing the import.

- [ ] **Step 4: Manually verify in the browser**

Open an existing PIF's edit page. Confirm the Implementing Department dropdown now shows the real departments from `hr/departments` (not the old hardcoded 9-item list — cross-check against what's currently in `hr/departments` to confirm they differ, proving the source actually changed). Select one, save, reload, confirm it persisted.

- [ ] **Step 5: Commit**

```bash
git add "web/app/(app)/pif/[id]/edit/page.tsx"
git commit -m "feat(pif): source Implementing Department options from the real HR department list"
```

---

## Phase 2: Strategic Pillar → M&E Linking

### Task 3: Add strategic_plan_id and strategic_goal_id to programmes

**Files:**
- Create: `api/database/migrations/2026_07_23_100000_add_strategic_plan_goal_to_programmes_table.php`
- Modify: `api/app/Models/Programme.php`
- Test: `api/tests/Feature/Programmes/ProgrammeSectionsTest.php` (extend)

- [ ] **Step 1: Write the failing test**

Add to `api/tests/Feature/Programmes/ProgrammeSectionsTest.php`:

```php
    public function test_programmes_table_has_strategic_plan_and_goal_columns(): void
    {
        $this->assertTrue(Schema::hasColumn('programmes', 'strategic_plan_id'));
        $this->assertTrue(Schema::hasColumn('programmes', 'strategic_goal_id'));
    }

    public function test_programme_can_be_linked_to_a_strategic_plan_and_goal(): void
    {
        $tenant = \App\Models\Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $plan = \App\Models\StrategicPlan::create([
            'tenant_id' => $tenant->id, 'name' => 'Plan 2026-2030', 'status' => 'active',
        ]);
        $goal = $plan->goals()->create([
            'tenant_id' => $tenant->id, 'title' => 'Governance & Human Rights',
        ]);

        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'Strategic Link Test'])->json('data.id');

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'strategic_plan_id' => $plan->id,
            'strategic_goal_id' => $goal->id,
        ])->assertOk();

        $this->assertDatabaseHas('programmes', [
            'id' => $programmeId, 'strategic_plan_id' => $plan->id, 'strategic_goal_id' => $goal->id,
        ]);
    }

    public function test_strategic_goal_must_belong_to_the_selected_plan(): void
    {
        $tenant = \App\Models\Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $planA = \App\Models\StrategicPlan::create(['tenant_id' => $tenant->id, 'name' => 'Plan A', 'status' => 'active']);
        $planB = \App\Models\StrategicPlan::create(['tenant_id' => $tenant->id, 'name' => 'Plan B', 'status' => 'active']);
        $goalOnPlanB = $planB->goals()->create(['tenant_id' => $tenant->id, 'title' => 'Goal on B']);

        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'Mismatch Test'])->json('data.id');

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'strategic_plan_id' => $planA->id,
            'strategic_goal_id' => $goalOnPlanB->id,
        ])->assertUnprocessable()->assertJsonValidationErrors(['strategic_goal_id']);
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && php artisan test tests/Feature/Programmes/ProgrammeSectionsTest.php --filter=strategic`
Expected: FAIL — columns don't exist yet, `StrategicPlan`/`Programme` have no relation.

- [ ] **Step 3: Write the migration**

```php
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('programmes', function (Blueprint $table) {
            $table->foreignId('strategic_plan_id')->nullable()->constrained('strategic_plans')->nullOnDelete();
            $table->foreignId('strategic_goal_id')->nullable()->constrained('strategic_goals')->nullOnDelete();
            $table->index('strategic_plan_id');
            $table->index('strategic_goal_id');
        });
    }

    public function down(): void
    {
        Schema::table('programmes', function (Blueprint $table) {
            $table->dropConstrainedForeignId('strategic_plan_id');
            $table->dropConstrainedForeignId('strategic_goal_id');
        });
    }
};
```

Note: this migration must run AFTER `strategic_plans`/`strategic_goals` exist (they were created by `2026_06_01_100000_create_mande_tables.php`, well before this migration's timestamp) and needs the `app_user` Postgres grant that the rest of the `programmes` table's columns already have — verify by checking whether `strategic_plans`/`strategic_goals` already have their own `app_user` grants (they should, from the M&E module's original migrations) and whether adding a nullable FK column to an already-granted table (`programmes`) requires a NEW grant statement (it does not — `GRANT` in Postgres applies at the table level, not per-column, so no additional grant migration is needed here, only if this were a brand new table).

- [ ] **Step 4: Add the relations and fillable fields to Programme**

In `api/app/Models/Programme.php`, add `strategic_plan_id` and `strategic_goal_id` to `$fillable`, and add these two relations (near the existing `meActivityReport()`/`amendedFrom()` relations):

```php
    public function strategicPlan()
    {
        return $this->belongsTo(StrategicPlan::class);
    }

    public function strategicGoal()
    {
        return $this->belongsTo(StrategicGoal::class);
    }
```

- [ ] **Step 5: Add validation to ProgrammeController**

In `api/app/Http/Controllers/Api/V1/Programmes/ProgrammeController.php`, add to `sectionRules()` (the shared validation method used by both `store()` and `update()`, established in the earlier PIF Module Completion plan):

```php
            'strategic_plan_id' => ['nullable', 'integer', 'exists:strategic_plans,id'],
            'strategic_goal_id' => [
                'nullable', 'integer',
                Rule::exists('strategic_goals', 'id')->where(function ($query) use ($request) {
                    if ($request->filled('strategic_plan_id')) {
                        $query->where('strategic_plan_id', $request->input('strategic_plan_id'));
                    }
                }),
            ],
```

Read the current `sectionRules()` method signature first (it takes `Request $request` and `?Programme $programme` per the established pattern) to place this correctly alongside the other rules, using the same `use Illuminate\Validation\Rule;` import already present in the file.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd api && php artisan migrate` then `php artisan test tests/Feature/Programmes/ProgrammeSectionsTest.php --filter=strategic`
Expected: PASS (3 tests)

- [ ] **Step 7: Run the full Programmes suite to check for regressions**

Run: `php artisan test tests/Feature/Programmes` (confirm no other `php.exe`/artisan test process is running first, per this codebase's established convention for avoiding shared-test-DB deadlocks).
Expected: all pass, same count as before plus the 3 new tests.

- [ ] **Step 8: Commit**

```bash
git add api/database/migrations/2026_07_23_100000_add_strategic_plan_goal_to_programmes_table.php \
        api/app/Models/Programme.php \
        api/app/Http/Controllers/Api/V1/Programmes/ProgrammeController.php \
        api/tests/Feature/Programmes/ProgrammeSectionsTest.php
git commit -m "feat(pif): link Programme to a real Strategic Plan and Goal via two new nullable FKs"
```

---

### Task 4: Strategic Pillar cascading dropdown in the PIF edit form

**Files:**
- Modify: `web/app/(app)/pif/[id]/edit/page.tsx`

- [ ] **Step 1: Read the current Strategic Pillar field**

The form currently has a free-text `strategicPillar` state (line 21) rendered as a plain `<select>` sourced from the hardcoded `PIF_STRATEGIC_PILLARS` constant (per the same pattern fixed for Department in Task 2). Read the exact surrounding JSX before editing.

- [ ] **Step 2: Add plan/goal state and fetch active plans on mount**

Add:

```tsx
const [strategicPlans, setStrategicPlans] = useState<StrategicPlan[]>([]);
const [strategicPlanId, setStrategicPlanId] = useState<number | "">("");
const [strategicGoalId, setStrategicGoalId] = useState<number | "">("");
```

Add `StrategicPlan`, `StrategicGoal`, and `mandeApi` to the file's existing `@/lib/api` import. In the same load effect used for Task 2's department fetch, add:

```tsx
mandeApi.listPlans({ status: "active" }).then((res) => setStrategicPlans(res.data.data)).catch(() => {});
```

When the programme loads (in the effect that currently hydrates `strategicPillar` etc. from the fetched `Programme`), also hydrate:

```tsx
setStrategicPlanId(data.strategic_plan_id ?? "");
setStrategicGoalId(data.strategic_goal_id ?? "");
```

(`data` here is whatever variable name the existing hydration effect already uses for the fetched programme — match it exactly, don't introduce a new variable name.)

- [ ] **Step 3: Derive the goal options for the selected plan**

Add a derived value (not state — computed from `strategicPlans` + `strategicPlanId`):

```tsx
const selectedPlan = strategicPlans.find((p) => p.id === strategicPlanId);
const goalOptions = selectedPlan?.goals ?? [];
```

Note: `mandeApi.listPlans()` (the list endpoint) does NOT eager-load goals per plan — only `mandeApi.getPlan(id)` (the show endpoint) does, per `StrategicPlanService::get()`'s `$plan->load(['creator:id,name', 'goals.objectives.outcomes.outputs'])`. Since the dropdown needs goals for the plan the user has selected, fetch them lazily when `strategicPlanId` changes rather than eager-loading every plan's goals up front (wasteful for tenants with many plans):

```tsx
useEffect(() => {
  if (!strategicPlanId) { setSelectedPlanGoals([]); return; }
  mandeApi.getPlan(Number(strategicPlanId)).then((res) => setSelectedPlanGoals(res.data.data.goals ?? [])).catch(() => setSelectedPlanGoals([]));
}, [strategicPlanId]);
```

This requires a new state variable `const [selectedPlanGoals, setSelectedPlanGoals] = useState<StrategicGoal[]>([]);` (declared alongside the others from Step 2) — replace the `goalOptions` derived-value approach from this step's first draft with `selectedPlanGoals` directly, since goals must come from the per-plan fetch, not from the list response.

- [ ] **Step 4: Render the cascading dropdown**

Replace the existing free-text Strategic Pillar `<select>` with two selects:

```tsx
<div>
  <label className="text-xs font-semibold text-neutral-500">Strategic Plan</label>
  <select
    value={strategicPlanId}
    onChange={(e) => { setStrategicPlanId(e.target.value ? Number(e.target.value) : ""); setStrategicGoalId(""); }}
    className="input-field w-full"
  >
    <option value="">Select a plan…</option>
    {strategicPlans.map((p) => <option key={p.id} value={p.id}>{p.name}{p.period ? ` (${p.period})` : ""}</option>)}
  </select>
</div>
<div>
  <label className="text-xs font-semibold text-neutral-500">Strategic Pillar (Goal)</label>
  <select
    value={strategicGoalId}
    onChange={(e) => setStrategicGoalId(e.target.value ? Number(e.target.value) : "")}
    disabled={!strategicPlanId}
    className="input-field w-full disabled:opacity-50"
  >
    <option value="">Select a pillar…</option>
    {selectedPlanGoals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
  </select>
</div>
```

Selecting a different plan resets the goal selection (`setStrategicGoalId("")`), since a previously-selected goal from a different plan would be invalid — matches the backend validation from Task 3 that rejects a goal not belonging to the selected plan. Match the actual `className` conventions used elsewhere in this file for `<select>`/`<label>` (e.g. whatever `input-field`-equivalent class the Venue/Budget sections already use) rather than inventing new class names — read a neighboring field first.

Remove the old free-text `strategicPillar` state, its `<select>`, and the now-unused `PIF_STRATEGIC_PILLARS` import if nothing else in the file uses it (grep first).

- [ ] **Step 5: Wire into the save payload**

Find the existing `programmeApi.update(...)` call site and add `strategic_plan_id: strategicPlanId || null, strategic_goal_id: strategicGoalId || null,` to its payload object, alongside the other fields already being sent.

- [ ] **Step 6: Manually verify in the browser**

Requires at least one active Strategic Plan with goals to exist — if none does yet in the dev database, this step depends on Task 5 (the settings page) being usable first; if Task 5 hasn't landed yet, create a test plan/goal directly via `mandeApi` calls in the browser console or via `php artisan tinker` as a temporary stand-in, and note in your report that full UI verification of this step happens after Task 5. Confirm: selecting a plan populates the goal dropdown with that plan's goals; selecting a different plan clears the goal selection; saving persists both IDs; reloading the page shows the previously-selected plan and goal.

- [ ] **Step 7: Commit**

```bash
git add "web/app/(app)/pif/[id]/edit/page.tsx"
git commit -m "feat(pif): replace free-text Strategic Pillar with a cascading Strategic Plan/Goal dropdown"
```

---

### Task 5: Strategic Plan settings page

**Files:**
- Create: `web/app/(app)/mande/strategic-plan/page.tsx`

- [ ] **Step 1: Read an existing M&E page for conventions**

Read `web/app/(app)/mande/indicators/page.tsx` in full — this is the closest existing precedent (an M&E settings-style CRUD page under the same `mande` route group, using `mandeApi`). Match its permission-check pattern (how it determines whether the current user has `mande.admin` to show edit/delete controls versus read-only for `mande.view`-only users), its loading/error/toast conventions, and its overall page layout (header, table/list, modal-or-inline-form for add/edit) before writing new code.

- [ ] **Step 2: Build the page**

Create `web/app/(app)/mande/strategic-plan/page.tsx` as a client component. Required functionality, all against the already-existing `mandeApi` methods (verified complete in the Corrections section above — no new API client code needed):

- List all Strategic Plans (`mandeApi.listPlans()`), showing name, period, status badge (draft/active/archived), and goal count (`goals_count` field, already returned by the list endpoint per `StrategicPlanService::list()`'s `withCount('goals')`).
- Create a new plan (`mandeApi.createPlan({ name, period, start_date, end_date, description })` — `status` defaults to `draft` server-side if omitted, per `StrategicPlanService::create()`).
- Edit a plan's name/period/dates/description (`mandeApi.updatePlan(id, data)`) — per `StrategicPlanService::update()`, archived plans reject edits with a 422 (`'Archived plans cannot be edited.'`); surface that error to the user via the existing toast pattern rather than a generic failure message.
- Activate a draft plan (`mandeApi.activatePlan(id)`) and archive an active one (`mandeApi.archivePlan(id)`) — both are simple action buttons, no confirmation modal needed for activate; use whatever confirm-dialog convention `indicators/page.tsx` already uses before archiving (archiving is not destructive to data, per the service's own comment, "retains all child records... nothing is deleted," but still changes visible availability for the PIF dropdown, so a confirm step is reasonable).
- Delete a plan (`mandeApi.deletePlan(id)`) — per `StrategicPlanService::delete()`, only `draft`-status plans can be deleted (422 otherwise); only show the delete action for draft plans in the UI, and still handle the 422 gracefully if it somehow occurs.
- Within an expanded/selected plan, list its Goals (`plan.goals`, already present when using `mandeApi.getPlan(id)` — call this when a plan row is expanded/clicked, don't rely on the list endpoint's data for goals since it doesn't include them).
- Add a goal to a plan (`mandeApi.addGoal(planId, { title, code, description })`).
- Delete a goal (`mandeApi.deleteNode("goal", goalId)`).

Gate all mutation actions (create/edit/activate/archive/delete plan; add/delete goal) behind the current user having `mande.admin` — read the existing permission-check mechanism used elsewhere in this codebase's frontend (e.g. how `edit/page.tsx` or another admin-gated page checks permissions client-side; if there's a `usePermissions()` hook or similar, use it — do not invent a new permission-checking mechanism). Users with only `mande.view` see the list read-only.

- [ ] **Step 3: Manually verify in the browser**

Navigate to `/mande/strategic-plan` (the sidebar link should now work rather than 404). Create a plan, activate it, add 2-3 goals, confirm they appear. Go to a PIF's edit page (from Task 4) and confirm the new plan/goals now appear in the cascading dropdown.

- [ ] **Step 4: Commit**

```bash
git add "web/app/(app)/mande/strategic-plan/page.tsx"
git commit -m "feat(mande): add Strategic Plan/Goal settings page, fulfilling the existing sidebar link"
```

---

## Phase 3: Multi-Step Edit Form

### Task 6: Extend the shared Stepper component with click navigation

**Files:**
- Modify: `web/components/ui/Stepper.tsx`
- Test: manual (this is a small, purely presentational change to a shared component used by `setup/page.tsx` and `imprest/[id]/page.tsx` — a full automated test suite for a UI component isn't established practice elsewhere in this file's usage, so verification is manual browser testing of both existing consumers plus the new one)

- [ ] **Step 1: Add the optional prop**

In `web/components/ui/Stepper.tsx`, change the `StepperProps` interface and the component:

```tsx
interface StepperProps {
  steps: Step[];
  currentStep: number; // 1-based
  onStepClick?: (step: number) => void; // 1-based; omit for read-only display
}

export function Stepper({ steps, currentStep, onStepClick }: StepperProps) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((step, index) => {
        const stepNum = index + 1;
        const isCompleted = stepNum < currentStep;
        const isActive = stepNum === currentStep;
        const clickable = typeof onStepClick === "function";

        return (
          <div key={index} className="flex items-center flex-1 last:flex-none">
            <div
              className={cn("flex flex-col items-center", clickable && "cursor-pointer")}
              onClick={clickable ? () => onStepClick!(stepNum) : undefined}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
            >
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all",
                isCompleted && "border-primary bg-primary text-white",
                isActive && "border-primary bg-white text-primary",
                !isCompleted && !isActive && "border-neutral-200 bg-white text-neutral-400"
              )}>
                {isCompleted ? (
                  <span className="material-symbols-outlined text-[16px]">check</span>
                ) : (
                  stepNum
                )}
              </div>
              <div className="mt-1.5 text-center">
                <p className={cn(
                  "text-xs font-medium whitespace-nowrap",
                  isActive ? "text-primary" : isCompleted ? "text-neutral-700" : "text-neutral-400"
                )}>
                  {step.label}
                </p>
              </div>
            </div>
            {index < steps.length - 1 && (
              <div className={cn(
                "h-0.5 flex-1 mx-2 mb-5 transition-colors",
                isCompleted ? "bg-primary" : "bg-neutral-200"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
```

The only behavioral change when `onStepClick` is omitted: none — `clickable` is `false`, no `onClick`/`role`/`tabIndex` are added, rendering is identical to before. This is the backward-compatibility guarantee for `setup/page.tsx` and `imprest/[id]/page.tsx`.

- [ ] **Step 2: Verify the two existing consumers are unaffected**

Run: `cd web && npx tsc --noEmit` — confirm no new type errors (both existing call sites, `<Stepper steps={STEPS} currentStep={step} />`, don't pass `onStepClick`, which is fine since it's optional).

Manually load `/setup` (or wherever it's reachable in this app's flow) and an imprest detail page, confirm both steppers render exactly as before (non-clickable, same visual appearance).

- [ ] **Step 3: Commit**

```bash
git add web/components/ui/Stepper.tsx
git commit -m "feat(ui): add optional click-navigation to the shared Stepper component"
```

---

### Task 7: Convert the PIF edit page into a step orchestrator

**Files:**
- Modify: `web/app/(app)/pif/[id]/edit/page.tsx`

This task does NOT move any field JSX yet (that's Tasks 8-12) — it only introduces the step state, the `Stepper` UI, and a placeholder render structure that Tasks 8-12 will fill in. This keeps each task's diff reviewable rather than one enormous rewrite.

- [ ] **Step 1: Add step state and the step list**

Near the top of the component (after the existing `const [submitting, setSubmitting] = useState(false);` line), add:

```tsx
const STEPS = [
  { label: "Activity & Classification" },
  { label: "Venue & Logistics" },
  { label: "People & Language Support" },
  { label: "Budget & Procurement" },
  { label: "Documents & Support Services" },
  { label: "Review & Submit" },
];
const [currentStep, setCurrentStep] = useState(1);
```

Add `import { Stepper } from "@/components/ui/Stepper";` to the imports.

- [ ] **Step 2: Render the Stepper and step-gated sections**

Find the component's main `return (...)` JSX. Immediately after the page header (title/breadcrumb, whatever currently sits at the top), add:

```tsx
<div className="rounded-xl bg-white border border-neutral-200 shadow-card p-4 mb-6">
  <Stepper steps={STEPS} currentStep={currentStep} onStepClick={setCurrentStep} />
</div>
```

Wrap each existing top-level section block (Activity Info fields, Venue, Budget variance, Personnel, Interpretation, Support services, Conflict of interest, Documents, Arrival/Departure — i.e. everything currently rendered unconditionally in the form) in a conditional render keyed to a step number, e.g.:

```tsx
{currentStep === 1 && (
  <>
    {/* existing Activity Info / Classification JSX stays here for now */}
  </>
)}
```

For this task, put ALL existing sections under `currentStep === 1` (a temporary, deliberately-wrong grouping) — Tasks 8-12 will each move one section's block to its correct step number. This is intentional: it means after this task, the page still works exactly as before as long as `currentStep === 1` (the default), and each subsequent task's diff is just "change `currentStep === 1` to `currentStep === N` for this one section's JSX block and cut it into its own file" rather than a single giant diff.

Add Next/Back buttons at the bottom, always visible:

```tsx
<div className="flex justify-between mt-6">
  <button type="button" onClick={() => setCurrentStep((s) => Math.max(1, s - 1))} disabled={currentStep === 1} className="btn-secondary px-4 py-2 text-sm disabled:opacity-40">Back</button>
  {currentStep < STEPS.length && (
    <button type="button" onClick={() => setCurrentStep((s) => Math.min(STEPS.length, s + 1))} className="btn-primary px-4 py-2 text-sm">Next</button>
  )}
</div>
```

(Match existing `btn-secondary`/`btn-primary` class usage already present elsewhere in this file rather than inventing new ones.)

- [ ] **Step 3: Verify nothing broke**

Run: `cd web && npx tsc --noEmit` — no new errors. Load an existing PIF's edit page in the browser: since everything is currently under `currentStep === 1` (the default), the page should look and behave exactly as before, PLUS a new Stepper bar at the top and Next/Back buttons at the bottom. Click through steps 2-6 in the Stepper — they should render empty (no content yet, since nothing's been moved there), which is expected and correct for this task.

- [ ] **Step 4: Commit**

```bash
git add "web/app/(app)/pif/[id]/edit/page.tsx"
git commit -m "feat(pif): introduce step orchestration to the edit form (all sections temporarily under step 1)"
```

---

### Task 8: Move Activity & Classification into Step 1

**Files:**
- Modify: `web/app/(app)/pif/[id]/edit/page.tsx`

- [ ] **Step 1: Identify the exact JSX to keep at step 1**

The "Activity & Classification" step keeps: title, dates, committee/organ, thematic area, activity format, summary/objectives, and the Strategic Pillar dropdown + Implementing Department dropdown built in Tasks 2 and 4. All of this JSX is already correctly positioned (it was part of the original top-of-form content, and Task 7 put everything under `currentStep === 1` as a starting point) — this task's real work is REMOVING everything else that doesn't belong in step 1 from that same `currentStep === 1` block, since Tasks 9-12 will each claim their own section.

- [ ] **Step 2: Cut the Venue section out of the step-1 block**

Find the JSX starting at the `<h2 className="text-sm font-bold text-neutral-900">Venue</h2>` heading (verify the current line number first — it was line 452 as of this plan's writing, but earlier tasks in this same plan may have shifted it; search for the heading text, don't assume the line number) through the end of that section's closing tag. Cut this block out of the `currentStep === 1` wrapper — it moves to Task 9, not deleted. For THIS task, temporarily relocate it into a new `{currentStep === 2 && (<>...</>)}` block in the same file (Task 9 will later extract it into its own component file — doing that split in two steps, "move to the right step number" then "extract to its own file," keeps each diff small and independently verifiable).

- [ ] **Step 3: Repeat for the remaining sections**

Using the same cut-and-relabel approach, move each remaining section's JSX (search for its heading text to find current boundaries, don't rely on stale line numbers) into the correct step wrapper:
- "Budget variance" heading → `currentStep === 4`
- "Personnel & consultants" heading → `currentStep === 3`
- "Interpretation & translation" heading → `currentStep === 3`
- "Support services" heading → `currentStep === 5`
- "Conflict of interest" heading → `currentStep === 6`
- "Documents" heading (the `DocumentsSection` usage) → `currentStep === 5`
- "Arrival / Departure" heading (the `ArrivalDepartureSection` usage) → `currentStep === 2`

After this task, `currentStep === 1` contains ONLY the Activity & Classification fields; every other section is under its correct step number but still inline in this one file (not yet split into separate component files — that's Tasks 9-12).

- [ ] **Step 4: Verify in the browser**

Click through all 6 steps. Step 1 shows only activity/classification fields. Steps 2-5 show their respective sections (correctly grouped, per the mapping above). Step 6 shows only Conflict of Interest for now (Review/Declaration/Submit content is added in Task 12). Fill a field in each step, save, reload, confirm persistence — since nothing about HOW fields save has changed (same state variables, same `programmeApi.update()` call), this should work identically to before.

- [ ] **Step 5: Commit**

```bash
git add "web/app/(app)/pif/[id]/edit/page.tsx"
git commit -m "feat(pif): regroup existing form sections under their correct wizard steps"
```

---

### Task 9: Extract Step 2 (Venue & Logistics) into its own component

**Files:**
- Create: `web/app/(app)/pif/[id]/edit/Step2VenueLogistics.tsx`
- Modify: `web/app/(app)/pif/[id]/edit/page.tsx`

- [ ] **Step 1: Identify the Venue state variables**

From the earlier `wc -l`/grep inspection of this file, the Venue-related state block starts at the line commented `// Venue` (line 35 as of this plan's writing — re-verify, since Tasks 7-8 shifted line numbers) and includes every `useState` declared before the next section comment (`// Budget variance`). List them out by reading that exact block in the CURRENT file state (after Task 8's edits) before writing the new component — do not guess the variable names from this plan's earlier exploration, since exact names matter for wiring.

- [ ] **Step 2: Create the new component**

Create `web/app/(app)/pif/[id]/edit/Step2VenueLogistics.tsx` as a client component. It receives the Venue state values and their setters as props (lifted state — the parent `page.tsx` keeps owning the state, this component just renders controlled inputs and calls the passed setters, exactly like `DocumentsSection`/`ArrivalDepartureSection` already do for their own concerns), plus whatever props `ArrivalDepartureSection` itself needs (`programmeId`, `initialRows`, `onToast` — already established in that component's existing interface, unchanged):

```tsx
"use client";

import ArrivalDepartureSection from "./ArrivalDepartureSection";
import type { ProgrammeArrivalDeparture } from "@/lib/api";

interface Step2Props {
  venueCountry: string; setVenueCountry: (v: string) => void;
  venueCity: string; setVenueCity: (v: string) => void;
  // ... one pair per Venue state variable identified in Step 1 — enumerate every
  // single one here explicitly (do not abbreviate with "...rest of venue fields",
  // every prop must be named so the parent's prop-passing and this component's
  // destructuring line up exactly)
  programmeId: number;
  initialArrivalDepartureRows: ProgrammeArrivalDeparture[];
  onToast: (msg: string) => void;
}

export default function Step2VenueLogistics(props: Step2Props) {
  return (
    <>
      {/* Move the exact Venue section JSX (the block identified in Task 8, Step 2)
          here verbatim, replacing each state variable reference (e.g. `venueCountry`)
          with `props.venueCountry`, and each setter call (e.g. `setVenueCountry(...)`)
          with `props.setVenueCountry(...)`. */}
      <ArrivalDepartureSection
        programmeId={props.programmeId}
        initialRows={props.initialArrivalDepartureRows}
        onToast={props.onToast}
      />
    </>
  );
}
```

The implementer must fill in the exact prop list and the exact moved JSX by reading the real current file — this plan cannot enumerate every one of the ~12 Venue field names without risking a stale mismatch against whatever Tasks 7-8 actually produced. This is the one place in this plan where "read the current file and mirror its exact shape" is the instruction, rather than literal code, because the source is deterministic and inspectable, and reproducing ~70 lines of already-established, unchanged JSX here would risk drifting from what Task 8 actually wrote.

- [ ] **Step 3: Update page.tsx to use the new component**

In `page.tsx`, replace the `currentStep === 2` block's inline JSX with:

```tsx
{currentStep === 2 && (
  <Step2VenueLogistics
    venueCountry={venueCountry} setVenueCountry={setVenueCountry}
    /* ...one line per prop, matching Step 2's interface exactly... */
    programmeId={Number(id)}
    initialArrivalDepartureRows={programme?.arrival_departures ?? []}
    onToast={showToast}
  />
)}
```

Add `import Step2VenueLogistics from "./Step2VenueLogistics";` to the imports. Remove the now-redundant direct `import ArrivalDepartureSection from "./ArrivalDepartureSection";` from `page.tsx` if nothing else in that file uses it directly anymore (it's now only used inside `Step2VenueLogistics.tsx`).

- [ ] **Step 4: Verify in the browser**

Step 2 renders identically to before this extraction (same fields, same Arrival/Departure rows, same save behavior). `npx tsc --noEmit` shows no new errors — this is the most important check here, since a prop-name mismatch between `page.tsx`'s usage and `Step2VenueLogistics`'s interface is exactly the kind of error TypeScript catches immediately.

- [ ] **Step 5: Commit**

```bash
git add "web/app/(app)/pif/[id]/edit/page.tsx" "web/app/(app)/pif/[id]/edit/Step2VenueLogistics.tsx"
git commit -m "refactor(pif): extract Venue & Logistics into its own step component"
```

---

### Task 10: Extract Step 3 (People & Language Support) into its own component

**Files:**
- Create: `web/app/(app)/pif/[id]/edit/Step3PeopleLanguage.tsx`
- Modify: `web/app/(app)/pif/[id]/edit/page.tsx`

- [ ] **Step 1-5: Follow the identical procedure established in Task 9**

Apply the exact same pattern as Task 9 (identify state variables under the `// Personnel / consultants` and `// Interpretation / translation` comments in the current file, create the component with one prop pair per variable, move the JSX verbatim with `props.` prefixing, update `page.tsx`'s `currentStep === 3` block to use it, verify via `tsc --noEmit` and browser check, commit). This step has no `ArrivalDepartureSection`/`DocumentsSection`-style child component to wire — it's purely lifted state and moved JSX, which is more mechanical than Task 9, not less.

Commit message: `refactor(pif): extract People & Language Support into its own step component`

---

### Task 11: Extract Step 4 (Budget & Procurement) into its own component

**Files:**
- Create: `web/app/(app)/pif/[id]/edit/Step4BudgetProcurement.tsx`
- Modify: `web/app/(app)/pif/[id]/edit/page.tsx`

- [ ] **Step 1-5: Follow the identical procedure established in Task 9**

Same pattern, applied to the `// Budget variance` state block and whatever Procurement-item-related JSX/state exists in the current file (check for a `ProcurementItemsSection`-equivalent — if procurement items are managed inline in `page.tsx` rather than via a separate already-built component like Documents/ArrivalDeparture, read the current file to confirm before assuming a child component exists to reuse; if there is no such component, this step's JSX is purely inline fields moved verbatim, same as Task 10).

Commit message: `refactor(pif): extract Budget & Procurement into its own step component`

---

### Task 12: Extract Step 5 (Documents & Support Services) into its own component

**Files:**
- Create: `web/app/(app)/pif/[id]/edit/Step5DocumentsSupport.tsx`
- Modify: `web/app/(app)/pif/[id]/edit/page.tsx`

- [ ] **Step 1-5: Follow the identical procedure established in Task 9**

Same pattern, applied to the `// Support services` state block plus the `DocumentsSection` usage (wire it through exactly as `ArrivalDepartureSection` was wired through in Task 9 — same `programmeId`/`initialRows`/`tenantUsers`/`onToast` prop shape, already established in `DocumentsSection`'s existing interface).

Commit message: `refactor(pif): extract Documents & Support Services into its own step component`

---

### Task 13: Build Step 6 (Review, Compliance & Submit) and relocate the declaration/submit action

**Files:**
- Create: `web/app/(app)/pif/[id]/edit/Step6ReviewSubmit.tsx`
- Modify: `web/app/(app)/pif/[id]/edit/page.tsx`
- Modify: `web/app/(app)/pif/[id]/page.tsx`
- Test: `web/tests/e2e/pif-sections.spec.ts` (update)

This is the one step with genuinely new content (not just relocated existing JSX): a read-only review summary, plus the declaration checkbox and Submit button currently living on the view page.

- [ ] **Step 1: Read the current declaration/submit block on the view page**

In `web/app/(app)/pif/[id]/page.tsx`, read: the `DECLARATION_TEXT` constant (near the top of the file, alongside the other badge-label constant maps), the `declarationConfirmed` state (in the main component), the `handleSubmitProgramme` function, and the JSX block rendering the declaration checkbox + Submit button (inside the "Actions" card, gated on `programme.status === "draft"`). Confirm the exact current line numbers before editing, since this plan's earlier exploration may be stale relative to any changes made in Tasks 1-12 (unlikely to have touched this file, but verify).

- [ ] **Step 2: Build Step6ReviewSubmit.tsx**

```tsx
"use client";

import { useState } from "react";
import { programmeApi, type Programme } from "@/lib/api";

const DECLARATION_TEXT =
  "I confirm that this PIF relates to one activity, the information provided is accurate to the best of my knowledge, required supporting documents have been included, and any known conflict of interest has been disclosed.";

interface Step6Props {
  programme: Programme;
  conflictDeclared: boolean; setConflictDeclared: (v: boolean) => void;
  conflictDetails: string; setConflictDetails: (v: string) => void;
  conflictMitigation: string; setConflictMitigation: (v: string) => void;
  onSubmitted: () => void;
  onToast: (msg: string) => void;
}

export default function Step6ReviewSubmit({
  programme, conflictDeclared, setConflictDeclared, conflictDetails, setConflictDetails,
  conflictMitigation, setConflictMitigation, onSubmitted, onToast,
}: Step6Props) {
  const [declarationConfirmed, setDeclarationConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!declarationConfirmed) return;
    setSubmitting(true);
    try {
      await programmeApi.submit(programme.id, { declaration_confirmed: declarationConfirmed });
      onToast("Programme submitted for approval.");
      onSubmitted();
    } catch (err: any) {
      onToast(err?.response?.data?.message || "Failed to submit.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-neutral-900 mb-3">Review</h3>
        <p className="text-sm text-neutral-500">
          Review each step using the stepper above before submitting. Once submitted, this PIF moves into the approval workflow and can no longer be edited directly.
        </p>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-neutral-900 mb-3">Conflict of Interest</h3>
        <label className="flex items-start gap-2 cursor-pointer mb-3">
          <input
            type="checkbox"
            checked={conflictDeclared}
            onChange={(e) => setConflictDeclared(e.target.checked)}
            className="mt-0.5 rounded border-neutral-300"
          />
          <span className="text-sm font-medium text-neutral-800">A conflict of interest applies to this activity.</span>
        </label>
        {conflictDeclared && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-neutral-500">Details</label>
              <textarea value={conflictDetails} onChange={(e) => setConflictDetails(e.target.value)} className="input-field w-full" rows={2} />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-500">Mitigation</label>
              <textarea value={conflictMitigation} onChange={(e) => setConflictMitigation(e.target.value)} className="input-field w-full" rows={2} />
            </div>
          </div>
        )}
      </div>

      {programme.status === "draft" && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-neutral-900 mb-4">Declaration & Submit</h3>
          <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">Declaration</p>
            <p className="text-sm text-neutral-700 mb-3">{DECLARATION_TEXT}</p>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={declarationConfirmed}
                onChange={(e) => setDeclarationConfirmed(e.target.checked)}
                className="mt-0.5 rounded border-neutral-300"
              />
              <span className="text-sm font-medium text-neutral-800">I confirm the declaration above.</span>
            </label>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !declarationConfirmed}
            className="btn-primary px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[16px]">send</span>
            Submit for Approval
          </button>
        </div>
      )}
    </>
  );
}
```

Match the actual `className`/badge-style conventions from the current file rather than the ones shown above if they differ (e.g. `card p-5` should already be an established class in this codebase per earlier PIF work — verify, don't assume it's exactly this string).

- [ ] **Step 3: Wire it into page.tsx's step 6**

The Conflict of Interest state (`conflictDeclared`, `setConflictDeclared`, `conflictDetails`, `setConflictDetails`, `conflictMitigation`, `setConflictMitigation`) already exists in `page.tsx` from before this plan's changes (it was already part of the flat form, per the earlier PIF Module Completion plan's Task 20) — it stays owned by `page.tsx`, just passed down as props, same lifted-state pattern as every other step. Replace the `currentStep === 6` block:

```tsx
{currentStep === 6 && programme && (
  <Step6ReviewSubmit
    programme={programme}
    conflictDeclared={conflictDeclared} setConflictDeclared={setConflictDeclared}
    conflictDetails={conflictDetails} setConflictDetails={setConflictDetails}
    conflictMitigation={conflictMitigation} setConflictMitigation={setConflictMitigation}
    onSubmitted={() => router.push(`/pif/${id}`)}
    onToast={showToast}
  />
)}
```

Add `import Step6ReviewSubmit from "./Step6ReviewSubmit";`. On successful submit, navigate to the view page (`/pif/{id}`) — since the PIF is no longer a draft after submission, there's nothing further to edit, and the view page is where approval-stage information (workflow history, approve/reject actions for approvers) lives.

- [ ] **Step 4: Remove the declaration/submit block from the view page**

In `web/app/(app)/pif/[id]/page.tsx`, remove: the `declarationConfirmed` state, the `handleSubmitProgramme` function, the `DECLARATION_TEXT` constant, and the JSX block (the `programme.status === "draft"` conditional rendering the declaration checkbox and the `programme.status === "draft"` conditional Submit button inside the Actions card) — per the exact locations read in Step 1. Do NOT remove the rest of the Actions card (the `submitted`/`approved`/`rejected`-status button blocks, Approve/Reject/Amend actions) — only the draft-specific declaration+submit piece moves out.

A draft-status PIF is now edited exclusively via `/pif/{id}/edit`, so by the time a user reaches `/pif/{id}` (the view page) for a draft record, the Actions card simply has nothing to show for the `draft` case anymore — verify this doesn't leave a jarring empty gap; if the surrounding "no actions available" fallback logic (mentioned in earlier PIF work as already handling an analogous case) needs to also account for `draft` now having no view-page action, adjust that fallback condition.

- [ ] **Step 5: Manually verify the full flow end-to-end**

Create a new PIF (draft-first flow from the earlier plan, unchanged). Walk through all 6 steps, filling at least one field per step. On step 6, check the declaration checkbox, click Submit. Confirm: the PIF's status changes to `submitted`, you're redirected to `/pif/{id}`, and the view page's Approval tab no longer shows a declaration/submit UI for this now-submitted record (since it only ever showed for `draft` status, which no longer applies).

- [ ] **Step 6: Update the e2e spec**

`web/tests/e2e/pif-sections.spec.ts` (built in the earlier PIF Module Completion plan) currently expects to find the declaration checkbox and Submit button on the VIEW page's Approval tab. Update it to instead find them on the edit page's step 6 (after navigating through the stepper, or directly setting `currentStep` via whatever mechanism the test already uses to interact with the page — read the existing spec first to match its established interaction style, e.g. Playwright locators keyed by label text via `sectionByHeading`-style helpers already established there). Run: `cd web && npx playwright test tests/e2e/pif-sections.spec.ts` and confirm it passes against the restructured form. Fix the test, not the app, if the test's expectations are simply stale about WHERE things are — the underlying behavior (fill sections, add rows, confirm declaration, submit, verify M&E status "Not Yet Linked") is unchanged, only the page/step location of the submit action moved.

- [ ] **Step 7: Commit**

```bash
git add "web/app/(app)/pif/[id]/edit/page.tsx" "web/app/(app)/pif/[id]/edit/Step6ReviewSubmit.tsx" \
        "web/app/(app)/pif/[id]/page.tsx" web/tests/e2e/pif-sections.spec.ts
git commit -m "feat(pif): add Review & Submit step, relocating declaration/submit from the view page into the wizard"
```

---

### Task 14: Full regression pass

**Files:** none (verification task)

- [ ] **Step 1: Backend regression**

Run: `cd api && php artisan test` (confirm no other php.exe process running first). Compare against the established baseline from the earlier PIF Module Completion plan (565 passed, 34 pre-existing failures in Finance/Imprest/Readiness, unrelated to PIF). Expect: same 34 pre-existing failures, plus all tests from this plan's Task 3 now passing, no NEW failures. Investigate and fix any new failure — do not dismiss it as unrelated without checking.

- [ ] **Step 2: Frontend regression**

Run: `cd web && npx tsc --noEmit` (zero errors) and `npx playwright test tests/e2e/pif-sections.spec.ts` (passes). If other existing e2e specs touch the PIF module (grep `web/tests/e2e/` for any other spec referencing `/pif`), run those too and fix any that broke from the Submit-action relocation.

- [ ] **Step 3: Manual smoke test of all three phases together**

In the browser: confirm the sidebar shows "PIF / Activity Approvals"; create a new PIF, select an Implementing Department (from the real HR list) and a Strategic Plan/Pillar (from the new settings page's data) on step 1; fill through all 6 steps; submit on step 6; confirm the submitted PIF's view page shows the correct department and strategic pillar/goal.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve regressions surfaced by full regression pass on PIF UX overhaul"
```
(Only if fixes were needed.)

---

## Self-Review Notes

**Spec coverage:** Menu rename (Task 1) ✓. Implementing Department reuse (Task 2) ✓. Strategic Pillar → M&E linking: schema (Task 3), form field (Task 4), settings page (Task 5) ✓. Multi-step form: Stepper extension (Task 6), orchestration (Task 7), all 6 steps built/extracted (Tasks 8-13), Submit relocation (Task 13) ✓. Full regression (Task 14) ✓.

**Known follow-up not in this plan, flagged per the design spec's "Explicitly Out of Scope":** `PIF_STRATEGIC_PILLARS`/`SUPPORT_DEPARTMENTS` constants in `lib/constants.ts` are left as (now partially dead) code — only `DEPARTMENTS` and `PIF_STRATEGIC_PILLARS`'s consumption by the form is removed by Tasks 2 and 4; the constants themselves aren't deleted from the file, matching the spec's explicit deferral of that cleanup.

**Task 9-12 pattern risk, named explicitly for whoever executes this plan:** Tasks 9 through 12 rely on the implementer reading the CURRENT state of `page.tsx` at execution time (after Tasks 7-8's edits) rather than this plan reproducing exact line numbers, because a 850+ line file's exact line numbers are not stable across several preceding edits in the same plan. This is a deliberate choice, not an oversight — each of those tasks' Step 1 explicitly instructs re-reading the file fresh before extracting, and `tsc --noEmit` after each task is the safety net that catches any prop-name mismatch immediately.
