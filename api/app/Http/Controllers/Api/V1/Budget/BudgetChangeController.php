<?php

namespace App\Http\Controllers\Api\V1\Budget;

use App\Http\Controllers\Controller;
use App\Models\BudgetChangeRequest;
use App\Modules\Budget\Services\BudgetChangeApplyService;
use App\Modules\Budget\Services\BudgetChangeRequestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class BudgetChangeController extends Controller
{
    public function __construct(
        private readonly BudgetChangeRequestService $changes,
        private readonly BudgetChangeApplyService $apply,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', 'string', 'max:40'],
            'type' => ['nullable', Rule::in(BudgetChangeRequest::TYPES)],
            'budget_id' => ['nullable', 'integer'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->changes->list((int) $request->user()->tenant_id, $filters),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validatedPayload($request, true);
        $row = $this->changes->create($data, $request->user());

        return response()->json(['success' => true, 'data' => $row], 201);
    }

    public function show(Request $request, BudgetChangeRequest $change): JsonResponse
    {
        $this->assertTenant($request, $change);
        $change->load([
            'items.sourceLine',
            'items.targetLine',
            'preparer',
            'budget',
            'financialYear',
        ]);

        return response()->json(['success' => true, 'data' => $change]);
    }

    public function update(Request $request, BudgetChangeRequest $change): JsonResponse
    {
        $this->assertTenant($request, $change);
        $data = $this->validatedPayload($request, false);
        $row = $this->changes->update($change, $data, $request->user());

        return response()->json(['success' => true, 'data' => $row]);
    }

    public function submit(Request $request, BudgetChangeRequest $change): JsonResponse
    {
        $this->assertTenant($request, $change);
        $row = $this->changes->submit($change, $request->user());

        return response()->json(['success' => true, 'data' => $row]);
    }

    public function financeDecide(Request $request, BudgetChangeRequest $change): JsonResponse
    {
        $this->assertTenant($request, $change);
        $data = $request->validate([
            'decision' => ['required', 'in:approve,return,reject'],
            'comments' => ['nullable', 'string', 'max:5000'],
        ]);

        $row = $this->changes->financeDecide($change, $data['decision'], $request->user(), $data['comments'] ?? null);

        return response()->json(['success' => true, 'data' => $row]);
    }

    public function sgDecide(Request $request, BudgetChangeRequest $change): JsonResponse
    {
        $this->assertTenant($request, $change);
        $data = $request->validate([
            'decision' => ['required', 'in:approve,return,reject'],
            'comments' => ['nullable', 'string', 'max:5000'],
        ]);

        $row = $this->changes->sgDecide($change, $data['decision'], $request->user(), $data['comments'] ?? null);

        return response()->json(['success' => true, 'data' => $row]);
    }

    public function apply(Request $request, BudgetChangeRequest $change): JsonResponse
    {
        $this->assertTenant($request, $change);
        $row = $this->apply->apply($change, $request->user());

        return response()->json(['success' => true, 'data' => $row]);
    }

    private function validatedPayload(Request $request, bool $creating): array
    {
        return $request->validate([
            'budget_id' => [$creating ? 'required' : 'nullable', 'integer', 'exists:budgets,id'],
            'type' => [$creating ? 'required' : 'nullable', Rule::in(BudgetChangeRequest::TYPES)],
            'title' => [$creating ? 'required' : 'nullable', 'string', 'max:255'],
            'justification' => ['nullable', 'string'],
            'items' => ['nullable', 'array'],
            'items.*.source_budget_line_id' => ['nullable', 'integer', 'exists:budget_lines,id'],
            'items.*.target_budget_line_id' => ['nullable', 'integer', 'exists:budget_lines,id'],
            'items.*.new_line_code' => ['nullable', 'string', 'max:60'],
            'items.*.new_line_name' => ['nullable', 'string', 'max:255'],
            'items.*.new_line_category' => ['nullable', 'string', 'max:80'],
            'items.*.new_line_funding_source_id' => ['nullable', 'integer', 'exists:funding_sources,id'],
            'items.*.amount' => ['required_with:items', 'numeric', 'min:0.01'],
            'items.*.is_decrease' => ['nullable', 'boolean'],
            'items.*.notes' => ['nullable', 'string'],
        ]);
    }

    private function assertTenant(Request $request, BudgetChangeRequest $change): void
    {
        if ((int) $change->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
    }
}
