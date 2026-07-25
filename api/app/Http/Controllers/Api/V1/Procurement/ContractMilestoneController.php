<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\Contract;
use App\Models\ContractMilestone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContractMilestoneController extends Controller
{
    private function gate(Request $request): void
    {
        if (!$request->user()->hasAnyRole(['Procurement Officer', 'Finance Controller', 'System Admin', 'Secretary General', 'super-admin'])) {
            abort(403);
        }
    }

    private function contractFor(Request $request, Contract $contract): Contract
    {
        if ((int) $contract->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        return $contract;
    }

    public function index(Request $request, Contract $contract): JsonResponse
    {
        $this->contractFor($request, $contract);

        return response()->json(['data' => $contract->milestones()->get()]);
    }

    public function store(Request $request, Contract $contract): JsonResponse
    {
        $this->gate($request);
        $this->contractFor($request, $contract);

        $data = $request->validate([
            'title'       => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'due_date'    => ['nullable', 'date'],
            'amount'      => ['nullable', 'numeric', 'min:0'],
            'currency'    => ['nullable', 'string', 'max:10'],
            'notes'       => ['nullable', 'string'],
            'sort_order'  => ['nullable', 'integer', 'min:0'],
        ]);

        $milestone = $contract->milestones()->create(array_merge($data, [
            'tenant_id' => $contract->tenant_id,
            'currency'  => $data['currency'] ?? $contract->currency,
            'status'    => 'pending',
        ]));

        return response()->json(['message' => 'Milestone created.', 'data' => $milestone], 201);
    }

    public function update(Request $request, Contract $contract, ContractMilestone $milestone): JsonResponse
    {
        $this->gate($request);
        $this->contractFor($request, $contract);
        if ((int) $milestone->contract_id !== (int) $contract->id) {
            abort(404);
        }

        $data = $request->validate([
            'title'       => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'due_date'    => ['nullable', 'date'],
            'amount'      => ['nullable', 'numeric', 'min:0'],
            'currency'    => ['nullable', 'string', 'max:10'],
            'status'      => ['nullable', 'string', 'in:pending,in_progress,completed,overdue'],
            'notes'       => ['nullable', 'string'],
            'sort_order'  => ['nullable', 'integer', 'min:0'],
        ]);

        $milestone->update($data);

        return response()->json(['message' => 'Milestone updated.', 'data' => $milestone->fresh()]);
    }

    public function complete(Request $request, Contract $contract, ContractMilestone $milestone): JsonResponse
    {
        $this->gate($request);
        $this->contractFor($request, $contract);
        if ((int) $milestone->contract_id !== (int) $contract->id) {
            abort(404);
        }

        $milestone->update([
            'status'       => 'completed',
            'completed_at' => now(),
            'completed_by' => $request->user()->id,
        ]);

        return response()->json(['message' => 'Milestone completed.', 'data' => $milestone->fresh()]);
    }

    public function destroy(Request $request, Contract $contract, ContractMilestone $milestone): JsonResponse
    {
        $this->gate($request);
        $this->contractFor($request, $contract);
        if ((int) $milestone->contract_id !== (int) $contract->id) {
            abort(404);
        }
        $milestone->delete();

        return response()->json(['message' => 'Milestone deleted.']);
    }
}
