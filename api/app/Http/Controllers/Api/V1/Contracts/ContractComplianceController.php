<?php

namespace App\Http\Controllers\Api\V1\Contracts;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Contract;
use App\Models\ContractComplianceRequirement;
use App\Modules\Contracts\Services\ContractComplianceService;
use App\Modules\Contracts\Services\ContractService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Admin CRUD for configurable compliance requirements (PRD §81) and a
 * per-contract compliance status read (PRD §82).
 */
class ContractComplianceController extends Controller
{
    public function __construct(
        private readonly ContractComplianceService $compliance,
        private readonly ContractService $contracts,
    ) {}

    private function gateManage(Request $request): void
    {
        abort_unless(
            $request->user()->hasAnyPermission(['contract.manage_template', 'contract.manage_authority'])
            || $request->user()->hasAnyRole(['System Admin']),
            403
        );
    }

    public function index(Request $request): JsonResponse
    {
        $this->gateManage($request);

        $rows = ContractComplianceRequirement::where('tenant_id', $request->user()->tenant_id)
            ->with('contractType:id,name')
            ->orderBy('sort_order')->orderBy('code')
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->gateManage($request);
        $data = $this->validateReq($request);

        $req = ContractComplianceRequirement::create(array_merge($data, [
            'tenant_id' => $request->user()->tenant_id,
            'created_by' => $request->user()->id,
        ]));

        AuditLog::record('contract.compliance_requirement_created', [
            'auditable_type' => ContractComplianceRequirement::class, 'auditable_id' => $req->id,
            'new_values' => $data, 'tags' => ['contract', 'compliance'],
        ]);

        return response()->json(['message' => 'Compliance requirement created.', 'data' => $req], 201);
    }

    public function update(Request $request, ContractComplianceRequirement $requirement): JsonResponse
    {
        $this->gateManage($request);
        abort_if((int) $requirement->tenant_id !== (int) $request->user()->tenant_id, 404);

        $data = $this->validateReq($request, false);
        $requirement->update($data);

        AuditLog::record('contract.compliance_requirement_updated', [
            'auditable_type' => ContractComplianceRequirement::class, 'auditable_id' => $requirement->id,
            'new_values' => $data, 'tags' => ['contract', 'compliance'],
        ]);

        return response()->json(['message' => 'Compliance requirement updated.', 'data' => $requirement->fresh()]);
    }

    private function validateReq(Request $request, bool $required = true): array
    {
        $req = $required ? 'required' : 'sometimes';

        return $request->validate([
            'code' => [$req, 'string', 'max:80'],
            'name' => [$req, 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'contract_type_id' => ['nullable', 'integer', 'exists:contract_types,id'],
            'requires_expiry' => ['nullable', 'boolean'],
            'blocks_activation' => ['nullable', 'boolean'],
            'blocks_payment' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer'],
        ]);
    }

    /** Per-contract compliance status (PRD §82). */
    public function forContract(Request $request, Contract $contract): JsonResponse
    {
        $contract = $this->contracts->find($contract->id, $request->user());

        return response()->json(['data' => $this->compliance->status($contract)]);
    }
}
