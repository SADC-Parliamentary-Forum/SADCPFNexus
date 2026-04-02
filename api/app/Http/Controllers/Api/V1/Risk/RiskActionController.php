<?php

namespace App\Http\Controllers\Api\V1\Risk;

use App\Http\Controllers\Controller;
use App\Models\Risk;
use App\Models\RiskAction;
use App\Modules\Risk\Services\RiskActionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RiskActionController extends Controller
{
    public function __construct(private readonly RiskActionService $actionService) {}

    private function resolveRisk(int $riskId, Request $request): Risk
    {
        return Risk::where('id', $riskId)
            ->where('tenant_id', $request->user()->tenant_id)
            ->firstOrFail();
    }

    public function index(Request $request, Risk $risk): JsonResponse
    {
        // Tenant isolation
        if ((int) $risk->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $actions = $this->actionService->list($risk, $request->user());
        return response()->json(['data' => $actions]);
    }

    public function store(Request $request, Risk $risk): JsonResponse
    {
        if ((int) $risk->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $data = $request->validate([
            'description'    => ['required', 'string', 'max:2000'],
            'action_plan'    => ['nullable', 'string', 'max:5000'],
            'treatment_type' => ['nullable', 'string', 'in:mitigate,accept,transfer,avoid'],
            'due_date'       => ['nullable', 'date'],
            'owner_id'       => ['nullable', 'integer', 'exists:users,id'],
            'notes'          => ['nullable', 'string', 'max:2000'],
        ]);

        $action = $this->actionService->create($risk, $data, $request->user());
        return response()->json(['message' => 'Action added.', 'data' => $action], 201);
    }

    public function update(Request $request, Risk $risk, RiskAction $action): JsonResponse
    {
        if ((int) $risk->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        // Ensure the action belongs to the risk
        if ((int) $action->risk_id !== (int) $risk->id) {
            abort(404);
        }

        $data = $request->validate([
            'description'    => ['sometimes', 'string', 'max:2000'],
            'action_plan'    => ['nullable', 'string', 'max:5000'],
            'treatment_type' => ['nullable', 'string', 'in:mitigate,accept,transfer,avoid'],
            'due_date'       => ['nullable', 'date'],
            'status'         => ['nullable', 'string', 'in:planned,in_progress,completed,overdue'],
            'progress'       => ['nullable', 'integer', 'min:0', 'max:100'],
            'owner_id'       => ['nullable', 'integer', 'exists:users,id'],
            'notes'          => ['nullable', 'string', 'max:2000'],
        ]);

        $updated = $this->actionService->update($action, $data, $request->user());
        return response()->json(['message' => 'Action updated.', 'data' => $updated]);
    }

    public function markComplete(Request $request, Risk $risk, RiskAction $action): JsonResponse
    {
        if ((int) $risk->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        if ((int) $action->risk_id !== (int) $risk->id) {
            abort(404);
        }

        $data = $request->validate([
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $updated = $this->actionService->markComplete($action, $data, $request->user());
        return response()->json(['message' => 'Action marked complete.', 'data' => $updated]);
    }

    public function destroy(Request $request, Risk $risk, RiskAction $action): JsonResponse
    {
        if ((int) $risk->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        if ((int) $action->risk_id !== (int) $risk->id) {
            abort(404);
        }

        $this->actionService->delete($action, $request->user());
        return response()->json(['message' => 'Action deleted.']);
    }
}
