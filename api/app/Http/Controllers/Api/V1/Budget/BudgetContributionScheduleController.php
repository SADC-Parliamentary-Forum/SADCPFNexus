<?php

namespace App\Http\Controllers\Api\V1\Budget;

use App\Http\Controllers\Controller;
use App\Models\BudgetContributionSchedule;
use App\Modules\Budget\Services\BudgetContributionScheduleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BudgetContributionScheduleController extends Controller
{
    public function __construct(private readonly BudgetContributionScheduleService $service) {}

    public function index(Request $request): JsonResponse
    {
        $rows = BudgetContributionSchedule::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->orderBy('next_due_date')
            ->paginate($request->integer('per_page', 50));

        return response()->json($rows);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'donor_name' => ['required', 'string', 'max:255'],
            'source_type' => ['nullable', 'string', 'in:donor,membership,other'],
            'currency' => ['nullable', 'string', 'size:3'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'frequency' => ['required', 'string', 'in:monthly,quarterly,annual,one_off'],
            'start_date' => ['required', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'status' => ['nullable', 'string', 'in:active,paused,completed'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $row = $this->service->create($data, $request->user());

        return response()->json(['data' => $row], 201);
    }

    public function upcoming(Request $request, BudgetContributionSchedule $contributionSchedule): JsonResponse
    {
        abort_unless((int) $contributionSchedule->tenant_id === (int) $request->user()->tenant_id, 404);

        return response()->json([
            'data' => $this->service->upcoming($contributionSchedule, $request->integer('months', 6)),
        ]);
    }
}
