<?php

namespace App\Http\Controllers\Api\V1\Risk;

use App\Http\Controllers\Controller;
use App\Modules\Risk\Services\RiskDashboardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RiskDashboardController extends Controller
{
    public function __construct(private readonly RiskDashboardService $dashboardService) {}

    public function summary(Request $request): JsonResponse
    {
        $data = $this->dashboardService->summary($request->user());
        return response()->json(['data' => $data]);
    }
}
