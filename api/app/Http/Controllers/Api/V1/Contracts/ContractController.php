<?php

namespace App\Http\Controllers\Api\V1\Contracts;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Contract;
use App\Modules\Contracts\Services\ContractService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * First-class Contract Management entry point (supersedes the procurement
 * nested contract endpoints). Lifecycle depth is added in later workstreams;
 * WS0 wires the register + basic CRUD under RBAC.
 */
class ContractController extends Controller
{
    public function __construct(private readonly ContractService $contracts) {}

    private function ensurePermission(Request $request, array $permissions, array $roles = []): void
    {
        $user = $request->user();
        if ($user->hasAnyPermission($permissions)) {
            return;
        }
        if ($roles !== [] && $user->hasAnyRole($roles)) {
            return;
        }
        abort(403);
    }

    public function index(Request $request): JsonResponse
    {
        $this->ensurePermission($request, ['contract.view', 'contract.view_all', 'contract.audit_view'], ['Procurement Officer']);

        $filters = $request->only(['status', 'vendor_id', 'search', 'per_page']);
        $page = $this->contracts->list($filters, $request->user());

        return response()->json($page);
    }

    public function show(Request $request, Contract $contract): JsonResponse
    {
        $this->ensurePermission($request, ['contract.view', 'contract.view_all', 'contract.audit_view'], ['Procurement Officer']);

        // Delegate to the service so tenant + record scoping is applied uniformly.
        return response()->json(['data' => $this->contracts->find($contract->id, $request->user())]);
    }

    public function types(Request $request): JsonResponse
    {
        $this->ensurePermission($request, ['contract.view', 'contract.view_all', 'contract.create'], ['Procurement Officer']);

        return response()->json(['data' => $this->contracts->types($request->user())]);
    }

    /**
     * Import a historical contract. It is explicitly flagged legacy/imported and
     * does NOT pass through any Nexus workflow (PRD §10E / §128).
     */
    public function importLegacy(Request $request): JsonResponse
    {
        $this->ensurePermission($request, ['contract.create'], ['Procurement Officer']);

        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'vendor_id' => ['nullable', 'integer', 'exists:vendors,id'],
            'counterparty_name' => ['nullable', 'string', 'max:255'],
            'type_id' => ['nullable', 'integer', 'exists:contract_types,id'],
            'value' => ['required', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'max:10'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'signed_at' => ['nullable', 'date'],
            'legacy_status' => ['nullable', 'string', 'in:active,completed,terminated,expired'],
            'description' => ['nullable', 'string'],
        ]);

        abort_if(empty($data['vendor_id']) && empty($data['counterparty_name']), 422, 'Provide a vendor or counterparty name.');

        $legacyStatus = $data['legacy_status'] ?? 'active';
        $lifecycle = match ($legacyStatus) {
            'completed' => 'COMPLETED',
            'terminated' => 'TERMINATED',
            'expired' => 'EXPIRED',
            default => 'ACTIVE',
        };

        $contract = Contract::create([
            'tenant_id' => $request->user()->tenant_id,
            'created_by' => $request->user()->id,
            'origin_type' => 'legacy',
            'is_legacy' => true,
            'type_id' => $data['type_id'] ?? null,
            'vendor_id' => $data['vendor_id'] ?? null,
            'counterparty_type' => ! empty($data['vendor_id']) ? 'organisation' : 'individual',
            'counterparty_name' => $data['counterparty_name'] ?? null,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'start_date' => $data['start_date'],
            'end_date' => $data['end_date'],
            'value' => $data['value'],
            'currency' => $data['currency'] ?? 'NAD',
            'status' => $legacyStatus === 'expired' ? 'active' : $legacyStatus,
            'contract_status' => $lifecycle,
            'signature_status' => ! empty($data['signed_at']) ? 'signed' : 'unsigned',
            'signed_at' => $data['signed_at'] ?? null,
        ]);

        AuditLog::record('contract.legacy_imported', [
            'auditable_type' => Contract::class,
            'auditable_id' => $contract->id,
            'new_values' => ['title' => $contract->title, 'is_legacy' => true],
            'tags' => ['contract', 'legacy'],
        ]);

        return response()->json(['message' => 'Legacy contract imported.', 'data' => $contract], 201);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensurePermission($request, ['contract.create'], ['Procurement Officer']);

        $data = $request->validate([
            'procurement_request_id' => ['nullable', 'integer', 'exists:procurement_requests,id'],
            'tender_id' => ['nullable', 'integer', 'exists:tenders,id'],
            'vendor_id' => ['required', 'integer', 'exists:vendors,id'],
            'purchase_order_id' => ['nullable', 'integer', 'exists:purchase_orders,id'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after:start_date'],
            'value' => ['required', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'max:10'],
            'budget_line' => ['nullable', 'string', 'max:255'],
        ]);

        $contract = Contract::create(array_merge($data, [
            'tenant_id' => $request->user()->tenant_id,
            'created_by' => $request->user()->id,
            'status' => 'draft',
        ]));

        AuditLog::record('contract.created', [
            'auditable_type' => Contract::class,
            'auditable_id' => $contract->id,
            'new_values' => ['title' => $contract->title, 'value' => $contract->value],
            'tags' => ['contract'],
        ]);

        return response()->json(['message' => 'Contract created.', 'data' => $contract], 201);
    }

    public function activate(Request $request, Contract $contract): JsonResponse
    {
        $this->ensurePermission($request, ['contract.approve'], ['Secretary General']);
        $this->contracts->find($contract->id, $request->user());

        $contract->update(['status' => 'active', 'signed_at' => now()]);

        AuditLog::record('contract.activated', [
            'auditable_type' => Contract::class,
            'auditable_id' => $contract->id,
            'new_values' => ['status' => 'active'],
            'tags' => ['contract'],
        ]);

        return response()->json(['message' => 'Contract activated.', 'data' => $contract->fresh(['vendor'])]);
    }

    public function terminate(Request $request, Contract $contract): JsonResponse
    {
        $this->ensurePermission($request, ['contract.terminate'], ['Secretary General']);
        $this->contracts->find($contract->id, $request->user());

        $data = $request->validate(['reason' => ['required', 'string', 'max:1000']]);

        $contract->update([
            'status' => 'terminated',
            'terminated_at' => now(),
            'termination_reason' => $data['reason'],
        ]);

        AuditLog::record('contract.terminated', [
            'auditable_type' => Contract::class,
            'auditable_id' => $contract->id,
            'new_values' => ['status' => 'terminated'],
            'tags' => ['contract'],
        ]);

        return response()->json(['message' => 'Contract terminated.', 'data' => $contract->fresh()]);
    }

    public function destroy(Request $request, Contract $contract): JsonResponse
    {
        $this->ensurePermission($request, ['contract.edit_draft', 'contract.create'], ['Procurement Officer']);
        $this->contracts->find($contract->id, $request->user());

        if ($contract->status === 'active') {
            throw ValidationException::withMessages([
                'status' => ['Cannot delete an active contract. Terminate it first.'],
            ]);
        }

        $contract->delete();

        return response()->json(['message' => 'Contract deleted.']);
    }
}
