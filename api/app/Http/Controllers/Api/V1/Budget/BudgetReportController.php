<?php

namespace App\Http\Controllers\Api\V1\Budget;

use App\Http\Controllers\Controller;
use App\Models\BudgetChangeRequest;
use App\Modules\Budget\Services\BudgetReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class BudgetReportController extends Controller
{
    public function __construct(
        private readonly BudgetReportService $reports,
    ) {}

    public function utilisation(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'financial_year_id' => ['nullable', 'integer'],
            'department_id' => ['nullable', 'integer'],
            'funding_source_id' => ['nullable', 'integer'],
            'group_by' => ['nullable', Rule::in(['line', 'department', 'funding_source'])],
            'active_only' => ['nullable', 'boolean'],
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->reports->utilisation((int) $request->user()->tenant_id, $filters),
        ]);
    }

    public function commitmentAgeing(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'financial_year_id' => ['nullable', 'integer'],
            'department_id' => ['nullable', 'integer'],
            'funding_source_id' => ['nullable', 'integer'],
            'as_of' => ['nullable', 'date'],
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->reports->commitmentAgeing((int) $request->user()->tenant_id, $filters),
        ]);
    }

    public function changeRegister(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'financial_year_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'string', 'max:40'],
            'type' => ['nullable', Rule::in(BudgetChangeRequest::TYPES)],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->reports->changeRegister((int) $request->user()->tenant_id, $filters),
        ]);
    }

    public function cycleStatus(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'financial_year_id' => ['nullable', 'integer'],
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->reports->cycleStatus((int) $request->user()->tenant_id, $filters),
        ]);
    }
}
