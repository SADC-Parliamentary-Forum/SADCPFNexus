<?php

namespace App\Http\Controllers\Api\V1\HrSettings;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\HrAppraisalTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AppraisalTemplateController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', HrAppraisalTemplate::class);

        $items = HrAppraisalTemplate::where('tenant_id', $request->user()->tenant_id)
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $items]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', HrAppraisalTemplate::class);

        $data = $request->validate([
            'name'                  => ['required', 'string', 'max:100'],
            'description'           => ['nullable', 'string'],
            'cycle_frequency'       => ['nullable', 'in:annual,bi_annual,quarterly'],
            'rating_scale_max'      => ['nullable', 'integer', 'min:2', 'max:10'],
            'kra_count_default'     => ['nullable', 'integer', 'min:1', 'max:20'],
            'is_probation_template' => ['nullable', 'boolean'],
            'is_active'             => ['nullable', 'boolean'],
        ]);

        $model = HrAppraisalTemplate::create([
            'tenant_id' => $request->user()->tenant_id,
            ...$data,
        ]);

        AuditLog::record('hr_settings.appraisal_template.created', [
            'auditable_type' => HrAppraisalTemplate::class,
            'auditable_id'   => $model->id,
            'new_values'     => $data,
            'tags'           => 'hr_settings',
        ]);

        return response()->json(['message' => 'Appraisal template created.', 'data' => $model], 201);
    }

    public function show(Request $request, HrAppraisalTemplate $appraisalTemplate): JsonResponse
    {
        $this->authorize('view', $appraisalTemplate);

        return response()->json(['data' => $appraisalTemplate]);
    }

    public function update(Request $request, HrAppraisalTemplate $appraisalTemplate): JsonResponse
    {
        $this->authorize('update', $appraisalTemplate);

        $data = $request->validate([
            'name'                  => ['sometimes', 'string', 'max:100'],
            'description'           => ['nullable', 'string'],
            'cycle_frequency'       => ['nullable', 'in:annual,bi_annual,quarterly'],
            'rating_scale_max'      => ['nullable', 'integer', 'min:2', 'max:10'],
            'kra_count_default'     => ['nullable', 'integer', 'min:1', 'max:20'],
            'is_probation_template' => ['nullable', 'boolean'],
            'is_active'             => ['nullable', 'boolean'],
        ]);

        $old = $appraisalTemplate->only(array_keys($data));
        $appraisalTemplate->update($data);

        AuditLog::record('hr_settings.appraisal_template.updated', [
            'auditable_type' => HrAppraisalTemplate::class,
            'auditable_id'   => $appraisalTemplate->id,
            'old_values'     => $old,
            'new_values'     => $data,
            'tags'           => 'hr_settings',
        ]);

        return response()->json(['message' => 'Appraisal template updated.', 'data' => $appraisalTemplate->fresh()]);
    }

    public function destroy(HrAppraisalTemplate $appraisalTemplate): JsonResponse
    {
        $this->authorize('delete', $appraisalTemplate);

        if ($appraisalTemplate->gradeBands()->exists()) {
            return response()->json(['message' => 'Cannot delete an appraisal template linked to grade bands.'], 422);
        }

        $appraisalTemplate->delete();

        AuditLog::record('hr_settings.appraisal_template.deleted', [
            'auditable_type' => HrAppraisalTemplate::class,
            'auditable_id'   => $appraisalTemplate->id,
            'tags'           => 'hr_settings',
        ]);

        return response()->json(['message' => 'Appraisal template deleted.']);
    }
}
