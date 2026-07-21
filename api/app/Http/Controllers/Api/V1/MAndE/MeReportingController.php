<?php

namespace App\Http\Controllers\Api\V1\MAndE;

use App\Http\Controllers\Controller;
use App\Modules\MAndE\Services\MeReportingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeReportingController extends Controller
{
    public function __construct(private readonly MeReportingService $service) {}

    public function strategic(Request $request): JsonResponse
    {
        $filters = $request->only(['strategic_goal_id', 'thematic_area_id', 'date_from', 'date_to']);
        return response()->json(['data' => $this->service->strategic($request->user(), $filters)]);
    }
}
