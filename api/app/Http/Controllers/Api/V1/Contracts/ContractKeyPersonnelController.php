<?php

namespace App\Http\Controllers\Api\V1\Contracts;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Contract;
use App\Models\ContractKeyPersonnel;
use App\Models\ContractPersonnelReplacement;
use App\Modules\Contracts\Services\ContractKeyPersonnelService;
use App\Modules\Contracts\Services\ContractService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Key personnel management + replacement approval (PRD §80).
 */
class ContractKeyPersonnelController extends Controller
{
    public function __construct(
        private readonly ContractService $contracts,
        private readonly ContractKeyPersonnelService $service,
    ) {}

    private function ensure(Request $request, array $perms): void
    {
        $u = $request->user();
        abort_unless($u->hasAnyPermission($perms) || $u->hasAnyRole(['Procurement Officer']), 403);
    }

    public function index(Request $request, Contract $contract): JsonResponse
    {
        $this->ensure($request, ['contract.view', 'contract.view_all', 'contract.audit_view']);
        $contract = $this->contracts->find($contract->id, $request->user());

        return response()->json([
            'data' => [
                'personnel' => $contract->keyPersonnel()->with('replacements')->get(),
                'pending_replacements' => ContractPersonnelReplacement::where('contract_id', $contract->id)
                    ->where('status', 'pending')->get(),
            ],
        ]);
    }

    public function store(Request $request, Contract $contract): JsonResponse
    {
        $this->ensure($request, ['contract.create', 'contract.edit_draft']);
        $contract = $this->contracts->find($contract->id, $request->user());

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'role' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'cv_reference' => ['nullable', 'string', 'max:255'],
            'is_key' => ['nullable', 'boolean'],
        ]);

        $person = $contract->keyPersonnel()->create(array_merge($data, [
            'tenant_id' => $contract->tenant_id,
            'status' => 'active',
            'created_by' => $request->user()->id,
        ]));

        AuditLog::record('contract.key_personnel_added', [
            'auditable_type' => Contract::class, 'auditable_id' => $contract->id,
            'new_values' => ['personnel_id' => $person->id, 'name' => $person->name, 'role' => $person->role],
            'tags' => ['contract', 'personnel'],
        ]);

        return response()->json(['message' => 'Key personnel added.', 'data' => $person], 201);
    }

    public function requestReplacement(Request $request, Contract $contract, ContractKeyPersonnel $personnel): JsonResponse
    {
        $this->ensure($request, ['contract.create', 'contract.edit_draft']);
        $contract = $this->contracts->find($contract->id, $request->user());
        abort_if((int) $personnel->contract_id !== (int) $contract->id, 404);

        $data = $request->validate([
            'proposed_name' => ['required', 'string', 'max:255'],
            'proposed_role' => ['required', 'string', 'max:255'],
            'proposed_email' => ['nullable', 'email', 'max:255'],
            'proposed_cv_reference' => ['nullable', 'string', 'max:255'],
            'reason' => ['required', 'string', 'max:2000'],
        ]);

        $replacement = ContractPersonnelReplacement::create(array_merge($data, [
            'tenant_id' => $contract->tenant_id,
            'contract_id' => $contract->id,
            'personnel_id' => $personnel->id,
            'status' => 'pending',
            'requested_by' => $request->user()->id,
        ]));

        AuditLog::record('contract.personnel_replacement_requested', [
            'auditable_type' => Contract::class, 'auditable_id' => $contract->id,
            'new_values' => ['replacement_id' => $replacement->id, 'personnel_id' => $personnel->id],
            'tags' => ['contract', 'personnel'],
        ]);

        return response()->json(['message' => 'Replacement requested; pending approval.', 'data' => $replacement], 201);
    }

    public function approveReplacement(Request $request, Contract $contract, ContractPersonnelReplacement $replacement): JsonResponse
    {
        $this->ensure($request, ['contract.approve_amendment', 'contract.approve']);
        $contract = $this->contracts->find($contract->id, $request->user());
        abort_if((int) $replacement->contract_id !== (int) $contract->id, 404);

        $data = $request->validate(['note' => ['nullable', 'string', 'max:2000']]);
        $successor = $this->service->approveReplacement($replacement, $request->user(), $data['note'] ?? null);

        AuditLog::record('contract.personnel_replacement_approved', [
            'auditable_type' => Contract::class, 'auditable_id' => $contract->id,
            'new_values' => ['replacement_id' => $replacement->id, 'successor_id' => $successor->id],
            'tags' => ['contract', 'personnel'],
        ]);

        return response()->json(['message' => 'Replacement approved.', 'data' => $successor]);
    }

    public function rejectReplacement(Request $request, Contract $contract, ContractPersonnelReplacement $replacement): JsonResponse
    {
        $this->ensure($request, ['contract.approve_amendment', 'contract.approve']);
        $contract = $this->contracts->find($contract->id, $request->user());
        abort_if((int) $replacement->contract_id !== (int) $contract->id, 404);

        $data = $request->validate(['note' => ['nullable', 'string', 'max:2000']]);
        $this->service->rejectReplacement($replacement, $request->user(), $data['note'] ?? null);

        return response()->json(['message' => 'Replacement rejected.']);
    }
}
