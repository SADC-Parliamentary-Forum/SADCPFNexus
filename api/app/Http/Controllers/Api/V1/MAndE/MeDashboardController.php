<?php

namespace App\Http\Controllers\Api\V1\MAndE;

use App\Http\Controllers\Controller;
use App\Modules\MAndE\Services\MeDashboardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeDashboardController extends Controller
{
    public function __construct(private readonly MeDashboardService $service) {}

    public function summary(Request $request): JsonResponse
    {
        $filters = $request->only([
            'strategic_goal_id', 'thematic_area_id', 'programme_id', 'date_from', 'date_to',
        ]);
        return response()->json(['data' => $this->service->summary($request->user(), $filters)]);
    }
}
