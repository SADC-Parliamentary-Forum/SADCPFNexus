<?php

namespace App\Http\Controllers\Api\V1\Risk;

use App\Http\Controllers\Controller;
use App\Models\RiskKri;
use App\Modules\Risk\Services\RiskKriService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RiskKriController extends Controller
{
    public function __construct(private readonly RiskKriService $service) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->can('risk.view') || $user->can('risk.manage') || $user->can('risk.admin'), 403);

        return response()->json(['data' => $this->service->listForTenant((int) $user->tenant_id)]);
    }

    public function catalog(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->can('risk.view') || $user->can('risk.manage') || $user->can('risk.admin'), 403);

        return response()->json(['data' => $this->service->catalog()]);
    }

    public function evaluate(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->can('risk.manage') || $user->can('risk.admin'), 403);

        $kris = $this->service->evaluateTenant((int) $user->tenant_id, true);

        return response()->json(['data' => $kris, 'message' => 'KRIs evaluated.']);
    }

    public function update(Request $request, RiskKri $kri): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->can('risk.manage') || $user->can('risk.admin'), 403);
        abort_unless((int) $kri->tenant_id === (int) $user->tenant_id, 404);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string'],
            'warning_threshold' => ['sometimes', 'nullable', 'numeric'],
            'breach_threshold' => ['sometimes', 'nullable', 'numeric'],
            'risk_id' => ['sometimes', 'nullable', 'integer', 'exists:risks,id'],
            'strategic_objective_id' => ['sometimes', 'nullable', 'integer', 'exists:strategic_objectives,id'],
            'enabled' => ['sometimes', 'boolean'],
        ]);

        return response()->json(['data' => $this->service->update($kri, $data)]);
    }
}
