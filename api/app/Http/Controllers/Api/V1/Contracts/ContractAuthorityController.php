<?php

namespace App\Http\Controllers\Api\V1\Contracts;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Contract;
use App\Models\ContractAuthorityDelegation;
use App\Models\ContractAuthorityRule;
use App\Modules\Contracts\Services\ContractAuthorityService;
use App\Modules\Contracts\Services\ContractService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Administers the Contract Authority Matrix (PRD §41) and delegated/acting
 * authority (PRD §42). Managing rules/delegations requires
 * contract.manage_authority; the read of a contract's effective authority is
 * available to any user who can view that contract.
 */
class ContractAuthorityController extends Controller
{
    public function __construct(
        private readonly ContractAuthorityService $authority,
        private readonly ContractService $contracts,
    ) {}

    private function gateManage(Request $request): void
    {
        abort_unless(
            $request->user()->hasPermissionTo('contract.manage_authority')
            || $request->user()->hasAnyRole(['System Admin']),
            403
        );
    }

    private function tenantGuard(Request $request, $model): void
    {
        abort_if((int) $model->tenant_id !== (int) $request->user()->tenant_id, 404);
    }

    // ── Authority rules ───────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $this->gateManage($request);

        $rules = ContractAuthorityRule::where('tenant_id', $request->user()->tenant_id)
            ->with('contractType:id,name')
            ->orderBy('action')->orderBy('sort_order')->orderBy('amount_floor')
            ->get();

        return response()->json(['data' => $rules]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->gateManage($request);
        $data = $this->validateRule($request);

        $rule = ContractAuthorityRule::create(array_merge($data, [
            'tenant_id' => $request->user()->tenant_id,
            'created_by' => $request->user()->id,
        ]));

        AuditLog::record('contract.authority_rule_created', [
            'auditable_type' => ContractAuthorityRule::class, 'auditable_id' => $rule->id,
            'new_values' => $data, 'tags' => ['contract', 'authority'],
        ]);

        return response()->json(['message' => 'Authority rule created.', 'data' => $rule], 201);
    }

    public function update(Request $request, ContractAuthorityRule $rule): JsonResponse
    {
        $this->gateManage($request);
        $this->tenantGuard($request, $rule);

        $data = $this->validateRule($request, false);
        $rule->update($data);

        AuditLog::record('contract.authority_rule_updated', [
            'auditable_type' => ContractAuthorityRule::class, 'auditable_id' => $rule->id,
            'new_values' => $data, 'tags' => ['contract', 'authority'],
        ]);

        return response()->json(['message' => 'Authority rule updated.', 'data' => $rule->fresh()]);
    }

    private function validateRule(Request $request, bool $required = true): array
    {
        $req = $required ? 'required' : 'sometimes';

        return $request->validate([
            'name' => [$req, 'string', 'max:255'],
            'action' => [$req, 'in:approve,sign'],
            'contract_type_id' => ['nullable', 'integer', 'exists:contract_types,id'],
            'amount_floor' => ['nullable', 'numeric', 'min:0'],
            'amount_ceiling' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'authorised_role' => [$req, 'string', 'max:255'],
            'alternate_role' => ['nullable', 'string', 'max:255'],
            'effective_from' => ['nullable', 'date'],
            'effective_until' => ['nullable', 'date', 'after_or_equal:effective_from'],
            'policy_source' => ['nullable', 'string', 'max:255'],
            'approval_reference' => ['nullable', 'string', 'max:255'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer'],
        ]);
    }

    // ── Delegations ───────────────────────────────────────────────────────────

    public function delegations(Request $request): JsonResponse
    {
        $this->gateManage($request);

        $rows = ContractAuthorityDelegation::where('tenant_id', $request->user()->tenant_id)
            ->with('delegate:id,name,email')
            ->orderByDesc('expires_at')
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function storeDelegation(Request $request): JsonResponse
    {
        $this->gateManage($request);

        $data = $request->validate([
            'delegator_role' => ['required', 'string', 'max:255'],
            'delegate_user_id' => ['required', 'integer', 'exists:users,id'],
            'action' => ['nullable', 'in:approve,sign'],
            'reason' => ['nullable', 'string', 'max:2000'],
            'effective_from' => ['required', 'date'],
            'expires_at' => ['required', 'date', 'after:effective_from'],
        ]);

        $delegation = ContractAuthorityDelegation::create(array_merge($data, [
            'tenant_id' => $request->user()->tenant_id,
            'is_active' => true,
            'created_by' => $request->user()->id,
        ]));

        AuditLog::record('contract.authority_delegated', [
            'auditable_type' => ContractAuthorityDelegation::class, 'auditable_id' => $delegation->id,
            'new_values' => $data, 'tags' => ['contract', 'authority', 'delegation'],
        ]);

        return response()->json(['message' => 'Delegation recorded.', 'data' => $delegation->load('delegate:id,name,email')], 201);
    }

    public function revokeDelegation(Request $request, ContractAuthorityDelegation $delegation): JsonResponse
    {
        $this->gateManage($request);
        $this->tenantGuard($request, $delegation);

        $delegation->update(['is_active' => false]);

        AuditLog::record('contract.authority_delegation_revoked', [
            'auditable_type' => ContractAuthorityDelegation::class, 'auditable_id' => $delegation->id,
            'tags' => ['contract', 'authority', 'delegation'],
        ]);

        return response()->json(['message' => 'Delegation revoked.']);
    }

    // ── Effective authority for one contract (UI helper) ──────────────────────

    public function forContract(Request $request, Contract $contract): JsonResponse
    {
        $contract = $this->contracts->find($contract->id, $request->user());
        $action = (string) $request->query('action', 'approve');
        abort_unless(in_array($action, ['approve', 'sign'], true), 422);

        return response()->json(['data' => [
            'action' => $action,
            'required_roles' => $this->authority->requiredRoles($action, $contract),
            'governed' => $this->authority->requiredRoles($action, $contract) !== [],
            'user_may_act' => $this->authority->userMayAct($request->user(), $action, $contract),
            'sod_conflict' => $this->authority->separationOfDutiesConflict($request->user(), $contract),
        ]]);
    }
}
