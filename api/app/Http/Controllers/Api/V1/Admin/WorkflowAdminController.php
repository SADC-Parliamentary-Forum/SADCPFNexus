<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\ApprovalWorkflow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WorkflowAdminController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $workflows = ApprovalWorkflow::where('tenant_id', $request->user()->tenant_id)
            ->with('steps.role', 'steps.user')
            ->get();
            
        return response()->json(['data' => $workflows]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'module_type' => ['required', 'string', 'unique:approval_workflows,module_type,NULL,id,tenant_id,' . $request->user()->tenant_id],
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
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
            'steps' => ['sometimes', 'array', 'min:1'],
            'steps.*.approver_type' => ['required_with:steps', 'string', 'in:supervisor,up_the_chain,specific_role,specific_user'],
            'steps.*.role_id' => ['required_if:steps.*.approver_type,specific_role', 'nullable', 'exists:roles,id'],
            'steps.*.user_id' => ['required_if:steps.*.approver_type,specific_user', 'nullable', 'exists:users,id'],
        ]);

        DB::transaction(function () use ($data, $workflow) {
            $workflow->update(array_filter([
                'name' => $data['name'] ?? null,
                'is_active' => $data['is_active'] ?? null,
            ], fn($v) => $v !== null));

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
}
