<?php

namespace App\Http\Controllers\Api\V1\MAndE;

use App\Http\Controllers\Controller;
use App\Modules\MAndE\Services\MeAiAssistService;
use App\Modules\MAndE\Services\MeIndicatorAggregationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeAiAssistController extends Controller
{
    public function __construct(
        private readonly MeAiAssistService $ai,
        private readonly MeIndicatorAggregationService $aggregation,
    ) {}

    public function draft(Request $request): JsonResponse
    {
        $data = $request->validate([
            'scope' => ['nullable', 'string', 'max:64'],
            'context' => ['nullable'],
        ]);

        return response()->json(['data' => $this->ai->draft($data, $request->user())]);
    }

    public function confirm(Request $request): JsonResponse
    {
        $data = $request->validate([
            'draft' => ['required', 'string', 'max:20000'],
        ]);

        return response()->json(['data' => $this->ai->confirm($data['draft'], $request->user())]);
    }

    public function aggregation(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->aggregation->aggregate(
                $request->user(),
                $request->integer('results_framework_id') ?: null
            ),
        ]);
    }
}
