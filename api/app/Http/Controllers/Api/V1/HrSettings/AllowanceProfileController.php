<?php

namespace App\Http\Controllers\Api\V1\HrSettings;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\HrAllowanceProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AllowanceProfileController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', HrAllowanceProfile::class);

        $items = HrAllowanceProfile::where('tenant_id', $request->user()->tenant_id)
            ->orderBy('profile_name')
            ->get();

        return response()->json(['data' => $items]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', HrAllowanceProfile::class);

        $data = $request->validate([
            'profile_code'             => ['required', 'string', 'max:20'],
            'profile_name'             => ['required', 'string', 'max:100'],
            'currency'                 => ['nullable', 'string', 'size:3'],
            'transport_allowance'      => ['nullable', 'numeric', 'min:0'],
            'housing_allowance'        => ['nullable', 'numeric', 'min:0'],
            'communication_allowance'  => ['nullable', 'numeric', 'min:0'],
            'medical_allowance'        => ['nullable', 'numeric', 'min:0'],
            'subsistence_allowance'    => ['nullable', 'numeric', 'min:0'],
            'notes'                    => ['nullable', 'string'],
            'is_active'                => ['nullable', 'boolean'],
        ]);

        $model = HrAllowanceProfile::create([
            'tenant_id' => $request->user()->tenant_id,
            ...$data,
        ]);

        AuditLog::record('hr_settings.allowance_profile.created', [
            'auditable_type' => HrAllowanceProfile::class,
            'auditable_id'   => $model->id,
            'new_values'     => $data,
            'tags'           => 'hr_settings',
        ]);

        return response()->json(['message' => 'Allowance profile created.', 'data' => $model], 201);
    }

    public function show(Request $request, HrAllowanceProfile $allowanceProfile): JsonResponse
    {
        $this->authorize('view', $allowanceProfile);

        return response()->json(['data' => $allowanceProfile]);
    }

    public function update(Request $request, HrAllowanceProfile $allowanceProfile): JsonResponse
    {
        $this->authorize('update', $allowanceProfile);

        $data = $request->validate([
            'profile_code'             => ['sometimes', 'string', 'max:20'],
            'profile_name'             => ['sometimes', 'string', 'max:100'],
            'currency'                 => ['nullable', 'string', 'size:3'],
            'transport_allowance'      => ['nullable', 'numeric', 'min:0'],
            'housing_allowance'        => ['nullable', 'numeric', 'min:0'],
            'communication_allowance'  => ['nullable', 'numeric', 'min:0'],
            'medical_allowance'        => ['nullable', 'numeric', 'min:0'],
            'subsistence_allowance'    => ['nullable', 'numeric', 'min:0'],
            'notes'                    => ['nullable', 'string'],
            'is_active'                => ['nullable', 'boolean'],
        ]);

        $old = $allowanceProfile->only(array_keys($data));
        $allowanceProfile->update($data);

        AuditLog::record('hr_settings.allowance_profile.updated', [
            'auditable_type' => HrAllowanceProfile::class,
            'auditable_id'   => $allowanceProfile->id,
            'old_values'     => $old,
            'new_values'     => $data,
            'tags'           => 'hr_settings',
        ]);

        return response()->json(['message' => 'Allowance profile updated.', 'data' => $allowanceProfile->fresh()]);
    }

    public function destroy(HrAllowanceProfile $allowanceProfile): JsonResponse
    {
        $this->authorize('delete', $allowanceProfile);

        if ($allowanceProfile->gradeBands()->exists()) {
            return response()->json(['message' => 'Cannot delete an allowance profile linked to grade bands.'], 422);
        }

        $allowanceProfile->delete();

        AuditLog::record('hr_settings.allowance_profile.deleted', [
            'auditable_type' => HrAllowanceProfile::class,
            'auditable_id'   => $allowanceProfile->id,
            'tags'           => 'hr_settings',
        ]);

        return response()->json(['message' => 'Allowance profile deleted.']);
    }
}
