<?php

namespace App\Http\Controllers\Api\V1\HrSettings;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\HrApprovalMatrix;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ApprovalMatrixController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', HrApprovalMatrix::class);

        $query = HrApprovalMatrix::where('tenant_id', $request->user()->tenant_id)
            ->with(['role', 'approverUser'])
            ->orderBy('module')
            ->orderBy('step_number');

        if ($request->filled('module')) {
            $query->where('module', $request->input('module'));
        }

        return response()->json(['data' => $query->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', HrApprovalMatrix::class);

        $data = $request->validate([
            'module'            => ['required', 'string', 'max:50'],
            'action_name'       => ['required', 'string', 'max:100'],
            'step_number'       => ['nullable', 'integer', 'min:1', 'max:10'],
            'role_id'           => ['nullable', 'integer', 'exists:roles,id'],
            'approver_user_id'  => ['nullable', 'integer', 'exists:users,id'],
            'is_mandatory'      => ['nullable', 'boolean'],
            'notes'             => ['nullable', 'string'],
            'is_active'         => ['nullable', 'boolean'],
        ]);

        $model = HrApprovalMatrix::create([
            'tenant_id' => $request->user()->tenant_id,
            ...$data,
        ]);

        AuditLog::record('hr_settings.approval_matrix.created', [
            'auditable_type' => HrApprovalMatrix::class,
            'auditable_id'   => $model->id,
            'new_values'     => $data,
            'tags'           => 'hr_settings',
        ]);

        return response()->json(['message' => 'Approval matrix entry created.', 'data' => $model->load(['role', 'approverUser'])], 201);
    }

    public function show(Request $request, HrApprovalMatrix $approvalMatrix): JsonResponse
    {
        $this->authorize('view', $approvalMatrix);

        return response()->json(['data' => $approvalMatrix->load(['role', 'approverUser'])]);
    }

    public function update(Request $request, HrApprovalMatrix $approvalMatrix): JsonResponse
    {
        $this->authorize('update', $approvalMatrix);

        $data = $request->validate([
            'module'            => ['sometimes', 'string', 'max:50'],
            'action_name'       => ['sometimes', 'string', 'max:100'],
            'step_number'       => ['nullable', 'integer', 'min:1', 'max:10'],
            'role_id'           => ['nullable', 'integer', 'exists:roles,id'],
            'approver_user_id'  => ['nullable', 'integer', 'exists:users,id'],
            'is_mandatory'      => ['nullable', 'boolean'],
            'notes'             => ['nullable', 'string'],
            'is_active'         => ['nullable', 'boolean'],
        ]);

        $old = $approvalMatrix->only(array_keys($data));
        $approvalMatrix->update($data);

        AuditLog::record('hr_settings.approval_matrix.updated', [
            'auditable_type' => HrApprovalMatrix::class,
            'auditable_id'   => $approvalMatrix->id,
            'old_values'     => $old,
            'new_values'     => $data,
            'tags'           => 'hr_settings',
        ]);

        return response()->json(['message' => 'Approval matrix entry updated.', 'data' => $approvalMatrix->fresh()->load(['role', 'approverUser'])]);
    }

    public function destroy(HrApprovalMatrix $approvalMatrix): JsonResponse
    {
        $this->authorize('delete', $approvalMatrix);

        $id = $approvalMatrix->id;
        $approvalMatrix->delete();

        AuditLog::record('hr_settings.approval_matrix.deleted', [
            'auditable_type' => HrApprovalMatrix::class,
            'auditable_id'   => $id,
            'tags'           => 'hr_settings',
        ]);

        return response()->json(['message' => 'Approval matrix entry deleted.']);
    }
}
