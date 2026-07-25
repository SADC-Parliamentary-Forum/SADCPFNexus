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

    public function donor(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'results_framework_id' => ['nullable', 'integer'],
            'date_from'            => ['nullable', 'date'],
            'date_to'              => ['nullable', 'date', 'after_or_equal:date_from'],
            'review_status'        => ['nullable', 'string', 'max:40'],
            'thematic_area_id'     => ['nullable', 'integer'],
            'strategic_goal_id'    => ['nullable', 'integer'],
        ]);

        return response()->json(['data' => $this->service->donor($request->user(), $filters)]);
    }

    public function calendar(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'month' => ['nullable', 'date_format:Y-m'],
        ]);

        return response()->json(['data' => $this->service->calendar($request->user(), $filters)]);
    }
}
