<?php

namespace App\Http\Controllers\Api\V1\Srhr;

use App\Http\Controllers\Controller;
use App\Models\StaffDeployment;
use App\Modules\Srhr\Services\DeploymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StaffDeploymentController extends Controller
{
    public function __construct(private DeploymentService $service) {}

    private function checkPerm(Request $request, string $permission): void
    {
        $user = $request->user();
        if (!$user->isSystemAdmin()) {
            abort_unless($user->hasPermissionTo($permission, 'sanctum'), 403);
        }
    }

    public function index(Request $request): JsonResponse
    {
        $this->checkPerm($request, 'srhr.view');
        $result = $this->service->list($request->all(), $request->user());
        return response()->json($result);
    }

    public function show(Request $request, StaffDeployment $staffDeployment): JsonResponse
    {
        $this->checkPerm($request, 'srhr.view');
        abort_unless((int) $staffDeployment->tenant_id === (int) $request->user()->tenant_id, 404);
        $deployment = $this->service->get($staffDeployment->id, $request->user());
        return response()->json(['data' => $deployment]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->checkPerm($request, 'srhr.create');

        $data = $request->validate([
            'employee_id'        => ['required', 'integer', 'exists:users,id'],
            'parliament_id'      => ['required', 'integer', 'exists:parliaments,id'],
            'deployment_type'    => ['sometimes', 'string', 'in:field_researcher,srhr_researcher,secondment,other'],
            'research_area'      => ['nullable', 'string', 'max:64'],
            'research_focus'     => ['nullable', 'string'],
            'start_date'         => ['required', 'date'],
            'end_date'           => ['nullable', 'date', 'after:start_date'],
            'supervisor_name'    => ['nullable', 'string', 'max:255'],
            'supervisor_title'   => ['nullable', 'string', 'max:255'],
            'supervisor_email'   => ['nullable', 'email', 'max:255'],
            'supervisor_phone'   => ['nullable', 'string', 'max:32'],
            'terms_of_reference' => ['nullable', 'string'],
            'payroll_active'     => ['sometimes', 'boolean'],
            'notes'              => ['nullable', 'string'],
        ]);

        $deployment = $this->service->create($data, $request->user());
        return response()->json(['message' => 'Deployment created.', 'data' => $deployment], 201);
    }

    public function update(Request $request, StaffDeployment $staffDeployment): JsonResponse
    {
        $this->checkPerm($request, 'srhr.manage');
        abort_unless((int) $staffDeployment->tenant_id === (int) $request->user()->tenant_id, 404);

        $data = $request->validate([
            'research_area'      => ['nullable', 'string', 'max:64'],
            'research_focus'     => ['nullable', 'string'],
            'end_date'           => ['nullable', 'date'],
            'supervisor_name'    => ['nullable', 'string', 'max:255'],
            'supervisor_title'   => ['nullable', 'string', 'max:255'],
            'supervisor_email'   => ['nullable', 'email', 'max:255'],
            'supervisor_phone'   => ['nullable', 'string', 'max:32'],
            'terms_of_reference' => ['nullable', 'string'],
            'payroll_active'     => ['sometimes', 'boolean'],
            'notes'              => ['nullable', 'string'],
        ]);

        $deployment = $this->service->update($staffDeployment, $data);
        return response()->json(['message' => 'Deployment updated.', 'data' => $deployment]);
    }

    public function destroy(Request $request, StaffDeployment $staffDeployment): JsonResponse
    {
        $this->checkPerm($request, 'srhr.admin');
        abort_unless((int) $staffDeployment->tenant_id === (int) $request->user()->tenant_id, 404);

        if ($staffDeployment->isActive()) {
            return response()->json(['message' => 'Recall or complete the deployment before deleting it.'], 422);
        }

        $staffDeployment->delete();
        return response()->json(['message' => 'Deployment deleted.']);
    }

    public function recall(Request $request, StaffDeployment $staffDeployment): JsonResponse
    {
        $this->checkPerm($request, 'srhr.manage');
        abort_unless((int) $staffDeployment->tenant_id === (int) $request->user()->tenant_id, 404);

        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:1000'],
            'recalled_reason' => ['nullable', 'string', 'max:1000'],
        ]);
        $reason = $data['reason'] ?? $data['recalled_reason'] ?? null;
        if (!$reason) {
            return response()->json([
                'message' => 'The reason field is required.',
                'errors' => ['reason' => ['The reason field is required.']],
            ], 422);
        }
        $deployment = $this->service->recall($staffDeployment, $reason, $request->user());
        return response()->json(['message' => 'Deployment recalled.', 'data' => $deployment]);
    }

    public function complete(Request $request, StaffDeployment $staffDeployment): JsonResponse
    {
        $this->checkPerm($request, 'srhr.manage');
        abort_unless((int) $staffDeployment->tenant_id === (int) $request->user()->tenant_id, 404);

        $deployment = $this->service->complete($staffDeployment, $request->user());
        return response()->json(['message' => 'Deployment marked as completed.', 'data' => $deployment]);
    }
}
