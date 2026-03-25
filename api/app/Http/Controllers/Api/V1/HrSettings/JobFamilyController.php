<?php

namespace App\Http\Controllers\Api\V1\HrSettings;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\HrJobFamily;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class JobFamilyController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', HrJobFamily::class);

        $families = HrJobFamily::withCount('gradeBands')
            ->where('tenant_id', $request->user()->tenant_id)
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $families]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', HrJobFamily::class);

        $data = $request->validate([
            'name'        => ['required', 'string', 'max:100'],
            'code'        => ['required', 'string', 'max:20'],
            'description' => ['nullable', 'string'],
            'color'       => ['nullable', 'string', 'max:7', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'icon'        => ['nullable', 'string', 'max:50'],
            'status'      => ['nullable', 'in:active,inactive'],
        ]);

        $family = HrJobFamily::create([
            'tenant_id' => $request->user()->tenant_id,
            ...$data,
        ]);

        AuditLog::record('hr_settings.job_family.created', [
            'auditable_type' => HrJobFamily::class,
            'auditable_id'   => $family->id,
            'new_values'     => $data,
            'tags'           => 'hr_settings',
        ]);

        return response()->json(['message' => 'Job family created.', 'data' => $family], 201);
    }

    public function show(Request $request, HrJobFamily $jobFamily): JsonResponse
    {
        $this->authorize('view', $jobFamily);

        return response()->json(['data' => $jobFamily->loadCount('gradeBands')]);
    }

    public function update(Request $request, HrJobFamily $jobFamily): JsonResponse
    {
        $this->authorize('update', $jobFamily);

        $data = $request->validate([
            'name'        => ['sometimes', 'string', 'max:100'],
            'code'        => ['sometimes', 'string', 'max:20'],
            'description' => ['nullable', 'string'],
            'color'       => ['nullable', 'string', 'max:7', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'icon'        => ['nullable', 'string', 'max:50'],
            'status'      => ['nullable', 'in:active,inactive'],
        ]);

        $old = $jobFamily->only(array_keys($data));
        $jobFamily->update($data);

        AuditLog::record('hr_settings.job_family.updated', [
            'auditable_type' => HrJobFamily::class,
            'auditable_id'   => $jobFamily->id,
            'old_values'     => $old,
            'new_values'     => $data,
            'tags'           => 'hr_settings',
        ]);

        return response()->json(['message' => 'Job family updated.', 'data' => $jobFamily->fresh()]);
    }

    public function destroy(HrJobFamily $jobFamily): JsonResponse
    {
        $this->authorize('delete', $jobFamily);

        if ($jobFamily->gradeBands()->exists()) {
            return response()->json(['message' => 'Cannot delete a job family linked to grade bands.'], 422);
        }

        $jobFamily->delete();

        AuditLog::record('hr_settings.job_family.deleted', [
            'auditable_type' => HrJobFamily::class,
            'auditable_id'   => $jobFamily->id,
            'tags'           => 'hr_settings',
        ]);

        return response()->json(['message' => 'Job family deleted.']);
    }
}
