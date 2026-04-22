<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\EmployeeSalaryAssignment;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmployeeSalaryAssignmentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $authUser = $request->user();
        $this->authorise($authUser);

        $query = EmployeeSalaryAssignment::where('tenant_id', $authUser->tenant_id)
            ->with(['user:id,name,email', 'gradeBand:id,code,label', 'salaryScale:id,grade_band_id,currency'])
            ->orderByDesc('effective_from');

        if ($request->filled('user_id')) {
            $query->where('user_id', (int) $request->query('user_id'));
        }

        return response()->json(['data' => $query->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $authUser = $request->user();
        $this->authorise($authUser);

        $data = $request->validate([
            'user_id'         => ['required', 'integer', 'exists:users,id'],
            'grade_band_id'   => ['required', 'integer', 'exists:hr_grade_bands,id'],
            'salary_scale_id' => ['nullable', 'integer', 'exists:hr_salary_scales,id'],
            'notch_number'    => ['required', 'integer', 'min:1'],
            'effective_from'  => ['required', 'date'],
            'effective_to'    => ['nullable', 'date', 'after_or_equal:effective_from'],
            'employment_type' => ['nullable', 'string', 'max:32'],
            'notes'           => ['nullable', 'string', 'max:2000'],
        ]);

        // Tenant scope guard
        $targetUser = User::find($data['user_id']);
        abort_if(!$targetUser || (int) $targetUser->tenant_id !== (int) $authUser->tenant_id, 403, 'User not in your organisation.');

        $assignment = EmployeeSalaryAssignment::create(array_merge($data, [
            'tenant_id'  => $authUser->tenant_id,
            'created_by' => $authUser->id,
        ]));

        AuditLog::record('hr.salary_assignment.created', [
            'auditable_type' => EmployeeSalaryAssignment::class,
            'auditable_id'   => $assignment->id,
            'new_values'     => $data,
            'tags'           => 'hr_payslip',
        ]);

        return response()->json([
            'message' => 'Salary assignment created.',
            'data'    => $assignment->load(['user:id,name,email', 'gradeBand:id,code,label']),
        ], 201);
    }

    public function update(Request $request, EmployeeSalaryAssignment $salaryAssignment): JsonResponse
    {
        $authUser = $request->user();
        $this->authorise($authUser);
        abort_if((int) $salaryAssignment->tenant_id !== (int) $authUser->tenant_id, 403);

        $data = $request->validate([
            'grade_band_id'   => ['sometimes', 'integer', 'exists:hr_grade_bands,id'],
            'salary_scale_id' => ['nullable', 'integer', 'exists:hr_salary_scales,id'],
            'notch_number'    => ['sometimes', 'integer', 'min:1'],
            'effective_from'  => ['sometimes', 'date'],
            'effective_to'    => ['nullable', 'date'],
            'employment_type' => ['nullable', 'string', 'max:32'],
            'notes'           => ['nullable', 'string', 'max:2000'],
        ]);

        $salaryAssignment->update($data);

        AuditLog::record('hr.salary_assignment.updated', [
            'auditable_type' => EmployeeSalaryAssignment::class,
            'auditable_id'   => $salaryAssignment->id,
            'new_values'     => $data,
            'tags'           => 'hr_payslip',
        ]);

        return response()->json(['message' => 'Salary assignment updated.', 'data' => $salaryAssignment->fresh()]);
    }

    public function destroy(Request $request, EmployeeSalaryAssignment $salaryAssignment): JsonResponse
    {
        $authUser = $request->user();
        $this->authorise($authUser);
        abort_if((int) $salaryAssignment->tenant_id !== (int) $authUser->tenant_id, 403);

        $salaryAssignment->delete();

        return response()->json(['message' => 'Salary assignment removed.']);
    }

    private function authorise(User $user): void
    {
        abort_unless(
            $user->hasPermissionTo('hr.admin') || $user->hasPermissionTo('hr.edit') || $user->hasPermissionTo('hr_settings.edit'),
            403,
            'Access restricted to HR administrators.'
        );
    }
}
