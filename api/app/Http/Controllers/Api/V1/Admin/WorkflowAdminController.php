<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\ApprovalWorkflow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WorkflowAdminController extends Controller
{
    /**
     * Canonical catalogue of workflow-able module types. Any module that
     * participates in the approval engine should be configurable here, so the
     * admin UI is not limited to a hardcoded subset.
     *
     * @var array<string, string>
     */
    private const MODULE_CATALOGUE = [
        'leave' => 'Leave',
        'travel' => 'Travel & Missions',
        'imprest' => 'Imprest Advances',
        'salary_advance' => 'Salary Advance',
        'procurement' => 'Procurement Requests',
        'purchase_order' => 'Purchase Order / LPO',
        'supplier' => 'Supplier Registration',
        'contract' => 'Contracts',
        'finance' => 'Finance / Payments',
        'budget_submission' => 'Budget Submission',
        'timesheet' => 'Timesheets',
        'overtime' => 'Overtime',
        'hr' => 'HR Requests',
        'programmes' => 'Programmes (PIF)',
        'mande' => 'M&E Activity Reports',
        'weekly_report' => 'Weekly Reports',
        'correspondence' => 'Correspondence',
        'governance' => 'Governance',
        'decisions' => 'Decisions / Resolutions',
        'risk' => 'Risk Register',
        'assets' => 'Assets',
        'stock' => 'Stock / Consumables',
        'assignments' => 'Assignments',
        'lifecycle_appointment_authorise' => 'Lifecycle: Appointment Authorisation',
        'lifecycle_final_hr_clearance' => 'Lifecycle: Final HR Clearance',
    ];

    public function index(Request $request): JsonResponse
    {
        $workflows = ApprovalWorkflow::where('tenant_id', $request->user()->tenant_id)
            ->with('steps.role', 'steps.user')
            ->get();

        return response()->json(['data' => $workflows]);
    }

    /**
     * Module catalogue for the admin workflow editor: the canonical list unioned
     * with any module_type already present on this tenant's workflows, so every
     * configured workflow is always editable (fixes the "only a select few" gap).
     */
    public function moduleCatalogue(Request $request): JsonResponse
    {
        $catalogue = self::MODULE_CATALOGUE;

        $existing = ApprovalWorkflow::where('tenant_id', $request->user()->tenant_id)
            ->pluck('module_type')
            ->filter()
            ->unique();

        foreach ($existing as $moduleType) {
            if (! array_key_exists($moduleType, $catalogue)) {
                // Humanise unknown module keys so they remain selectable/editable.
                $catalogue[$moduleType] = ucwords(str_replace(['_', '-'], ' ', (string) $moduleType));
            }
        }

        $modules = collect($catalogue)
            ->map(fn (string $label, string $value) => ['value' => $value, 'label' => $label])
            ->sortBy('label')
            ->values();

        return response()->json(['data' => $modules]);
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()->isSystemAdmin(), 403, 'Insufficient privileges.');
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'module_type' => ['required', 'string', 'max:64'],
            'target_type' => ['nullable', 'in:programme,department'],
            'target_id' => ['nullable', 'integer'],
            'steps' => ['required', 'array', 'min:1'],
            'steps.*.approver_type' => ['required', 'string', 'in:supervisor,up_the_chain,specific_role,specific_user'],
            'steps.*.role_id' => ['required_if:steps.*.approver_type,specific_role', 'nullable', 'exists:roles,id'],
            'steps.*.user_id' => ['required_if:steps.*.approver_type,specific_user', 'nullable', 'exists:users,id'],
        ]);

        $workflow = DB::transaction(function () use ($data, $request) {
            $wf = ApprovalWorkflow::create([
                'tenant_id' => $request->user()->tenant_id,
                'name' => $data['name'],
                'module_type' => $data['module_type'],
                'target_type' => $data['target_type'] ?? null,
                'target_id' => $data['target_id'] ?? null,
            ]);

            foreach ($data['steps'] as $index => $stepData) {
                $wf->steps()->create([
                    'step_order' => $index,
                    'approver_type' => $stepData['approver_type'],
                    'role_id' => $stepData['role_id'] ?? null,
                    'user_id' => $stepData['user_id'] ?? null,
                ]);
            }

            return $wf;
        });

        return response()->json(['message' => 'Workflow created.', 'data' => $workflow->load('steps')], 201);
    }

    public function update(Request $request, ApprovalWorkflow $workflow): JsonResponse
    {
        abort_unless($request->user()->isSystemAdmin(), 403, 'Insufficient privileges.');
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
            'target_type' => ['nullable', 'in:programme,department'],
            'target_id' => ['nullable', 'integer'],
            'steps' => ['sometimes', 'array', 'min:1'],
            'steps.*.approver_type' => ['required_with:steps', 'string', 'in:supervisor,up_the_chain,specific_role,specific_user'],
            'steps.*.role_id' => ['required_if:steps.*.approver_type,specific_role', 'nullable', 'exists:roles,id'],
            'steps.*.user_id' => ['required_if:steps.*.approver_type,specific_user', 'nullable', 'exists:users,id'],
        ]);

        DB::transaction(function () use ($data, $workflow) {
            $updates = array_filter([
                'name' => $data['name'] ?? null,
                'is_active' => $data['is_active'] ?? null,
            ], fn ($v) => $v !== null);
            // Allow explicitly setting target_type/target_id to null
            if (array_key_exists('target_type', $data)) {
                $updates['target_type'] = $data['target_type'];
            }
            if (array_key_exists('target_id', $data)) {
                $updates['target_id'] = $data['target_id'];
            }
            $workflow->update($updates);

            if (isset($data['steps'])) {
                $workflow->steps()->delete();
                foreach ($data['steps'] as $index => $stepData) {
                    $workflow->steps()->create([
                        'step_order' => $index,
                        'approver_type' => $stepData['approver_type'],
                        'role_id' => $stepData['role_id'] ?? null,
                        'user_id' => $stepData['user_id'] ?? null,
                    ]);
                }
            }
        });

        return response()->json(['message' => 'Workflow updated.', 'data' => $workflow->load('steps')]);
    }

    public function destroy(Request $request, ApprovalWorkflow $workflow): JsonResponse
    {
        abort_unless($request->user()->isSystemAdmin(), 403, 'Insufficient privileges.');
        $workflow->delete();

        return response()->json(['message' => 'Workflow deleted.']);
    }
}
