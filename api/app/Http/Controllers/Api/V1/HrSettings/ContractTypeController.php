<?php

namespace App\Http\Controllers\Api\V1\HrSettings;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\HrContractType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContractTypeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', HrContractType::class);

        $items = HrContractType::where('tenant_id', $request->user()->tenant_id)
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $items]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', HrContractType::class);

        $data = $request->validate([
            'code'                => ['required', 'string', 'max:20'],
            'name'                => ['required', 'string', 'max:100'],
            'description'         => ['nullable', 'string'],
            'is_permanent'        => ['nullable', 'boolean'],
            'has_probation'       => ['nullable', 'boolean'],
            'probation_months'    => ['nullable', 'integer', 'min:1', 'max:24'],
            'notice_period_days'  => ['nullable', 'integer', 'min:1', 'max:365'],
            'is_renewable'        => ['nullable', 'boolean'],
            'is_active'           => ['nullable', 'boolean'],
        ]);

        $model = HrContractType::create([
            'tenant_id' => $request->user()->tenant_id,
            ...$data,
        ]);

        AuditLog::record('hr_settings.contract_type.created', [
            'auditable_type' => HrContractType::class,
            'auditable_id'   => $model->id,
            'new_values'     => $data,
            'tags'           => 'hr_settings',
        ]);

        return response()->json(['message' => 'Contract type created.', 'data' => $model], 201);
    }

    public function show(Request $request, HrContractType $contractType): JsonResponse
    {
        $this->authorize('view', $contractType);

        return response()->json(['data' => $contractType]);
    }

    public function update(Request $request, HrContractType $contractType): JsonResponse
    {
        $this->authorize('update', $contractType);

        $data = $request->validate([
            'code'                => ['sometimes', 'string', 'max:20'],
            'name'                => ['sometimes', 'string', 'max:100'],
            'description'         => ['nullable', 'string'],
            'is_permanent'        => ['nullable', 'boolean'],
            'has_probation'       => ['nullable', 'boolean'],
            'probation_months'    => ['nullable', 'integer', 'min:1', 'max:24'],
            'notice_period_days'  => ['nullable', 'integer', 'min:1', 'max:365'],
            'is_renewable'        => ['nullable', 'boolean'],
            'is_active'           => ['nullable', 'boolean'],
        ]);

        $old = $contractType->only(array_keys($data));
        $contractType->update($data);

        AuditLog::record('hr_settings.contract_type.updated', [
            'auditable_type' => HrContractType::class,
            'auditable_id'   => $contractType->id,
            'old_values'     => $old,
            'new_values'     => $data,
            'tags'           => 'hr_settings',
        ]);

        return response()->json(['message' => 'Contract type updated.', 'data' => $contractType->fresh()]);
    }

    public function destroy(HrContractType $contractType): JsonResponse
    {
        $this->authorize('delete', $contractType);

        if ($contractType->gradeBands()->exists()) {
            return response()->json(['message' => 'Cannot delete a contract type linked to grade bands.'], 422);
        }

        $contractType->delete();

        AuditLog::record('hr_settings.contract_type.deleted', [
            'auditable_type' => HrContractType::class,
            'auditable_id'   => $contractType->id,
            'tags'           => 'hr_settings',
        ]);

        return response()->json(['message' => 'Contract type deleted.']);
    }
}
