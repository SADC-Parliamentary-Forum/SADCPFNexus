<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Department;
use App\Models\Position;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SetupController extends Controller
{
    /**
     * GET /setup/options
     * Returns active departments and positions for the current tenant.
     * Accessible to any authenticated user (used to populate Step 1 dropdowns).
     */
    public function options(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $departments = Department::where('tenant_id', $tenantId)
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        $positions = Position::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->orderBy('department_id')
            ->orderBy('title')
            ->get(['id', 'department_id', 'title', 'grade']);

        return response()->json([
            'departments' => $departments,
            'positions'   => $positions,
        ]);
    }

    /**
     * PUT /setup/identity
     * Updates identity fields during the setup wizard.
     * Records an audit log with before/after values for each changed field.
     * This is the only window where users may edit name, email, department, and position
     * without going through the profile-change-request workflow.
     */
    public function updateIdentity(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name'            => ['required', 'string', 'max:255'],
            'email'           => ['required', 'email', 'max:255', 'unique:users,email,' . $user->id],
            'employee_number' => ['nullable', 'string', 'max:50'],
            'department_id'   => ['nullable', 'integer', 'exists:departments,id'],
            'position_id'     => ['nullable', 'integer', 'exists:positions,id'],
        ]);

        // Capture before values for audit
        $oldValues = [
            'name'            => $user->name,
            'email'           => $user->email,
            'employee_number' => $user->employee_number,
            'department_id'   => $user->department_id,
            'position_id'     => $user->position_id,
        ];

        $user->update($validated);

        // Only audit fields that actually changed
        $changed = array_filter(
            $validated,
            fn ($v, $k) => ($oldValues[$k] ?? null) != $v,
            ARRAY_FILTER_USE_BOTH
        );

        if (!empty($changed)) {
            AuditLog::record('setup.identity_updated', [
                'auditable_type' => User::class,
                'auditable_id'   => $user->id,
                'old_values'     => array_intersect_key($oldValues, $changed),
                'new_values'     => $changed,
                'tags'           => 'setup',
            ]);
        }

        return response()->json([
            'message' => 'Identity updated.',
            'user'    => $user->fresh(['department', 'position']),
        ]);
    }

    /**
     * POST /setup/complete
     * Marks setup_completed = true. Idempotent.
     */
    public function complete(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->setup_completed) {
            $user->update(['setup_completed' => true]);

            AuditLog::record('setup.completed', [
                'auditable_type' => User::class,
                'auditable_id'   => $user->id,
                'tags'           => 'setup',
            ]);
        }

        return response()->json([
            'message'         => 'Setup completed.',
            'setup_completed' => true,
        ]);
    }
}
