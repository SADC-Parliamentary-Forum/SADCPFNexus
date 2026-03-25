<?php

namespace App\Http\Controllers\Api\V1\HrSettings;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\HrLeaveProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LeaveProfileController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', HrLeaveProfile::class);

        $items = HrLeaveProfile::where('tenant_id', $request->user()->tenant_id)
            ->orderBy('profile_name')
            ->get();

        return response()->json(['data' => $items]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', HrLeaveProfile::class);

        $data = $request->validate([
            'profile_code'       => ['required', 'string', 'max:20'],
            'profile_name'       => ['required', 'string', 'max:100'],
            'annual_leave_days'  => ['nullable', 'numeric', 'min:0', 'max:365'],
            'sick_leave_days'    => ['nullable', 'numeric', 'min:0', 'max:365'],
            'lil_days'           => ['nullable', 'numeric', 'min:0', 'max:365'],
            'special_leave_days' => ['nullable', 'numeric', 'min:0', 'max:30'],
            'maternity_days'     => ['nullable', 'integer', 'min:0', 'max:365'],
            'paternity_days'     => ['nullable', 'integer', 'min:0', 'max:30'],
            'is_active'          => ['nullable', 'boolean'],
        ]);

        $model = HrLeaveProfile::create([
            'tenant_id' => $request->user()->tenant_id,
            ...$data,
        ]);

        AuditLog::record('hr_settings.leave_profile.created', [
            'auditable_type' => HrLeaveProfile::class,
            'auditable_id'   => $model->id,
            'new_values'     => $data,
            'tags'           => 'hr_settings',
        ]);

        return response()->json(['message' => 'Leave profile created.', 'data' => $model], 201);
    }

    public function show(Request $request, HrLeaveProfile $leaveProfile): JsonResponse
    {
        $this->authorize('view', $leaveProfile);

        return response()->json(['data' => $leaveProfile]);
    }

    public function update(Request $request, HrLeaveProfile $leaveProfile): JsonResponse
    {
        $this->authorize('update', $leaveProfile);

        $data = $request->validate([
            'profile_code'       => ['sometimes', 'string', 'max:20'],
            'profile_name'       => ['sometimes', 'string', 'max:100'],
            'annual_leave_days'  => ['nullable', 'numeric', 'min:0', 'max:365'],
            'sick_leave_days'    => ['nullable', 'numeric', 'min:0', 'max:365'],
            'lil_days'           => ['nullable', 'numeric', 'min:0', 'max:365'],
            'special_leave_days' => ['nullable', 'numeric', 'min:0', 'max:30'],
            'maternity_days'     => ['nullable', 'integer', 'min:0', 'max:365'],
            'paternity_days'     => ['nullable', 'integer', 'min:0', 'max:30'],
            'is_active'          => ['nullable', 'boolean'],
        ]);

        $old = $leaveProfile->only(array_keys($data));
        $leaveProfile->update($data);

        AuditLog::record('hr_settings.leave_profile.updated', [
            'auditable_type' => HrLeaveProfile::class,
            'auditable_id'   => $leaveProfile->id,
            'old_values'     => $old,
            'new_values'     => $data,
            'tags'           => 'hr_settings',
        ]);

        return response()->json(['message' => 'Leave profile updated.', 'data' => $leaveProfile->fresh()]);
    }

    public function destroy(HrLeaveProfile $leaveProfile): JsonResponse
    {
        $this->authorize('delete', $leaveProfile);

        if ($leaveProfile->gradeBands()->exists()) {
            return response()->json(['message' => 'Cannot delete a leave profile linked to grade bands.'], 422);
        }

        $leaveProfile->delete();

        AuditLog::record('hr_settings.leave_profile.deleted', [
            'auditable_type' => HrLeaveProfile::class,
            'auditable_id'   => $leaveProfile->id,
            'tags'           => 'hr_settings',
        ]);

        return response()->json(['message' => 'Leave profile deleted.']);
    }
}
