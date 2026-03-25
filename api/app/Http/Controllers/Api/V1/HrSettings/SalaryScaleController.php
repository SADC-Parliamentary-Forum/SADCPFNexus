<?php

namespace App\Http\Controllers\Api\V1\HrSettings;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\HrSalaryScale;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SalaryScaleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', HrSalaryScale::class);

        $query = HrSalaryScale::with('gradeBand')
            ->where('tenant_id', $request->user()->tenant_id);

        if ($request->filled('grade_band_id')) {
            $query->where('grade_band_id', $request->grade_band_id);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $results = $query->orderByDesc('effective_from')
            ->paginate($request->integer('per_page', 25));

        return response()->json($results);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', HrSalaryScale::class);

        $data = $request->validate([
            'grade_band_id'  => ['required', 'exists:hr_grade_bands,id'],
            'currency'       => ['nullable', 'string', 'size:3'],
            'notches'        => ['required', 'array', 'min:1', 'max:12'],
            'notches.*.notch'  => ['required', 'integer', 'min:1', 'max:12'],
            'notches.*.annual' => ['required', 'numeric', 'min:0'],
            'notches.*.monthly'=> ['required', 'numeric', 'min:0'],
            'effective_from' => ['required', 'date'],
            'effective_to'   => ['nullable', 'date', 'after:effective_from'],
            'notes'          => ['nullable', 'string'],
        ]);

        $scale = HrSalaryScale::create([
            'tenant_id'  => $request->user()->tenant_id,
            'status'     => 'draft',
            'created_by' => $request->user()->id,
            ...$data,
        ]);

        AuditLog::record('hr_settings.salary_scale.created', [
            'auditable_type' => HrSalaryScale::class,
            'auditable_id'   => $scale->id,
            'new_values'     => $data,
            'tags'           => 'hr_settings',
        ]);

        return response()->json(['message' => 'Salary scale created.', 'data' => $scale->load('gradeBand')], 201);
    }

    public function show(Request $request, HrSalaryScale $salaryScale): JsonResponse
    {
        $this->authorize('view', $salaryScale);

        return response()->json(['data' => $salaryScale->load(['gradeBand', 'approver', 'publisher'])]);
    }

    public function update(Request $request, HrSalaryScale $salaryScale): JsonResponse
    {
        $this->authorize('update', $salaryScale);

        if ($salaryScale->status === 'published') {
            return response()->json([
                'message' => 'Published scales cannot be edited. Create a new version instead.',
            ], 422);
        }

        $data = $request->validate([
            'currency'       => ['nullable', 'string', 'size:3'],
            'notches'        => ['sometimes', 'array', 'min:1', 'max:12'],
            'notches.*.notch'  => ['required_with:notches', 'integer', 'min:1', 'max:12'],
            'notches.*.annual' => ['required_with:notches', 'numeric', 'min:0'],
            'notches.*.monthly'=> ['required_with:notches', 'numeric', 'min:0'],
            'effective_from' => ['sometimes', 'date'],
            'effective_to'   => ['nullable', 'date'],
            'notes'          => ['nullable', 'string'],
        ]);

        $old = $salaryScale->only(array_keys($data));
        $salaryScale->update($data);

        AuditLog::record('hr_settings.salary_scale.updated', [
            'auditable_type' => HrSalaryScale::class,
            'auditable_id'   => $salaryScale->id,
            'old_values'     => $old,
            'new_values'     => $data,
            'tags'           => 'hr_settings',
        ]);

        return response()->json(['message' => 'Salary scale updated.', 'data' => $salaryScale->fresh()->load('gradeBand')]);
    }

    public function submit(Request $request, HrSalaryScale $salaryScale): JsonResponse
    {
        $this->authorize('update', $salaryScale);

        if ($salaryScale->status !== 'draft') {
            return response()->json(['message' => 'Only draft scales can be submitted.'], 422);
        }

        $salaryScale->update(['status' => 'review']);

        AuditLog::record('hr_settings.salary_scale.submitted', [
            'auditable_type' => HrSalaryScale::class,
            'auditable_id'   => $salaryScale->id,
            'new_values'     => ['status' => 'review'],
            'tags'           => 'hr_settings',
        ]);

        return response()->json(['message' => 'Salary scale submitted for review.', 'data' => $salaryScale->fresh()]);
    }

    public function approve(Request $request, HrSalaryScale $salaryScale): JsonResponse
    {
        $this->authorize('approve', $salaryScale);

        if ($salaryScale->status !== 'review') {
            return response()->json(['message' => 'Only scales in review can be approved.'], 422);
        }

        $salaryScale->update([
            'status'      => 'approved',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
        ]);

        AuditLog::record('hr_settings.salary_scale.approved', [
            'auditable_type' => HrSalaryScale::class,
            'auditable_id'   => $salaryScale->id,
            'new_values'     => ['status' => 'approved', 'approved_by' => $request->user()->id],
            'tags'           => 'hr_settings',
        ]);

        return response()->json(['message' => 'Salary scale approved.', 'data' => $salaryScale->fresh()]);
    }

    public function publish(Request $request, HrSalaryScale $salaryScale): JsonResponse
    {
        $this->authorize('publish', $salaryScale);

        if ($salaryScale->status !== 'approved') {
            return response()->json(['message' => 'Only approved scales can be published.'], 422);
        }

        // Archive any previously published scale for the same grade band
        HrSalaryScale::where('tenant_id', $salaryScale->tenant_id)
            ->where('grade_band_id', $salaryScale->grade_band_id)
            ->where('status', 'published')
            ->where('id', '!=', $salaryScale->id)
            ->update(['status' => 'archived']);

        $salaryScale->update([
            'status'       => 'published',
            'published_by' => $request->user()->id,
            'published_at' => now(),
        ]);

        AuditLog::record('hr_settings.salary_scale.published', [
            'auditable_type' => HrSalaryScale::class,
            'auditable_id'   => $salaryScale->id,
            'new_values'     => ['status' => 'published'],
            'tags'           => 'hr_settings',
        ]);

        return response()->json(['message' => 'Salary scale published.', 'data' => $salaryScale->fresh()]);
    }

    public function destroy(HrSalaryScale $salaryScale): JsonResponse
    {
        $this->authorize('delete', $salaryScale);

        $salaryScale->delete();

        AuditLog::record('hr_settings.salary_scale.deleted', [
            'auditable_type' => HrSalaryScale::class,
            'auditable_id'   => $salaryScale->id,
            'tags'           => 'hr_settings',
        ]);

        return response()->json(['message' => 'Salary scale deleted.']);
    }
}
