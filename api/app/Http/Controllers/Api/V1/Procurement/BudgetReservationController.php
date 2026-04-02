<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\BudgetReservation;
use App\Models\ProcurementRequest;
use App\Modules\Procurement\Services\BudgetReservationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BudgetReservationController extends Controller
{
    public function __construct(private readonly BudgetReservationService $budgetReservationService) {}

    public function index(Request $request): JsonResponse
    {
        if (!$request->user()->hasAnyRole(['Finance Controller', 'System Admin', 'super-admin'])) {
            abort(403);
        }
        $filters = $request->only(['per_page']);
        return response()->json($this->budgetReservationService->list($filters, $request->user()));
    }

    public function store(Request $request, ProcurementRequest $procurementRequest): JsonResponse
    {
        if (!$request->user()->hasAnyRole(['Finance Controller', 'System Admin', 'super-admin'])) {
            abort(403);
        }
        if ((int) $procurementRequest->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $data = $request->validate([
            'budget_line'     => ['required', 'string', 'max:200'],
            'reserved_amount' => ['required', 'numeric', 'min:0.01'],
            'currency'        => ['nullable', 'string', 'size:3'],
            'notes'           => ['nullable', 'string', 'max:1000'],
        ]);

        // Additional validation: reserved_amount cannot exceed estimated_value
        if ($data['reserved_amount'] > $procurementRequest->estimated_value) {
            return response()->json([
                'message' => 'Validation failed.',
                'errors'  => [
                    'reserved_amount' => [
                        'Reserved amount cannot exceed the estimated value of ' . number_format($procurementRequest->estimated_value, 2),
                    ],
                ],
            ], 422);
        }

        $reservation = $this->budgetReservationService->reserve($procurementRequest, $data, $request->user());
        return response()->json(['message' => 'Budget reserved successfully.', 'data' => $reservation], 201);
    }

    public function destroy(Request $request, BudgetReservation $budgetReservation): JsonResponse
    {
        if (!$request->user()->hasAnyRole(['Finance Controller', 'System Admin', 'super-admin'])) {
            abort(403);
        }
        if ((int) $budgetReservation->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $reservation = $this->budgetReservationService->release($budgetReservation, $request->user());
        return response()->json(['message' => 'Budget reservation released.', 'data' => $reservation]);
    }
}
