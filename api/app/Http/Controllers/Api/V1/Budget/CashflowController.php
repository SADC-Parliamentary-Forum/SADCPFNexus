<?php

namespace App\Http\Controllers\Api\V1\Budget;

use App\Http\Controllers\Controller;
use App\Models\CashflowInflow;
use App\Models\CashflowScenario;
use App\Models\CashflowScenarioAdjustment;
use App\Modules\Budget\Services\CashflowForecastService;
use App\Modules\Budget\Services\CashflowInflowService;
use App\Modules\Budget\Services\CashflowScenarioService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Http\Response;

class CashflowController extends Controller
{
    public function __construct(
        private readonly CashflowForecastService $forecasts,
        private readonly CashflowScenarioService $scenarios,
        private readonly CashflowInflowService $inflows,
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

    public function exportForecast(Request $request): Response
    {
        $filters = $request->validate([
            'financial_year_id' => ['required', 'integer'],
            'scenario_id' => ['nullable', 'integer'],
            'department_id' => ['nullable', 'integer'],
            'funding_source_id' => ['nullable', 'integer'],
            'as_of' => ['nullable', 'date'],
        ]);

        return $this->forecasts->exportForecastCsv((int) $request->user()->tenant_id, $filters);
    }

    public function compare(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'financial_year_id' => ['required', 'integer'],
            'scenario_ids' => ['required', 'array', 'min:2', 'max:5'],
            'scenario_ids.*' => ['integer'],
            'department_id' => ['nullable', 'integer'],
            'funding_source_id' => ['nullable', 'integer'],
            'as_of' => ['nullable', 'date'],
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->forecasts->compare((int) $request->user()->tenant_id, $filters),
        ]);
    }

    public function exportCompare(Request $request): Response
    {
        $filters = $request->validate([
            'financial_year_id' => ['required', 'integer'],
            'scenario_ids' => ['required', 'array', 'min:2', 'max:5'],
            'scenario_ids.*' => ['integer'],
            'department_id' => ['nullable', 'integer'],
            'funding_source_id' => ['nullable', 'integer'],
            'as_of' => ['nullable', 'date'],
        ]);

        return $this->forecasts->exportCompareCsv((int) $request->user()->tenant_id, $filters);
    }

    public function indexInflows(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'financial_year_id' => ['nullable', 'integer'],
            'source_type' => ['nullable', Rule::in(CashflowInflow::SOURCE_TYPES)],
            'status' => ['nullable', Rule::in(CashflowInflow::STATUSES)],
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->inflows->list((int) $request->user()->tenant_id, $filters),
        ]);
    }

    public function storeInflow(Request $request): JsonResponse
    {
        $this->authorizeFinanceWrite($request);

        $data = $request->validate([
            'financial_year_id' => ['required', 'integer'],
            'source_type' => ['required', Rule::in(CashflowInflow::SOURCE_TYPES)],
            'label' => ['required', 'string', 'max:255'],
            'counterparty_name' => ['nullable', 'string', 'max:255'],
            'period' => ['required', 'string', 'regex:/^\d{4}-\d{2}$/'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'currency' => ['nullable', 'string', 'size:3'],
            'status' => ['nullable', Rule::in(CashflowInflow::STATUSES)],
            'funding_source_id' => ['nullable', 'integer', 'exists:funding_sources,id'],
            'notes' => ['nullable', 'string'],
        ]);

        $inflow = $this->inflows->create((int) $request->user()->tenant_id, $data, $request->user());

        return response()->json(['success' => true, 'data' => $inflow], 201);
    }

    public function updateInflow(Request $request, CashflowInflow $inflow): JsonResponse
    {
        $this->authorizeFinanceWrite($request);
        $this->assertInflowTenant($request, $inflow);

        $data = $request->validate([
            'source_type' => ['sometimes', Rule::in(CashflowInflow::SOURCE_TYPES)],
            'label' => ['sometimes', 'string', 'max:255'],
            'counterparty_name' => ['nullable', 'string', 'max:255'],
            'period' => ['sometimes', 'string', 'regex:/^\d{4}-\d{2}$/'],
            'amount' => ['sometimes', 'numeric', 'min:0.01'],
            'currency' => ['sometimes', 'string', 'size:3'],
            'status' => ['sometimes', Rule::in(CashflowInflow::STATUSES)],
            'funding_source_id' => ['nullable', 'integer', 'exists:funding_sources,id'],
            'notes' => ['nullable', 'string'],
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->inflows->update($inflow, $data),
        ]);
    }

    public function destroyInflow(Request $request, CashflowInflow $inflow): JsonResponse
    {
        $this->authorizeFinanceWrite($request);
        $this->assertInflowTenant($request, $inflow);
        $this->inflows->delete($inflow);

        return response()->json(['success' => true]);
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

    private function assertInflowTenant(Request $request, CashflowInflow $inflow): void
    {
        if ((int) $inflow->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
    }
}
