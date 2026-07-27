<?php

namespace App\Http\Controllers\Api\V1\Budget;

use App\Http\Controllers\Controller;
use App\Models\CashflowScenario;
use App\Models\CashflowScenarioAdjustment;
use App\Modules\Budget\Services\CashflowForecastService;
use App\Modules\Budget\Services\CashflowScenarioService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CashflowController extends Controller
{
    public function __construct(
        private readonly CashflowForecastService $forecasts,
        private readonly CashflowScenarioService $scenarios,
    ) {}

    public function forecast(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'financial_year_id' => ['required', 'integer'],
            'scenario_id' => ['nullable', 'integer'],
            'department_id' => ['nullable', 'integer'],
            'funding_source_id' => ['nullable', 'integer'],
            'as_of' => ['nullable', 'date'],
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->forecasts->forecast((int) $request->user()->tenant_id, $filters),
        ]);
    }

    public function indexScenarios(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'financial_year_id' => ['nullable', 'integer'],
            'status' => ['nullable', Rule::in(CashflowScenario::STATUSES)],
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->scenarios->list((int) $request->user()->tenant_id, $filters),
        ]);
    }

    public function storeScenario(Request $request): JsonResponse
    {
        $this->authorizeFinanceWrite($request);

        $data = $request->validate([
            'financial_year_id' => ['required', 'integer'],
            'name' => ['required', 'string', 'max:255'],
            'kind' => ['nullable', Rule::in(CashflowScenario::KINDS)],
            'opening_balance' => ['nullable', 'numeric'],
            'currency' => ['nullable', 'string', 'size:3'],
            'status' => ['nullable', Rule::in(CashflowScenario::STATUSES)],
            'notes' => ['nullable', 'string'],
        ]);

        $scenario = $this->scenarios->create((int) $request->user()->tenant_id, $data, $request->user());

        return response()->json(['success' => true, 'data' => $scenario], 201);
    }

    public function showScenario(Request $request, CashflowScenario $scenario): JsonResponse
    {
        $this->assertScenarioTenant($request, $scenario);
        $scenario->load('adjustments');

        return response()->json(['success' => true, 'data' => $scenario]);
    }

    public function updateScenario(Request $request, CashflowScenario $scenario): JsonResponse
    {
        $this->authorizeFinanceWrite($request);
        $this->assertScenarioTenant($request, $scenario);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'kind' => ['sometimes', Rule::in(CashflowScenario::KINDS)],
            'opening_balance' => ['sometimes', 'numeric'],
            'currency' => ['sometimes', 'string', 'size:3'],
            'status' => ['sometimes', Rule::in(CashflowScenario::STATUSES)],
            'notes' => ['nullable', 'string'],
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->scenarios->update($scenario, $data),
        ]);
    }

    public function destroyScenario(Request $request, CashflowScenario $scenario): JsonResponse
    {
        $this->authorizeFinanceWrite($request);
        $this->assertScenarioTenant($request, $scenario);
        $this->scenarios->delete($scenario);

        return response()->json(['success' => true]);
    }

    public function storeAdjustment(Request $request, CashflowScenario $scenario): JsonResponse
    {
        $this->authorizeFinanceWrite($request);
        $this->assertScenarioTenant($request, $scenario);

        $data = $request->validate([
            'period' => ['required', 'string', 'regex:/^\d{4}-\d{2}$/'],
            'direction' => ['required', Rule::in(CashflowScenarioAdjustment::DIRECTIONS)],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'label' => ['nullable', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:40'],
            'budget_reservation_id' => ['nullable', 'integer', 'exists:budget_reservations,id'],
            'meta' => ['nullable', 'array'],
        ]);

        $adjustment = $this->scenarios->addAdjustment($scenario, $data);

        return response()->json(['success' => true, 'data' => $adjustment], 201);
    }

    public function destroyAdjustment(
        Request $request,
        CashflowScenario $scenario,
        CashflowScenarioAdjustment $adjustment,
    ): JsonResponse {
        $this->authorizeFinanceWrite($request);
        $this->assertScenarioTenant($request, $scenario);
        $this->scenarios->deleteAdjustment($scenario, $adjustment);

        return response()->json(['success' => true]);
    }

    private function authorizeFinanceWrite(Request $request): void
    {
        $user = $request->user();
        if (
            ! $user->can('finance.create')
            && ! $user->can('finance.admin')
            && ! $user->can('procurement.manage_budget')
            && ! $user->hasRole('Finance Controller')
        ) {
            abort(403);
        }
    }

    private function assertScenarioTenant(Request $request, CashflowScenario $scenario): void
    {
        if ((int) $scenario->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
    }
}
