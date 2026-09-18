<?php

namespace App\Http\Controllers\Api\V1\Contracts;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Contract;
use App\Models\ContractClause;
use App\Models\ContractClauseAssignment;
use App\Models\ContractClauseVersion;
use App\Modules\Contracts\Services\ContractClauseService;
use App\Modules\Contracts\Services\ContractService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Clause library administration and per-contract clause assignment (PRD §30–§33).
 * Library governance reuses the contract.manage_template capability.
 */
class ContractClauseController extends Controller
{
    public function __construct(
        private readonly ContractClauseService $clauses,
        private readonly ContractService $contracts,
    ) {}

    private function gateManage(Request $request): void
    {
        abort_unless(
            $request->user()->hasAnyPermission(['contract.manage_template', 'contract.manage_clause'])
            || $request->user()->hasAnyRole(['Procurement Officer', 'System Admin']),
            403
        );
    }

    private function gateView(Request $request): void
    {
        abort_unless(
            $request->user()->hasAnyPermission(['contract.view', 'contract.view_all', 'contract.manage_template', 'contract.create'])
            || $request->user()->hasAnyRole(['Procurement Officer']),
            403
        );
    }

    private function tenantClause(Request $request, ContractClause $clause): void
    {
        abort_if((int) $clause->tenant_id !== (int) $request->user()->tenant_id, 404);
    }

    // ── Library ──────────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $this->gateView($request);

        $clauses = ContractClause::where('tenant_id', $request->user()->tenant_id)
            ->with(['currentVersion', 'versions'])
            ->orderBy('sort_order')->orderBy('title')
            ->get();

        return response()->json(['data' => $clauses]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->gateManage($request);

        $data = $request->validate([
            'key' => ['required', 'string', 'max:80'],
            'title' => ['required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:60'],
            'clause_type' => ['required', 'string', 'in:mandatory_locked,mandatory_editable,conditional,optional,donor_specific'],
            'donor' => ['nullable', 'string', 'max:255'],
            'condition_note' => ['nullable', 'string'],
            'body' => ['required', 'string'],
            'version' => ['nullable', 'string', 'max:20'],
            'sort_order' => ['nullable', 'integer'],
        ]);

        $clause = $this->clauses->createClause($request->user(), $data);

        AuditLog::record('contract.clause_created', [
            'auditable_type' => ContractClause::class, 'auditable_id' => $clause->id,
            'new_values' => ['key' => $clause->key, 'type' => $clause->clause_type], 'tags' => ['contract', 'clause'],
        ]);

        return response()->json(['message' => 'Clause created.', 'data' => $clause], 201);
    }

    public function addVersion(Request $request, ContractClause $clause): JsonResponse
    {
        $this->gateManage($request);
        $this->tenantClause($request, $clause);

        $data = $request->validate([
            'version' => ['required', 'string', 'max:20'],
            'body' => ['required', 'string'],
        ]);

        return response()->json(['message' => 'Clause version added.', 'data' => $this->clauses->addVersion($clause, $request->user(), $data)], 201);
    }

    public function activateVersion(Request $request, ContractClause $clause, ContractClauseVersion $version): JsonResponse
    {
        $this->gateManage($request);
        $this->tenantClause($request, $clause);
        abort_if((int) $version->clause_id !== (int) $clause->id, 404);

        $clause = $this->clauses->activateVersion($clause, $version, $request->user());

        AuditLog::record('contract.clause_version_activated', [
            'auditable_type' => ContractClause::class, 'auditable_id' => $clause->id,
            'new_values' => ['active_version' => $version->version], 'tags' => ['contract', 'clause'],
        ]);

        return response()->json(['message' => 'Clause version activated.', 'data' => $clause]);
    }

    // ── Per-contract assignment ────────────────────────────────────────────────

    public function contractClauses(Request $request, Contract $contract): JsonResponse
    {
        $this->gateView($request);
        $contract = $this->contracts->find($contract->id, $request->user());

        return response()->json(['data' => $contract->clauseAssignments()->with(['clause', 'clauseVersion'])->get()]);
    }

    public function assign(Request $request, Contract $contract): JsonResponse
    {
        $this->gateView($request);
        abort_unless(
            $request->user()->hasAnyPermission(['contract.edit_draft', 'contract.create'])
            || $request->user()->hasAnyRole(['Procurement Officer']),
            403
        );
        $contract = $this->contracts->find($contract->id, $request->user());

        $data = $request->validate([
            'clause_id' => ['required', 'integer'],
            'deviation_text' => ['nullable', 'string'],
            'deviation_reason' => ['nullable', 'string', 'max:2000'],
        ]);

        $clause = ContractClause::where('tenant_id', $request->user()->tenant_id)->findOrFail($data['clause_id']);
        $assignment = $this->clauses->assign($contract, $clause, $request->user(), $data);

        AuditLog::record('contract.clause_assigned', [
            'auditable_type' => Contract::class, 'auditable_id' => $contract->id,
            'new_values' => ['clause' => $clause->key, 'deviation' => $assignment->is_deviation], 'tags' => ['contract', 'clause'],
        ]);

        return response()->json(['message' => 'Clause assigned.', 'data' => $assignment->load(['clause', 'clauseVersion'])], 201);
    }

    public function unassign(Request $request, Contract $contract, ContractClauseAssignment $assignment): JsonResponse
    {
        $this->gateView($request);
        abort_unless(
            $request->user()->hasAnyPermission(['contract.edit_draft', 'contract.create'])
            || $request->user()->hasAnyRole(['Procurement Officer']),
            403
        );
        $contract = $this->contracts->find($contract->id, $request->user());
        abort_if((int) $assignment->contract_id !== (int) $contract->id, 404);

        $this->clauses->unassign($contract, $assignment);

        return response()->json(['message' => 'Clause removed.']);
    }
}
