<?php

namespace App\Http\Controllers\Api\V1\Contracts;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Contract;
use App\Models\ContractDeliverable;
use App\Models\ContractObligation;
use App\Models\ContractTemplateVersion;
use App\Modules\Contracts\Services\ContractDocumentService;
use App\Modules\Contracts\Services\ContractService;
use App\Modules\Contracts\Services\ContractWorkflowService;
use App\Services\WorkflowService;
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
    public function __construct(
        private readonly ContractService $contracts,
        private readonly ContractDocumentService $documents,
        private readonly ContractWorkflowService $workflow,
        private readonly WorkflowService $engine,
    ) {}

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
            'origin_type' => ['nullable', 'string', 'in:procurement,pif,framework,standalone,legacy'],
            'origin_reference' => ['nullable', 'string', 'max:500'],
            'procurement_request_id' => ['nullable', 'integer', 'exists:procurement_requests,id'],
            'tender_id' => ['nullable', 'integer', 'exists:tenders,id'],
            'purchase_order_id' => ['nullable', 'integer', 'exists:purchase_orders,id'],
            'type_id' => ['nullable', 'integer', 'exists:contract_types,id'],
            'counterparty_type' => ['nullable', 'string', 'in:individual,organisation'],
            'vendor_id' => ['nullable', 'integer', 'exists:vendors,id'],
            'counterparty_name' => ['nullable', 'string', 'max:255'],
            'counterparty' => ['nullable', 'array'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'contract_owner_id' => ['nullable', 'integer', 'exists:users,id'],
            'procurement_officer_id' => ['nullable', 'integer', 'exists:users,id'],
            'programme_id' => ['nullable', 'integer', 'exists:programmes,id'],
            'project_id' => ['nullable', 'integer'],
            'donor' => ['nullable', 'string', 'max:255'],
            'funding_source_id' => ['nullable', 'integer'],
            'funding_source' => ['nullable', 'string', 'max:255'],
            'procurement_method' => ['nullable', 'string', 'max:60'],
            'award_reference' => ['nullable', 'string', 'max:255'],
            'tor_reference' => ['nullable', 'string', 'max:255'],
            'short_description' => ['nullable', 'string', 'max:500'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'effective_date' => ['nullable', 'date'],
            'service_start_date' => ['nullable', 'date'],
            'service_end_date' => ['nullable', 'date'],
            'signature_deadline' => ['nullable', 'date'],
            'renewal_decision_date' => ['nullable', 'date'],
            'notice_period_days' => ['nullable', 'integer', 'min:0'],
            'rate' => ['nullable', 'numeric', 'min:0'],
            'rate_basis' => ['nullable', 'string', 'max:30'],
            'units' => ['nullable', 'numeric', 'min:0'],
            'value' => ['nullable', 'numeric', 'min:0'],
            'ceiling_value' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'max:10'],
            'budget_currency' => ['nullable', 'string', 'max:10'],
            'conversion_reference' => ['nullable', 'string', 'max:255'],
            'converted_value' => ['nullable', 'numeric', 'min:0'],
            'budget_line' => ['nullable', 'string', 'max:255'],
            'scope' => ['nullable', 'array'],
            'deliverables' => ['nullable', 'array'],
            'deliverables.*.name' => ['required_with:deliverables', 'string', 'max:255'],
            'obligations' => ['nullable', 'array'],
            'obligations.*.obligation' => ['required_with:obligations', 'string'],
            'funding_sources' => ['nullable', 'array'],
        ]);

        // A contract needs a counterparty: a vendor (organisation) or details (individual).
        if (empty($data['vendor_id']) && empty($data['counterparty_name']) && empty($data['counterparty'])) {
            throw ValidationException::withMessages(['counterparty' => ['Select a supplier or enter counterparty details.']]);
        }
        if (($data['value'] ?? null) === null && ! (isset($data['rate'], $data['units']))) {
            throw ValidationException::withMessages(['value' => ['Provide a contract value, or a rate and units to calculate it.']]);
        }

        $contract = $this->contracts->create($data, $request->user());

        AuditLog::record('contract.created', [
            'auditable_type' => Contract::class,
            'auditable_id' => $contract->id,
            'new_values' => ['title' => $contract->title, 'value' => $contract->value, 'origin' => $contract->origin_type],
            'tags' => ['contract'],
        ]);

        return response()->json(['message' => 'Contract created.', 'data' => $contract->load(['type', 'vendor', 'counterparty', 'deliverables', 'obligations'])], 201);
    }

    /** Prepopulate wizard fields from an approved Procurement award or PIF. */
    public function prefill(Request $request): JsonResponse
    {
        $this->ensurePermission($request, ['contract.create'], ['Procurement Officer']);

        $data = $request->validate([
            'origin_type' => ['required', 'string', 'in:procurement,pif'],
            'origin_id' => ['required', 'integer'],
        ]);

        return response()->json(['data' => $this->contracts->prefill($data['origin_type'], (int) $data['origin_id'], $request->user())]);
    }

    /** Document-readiness checklist used before submission. */
    public function readiness(Request $request, Contract $contract): JsonResponse
    {
        $this->ensurePermission($request, ['contract.view', 'contract.view_all', 'contract.create'], ['Procurement Officer']);
        $contract = $this->contracts->find($contract->id, $request->user());

        return response()->json(['data' => $this->contracts->readiness($contract)]);
    }

    /** Generate a working draft from a template version (mandatory-field gated). */
    public function generate(Request $request, Contract $contract): JsonResponse
    {
        $this->ensurePermission($request, ['contract.generate_document'], ['Procurement Officer']);
        $contract = $this->contracts->find($contract->id, $request->user());

        if ($contract->isSignatureLocked()) {
            throw ValidationException::withMessages(['document' => ['This contract is locked; create an amendment or new version instead.']]);
        }

        $data = $request->validate(['template_version_id' => ['required', 'integer']]);
        $version = ContractTemplateVersion::where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($data['template_version_id']);

        $doc = $this->documents->generateWorking($contract, $version, $request->user());

        AuditLog::record('contract.document_generated', [
            'auditable_type' => Contract::class,
            'auditable_id' => $contract->id,
            'new_values' => ['document_version' => $doc->version, 'hash' => $doc->hash, 'kind' => 'working'],
            'tags' => ['contract', 'document'],
        ]);

        return response()->json(['message' => 'Working draft generated.', 'data' => $doc]);
    }

    public function addDeliverable(Request $request, Contract $contract): JsonResponse
    {
        $this->ensurePermission($request, ['contract.edit_draft', 'contract.create'], ['Procurement Officer']);
        $contract = $this->contracts->find($contract->id, $request->user());

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'acceptance_criteria' => ['nullable', 'string'],
            'responsible_party' => ['nullable', 'string', 'max:30'],
            'due_date' => ['nullable', 'date'],
        ]);

        $deliverable = ContractDeliverable::create(array_merge($data, [
            'tenant_id' => $contract->tenant_id,
            'contract_id' => $contract->id,
            'number' => (int) $contract->deliverables()->max('number') + 1,
            'status' => 'not_started',
            'sort_order' => (int) $contract->deliverables()->max('sort_order') + 1,
        ]));

        return response()->json(['message' => 'Deliverable added.', 'data' => $deliverable], 201);
    }

    public function addObligation(Request $request, Contract $contract): JsonResponse
    {
        $this->ensurePermission($request, ['contract.edit_draft', 'contract.create'], ['Procurement Officer']);
        $contract = $this->contracts->find($contract->id, $request->user());

        $data = $request->validate([
            'obligation' => ['required', 'string'],
            'responsible_party' => ['nullable', 'string', 'in:sadcpf,counterparty'],
            'due_date' => ['nullable', 'date'],
        ]);

        $obligation = ContractObligation::create(array_merge($data, [
            'tenant_id' => $contract->tenant_id,
            'contract_id' => $contract->id,
            'status' => 'open',
        ]));

        return response()->json(['message' => 'Obligation added.', 'data' => $obligation], 201);
    }

    /** Submit a prepared contract into the approval workflow (readiness-gated). */
    public function submit(Request $request, Contract $contract): JsonResponse
    {
        $this->ensurePermission($request, ['contract.submit', 'contract.create'], ['Procurement Officer']);
        $contract = $this->contracts->find($contract->id, $request->user());

        $contract = $this->workflow->submit($contract, $request->user());

        AuditLog::record('contract.submitted', [
            'auditable_type' => Contract::class,
            'auditable_id' => $contract->id,
            'new_values' => ['contract_status' => $contract->contract_status],
            'tags' => ['contract', 'workflow'],
        ]);

        return response()->json(['message' => 'Contract submitted for approval.', 'data' => $contract]);
    }

    public function approve(Request $request, Contract $contract): JsonResponse
    {
        $this->ensurePermission($request, ['contract.review', 'contract.approve'], ['Secretary General']);
        $contract = $this->contracts->find($contract->id, $request->user());
        $approval = $this->requireActiveApproval($contract);

        $data = $request->validate(['comment' => ['nullable', 'string', 'max:2000']]);
        $result = $this->engine->approve($approval, $request->user(), $data['comment'] ?? null);

        AuditLog::record('contract.approval_action', [
            'auditable_type' => Contract::class,
            'auditable_id' => $contract->id,
            'new_values' => ['action' => 'approve', 'advanced_to_step' => $result['advanced_to_step'] ?? null],
            'tags' => ['contract', 'workflow'],
        ]);

        return response()->json(['message' => 'Approval recorded.', 'data' => $contract->fresh(['approvalRequest.workflow.steps', 'approvalRequest.history'])]);
    }

    public function returnForCorrection(Request $request, Contract $contract): JsonResponse
    {
        $this->ensurePermission($request, ['contract.review', 'contract.approve'], ['Secretary General']);
        $contract = $this->contracts->find($contract->id, $request->user());
        $approval = $this->requireActiveApproval($contract);

        $data = $request->validate(['comment' => ['required', 'string', 'max:2000']]);
        $this->engine->returnForCorrection($approval, $request->user(), $data['comment']);

        AuditLog::record('contract.approval_action', [
            'auditable_type' => Contract::class,
            'auditable_id' => $contract->id,
            'new_values' => ['action' => 'return', 'reason' => $data['comment']],
            'tags' => ['contract', 'workflow'],
        ]);

        return response()->json(['message' => 'Contract returned for correction.', 'data' => $contract->fresh(['approvalRequest'])]);
    }

    public function reject(Request $request, Contract $contract): JsonResponse
    {
        $this->ensurePermission($request, ['contract.reject', 'contract.approve'], ['Secretary General']);
        $contract = $this->contracts->find($contract->id, $request->user());
        $approval = $this->requireActiveApproval($contract);

        $data = $request->validate(['comment' => ['required', 'string', 'max:2000']]);
        $this->engine->reject($approval, $request->user(), $data['comment']);

        AuditLog::record('contract.approval_action', [
            'auditable_type' => Contract::class,
            'auditable_id' => $contract->id,
            'new_values' => ['action' => 'reject', 'reason' => $data['comment']],
            'tags' => ['contract', 'workflow'],
        ]);

        return response()->json(['message' => 'Contract rejected.', 'data' => $contract->fresh(['approvalRequest'])]);
    }

    public function withdraw(Request $request, Contract $contract): JsonResponse
    {
        $this->ensurePermission($request, ['contract.submit', 'contract.create'], ['Procurement Officer']);
        $contract = $this->contracts->find($contract->id, $request->user());
        $approval = $this->requireActiveApproval($contract);

        $this->engine->withdraw($approval, $request->user());

        return response()->json(['message' => 'Contract withdrawn.', 'data' => $contract->fresh(['approvalRequest'])]);
    }

    public function exceptions(Request $request, Contract $contract): JsonResponse
    {
        $this->ensurePermission($request, ['contract.view', 'contract.view_all', 'contract.audit_view'], ['Procurement Officer']);
        $contract = $this->contracts->find($contract->id, $request->user());

        return response()->json(['data' => $contract->exceptions]);
    }

    private function requireActiveApproval(Contract $contract): \App\Models\ApprovalRequest
    {
        $approval = $this->workflow->activeRequest($contract);
        if ($approval === null) {
            throw ValidationException::withMessages(['workflow' => ['This contract has no active approval request.']]);
        }

        return $approval;
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
