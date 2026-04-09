<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Contract;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContractController extends Controller
{
    private function gateManage(Request $request): void
    {
        if (! $request->user()->hasAnyRole(['Procurement Officer', 'Finance Controller', 'System Admin', 'Secretary General'])) {
            abort(403);
        }
    }

    public function index(Request $request): JsonResponse
    {
        $query = Contract::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->with(['vendor', 'procurementRequest'])
            ->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('vendor_id')) {
            $query->where('vendor_id', (int) $request->vendor_id);
        }

        return response()->json(['data' => $query->get()]);
    }

    public function show(Request $request, Contract $contract): JsonResponse
    {
        if ((int) $contract->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
        return response()->json([
            'data' => $contract->load(['vendor', 'procurementRequest', 'purchaseOrder', 'createdBy']),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->gateManage($request);

        $data = $request->validate([
            'procurement_request_id' => ['nullable', 'integer', 'exists:procurement_requests,id'],
            'vendor_id'              => ['required', 'integer', 'exists:vendors,id'],
            'purchase_order_id'      => ['nullable', 'integer', 'exists:purchase_orders,id'],
            'title'                  => ['required', 'string', 'max:255'],
            'description'            => ['nullable', 'string'],
            'start_date'             => ['required', 'date'],
            'end_date'               => ['required', 'date', 'after:start_date'],
            'value'                  => ['required', 'numeric', 'min:0'],
            'currency'               => ['nullable', 'string', 'max:10'],
        ]);

        $contract = Contract::create(array_merge($data, [
            'tenant_id'  => $request->user()->tenant_id,
            'created_by' => $request->user()->id,
            'status'     => 'draft',
        ]));

        AuditLog::record('procurement.contract_created', [
            'auditable_type' => Contract::class,
            'auditable_id'   => $contract->id,
            'new_values'     => ['title' => $contract->title, 'value' => $contract->value],
            'tags'           => ['procurement', 'contract'],
        ]);

        return response()->json(['message' => 'Contract created.', 'data' => $contract], 201);
    }

    public function activate(Request $request, Contract $contract): JsonResponse
    {
        $this->gateManage($request);
        if ((int) $contract->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $contract->update(['status' => 'active', 'signed_at' => now()]);

        AuditLog::record('procurement.contract_activated', [
            'auditable_type' => Contract::class,
            'auditable_id'   => $contract->id,
            'new_values'     => ['status' => 'active'],
            'tags'           => ['procurement', 'contract'],
        ]);

        return response()->json(['message' => 'Contract activated.', 'data' => $contract->fresh(['vendor'])]);
    }

    public function terminate(Request $request, Contract $contract): JsonResponse
    {
        $this->gateManage($request);
        if ((int) $contract->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $data = $request->validate(['reason' => ['required', 'string', 'max:1000']]);

        $contract->update([
            'status'             => 'terminated',
            'terminated_at'      => now(),
            'termination_reason' => $data['reason'],
        ]);

        return response()->json(['message' => 'Contract terminated.', 'data' => $contract->fresh()]);
    }

    public function destroy(Request $request, Contract $contract): JsonResponse
    {
        $this->gateManage($request);
        if ((int) $contract->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        if ($contract->status === 'active') {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'status' => ['Cannot delete an active contract. Terminate it first.'],
            ]);
        }

        $contract->delete();
        return response()->json(['message' => 'Contract deleted.']);
    }
}
