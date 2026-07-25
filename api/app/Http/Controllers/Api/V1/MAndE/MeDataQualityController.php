<?php

namespace App\Http\Controllers\Api\V1\MAndE;

use App\Http\Controllers\Controller;
use App\Modules\MAndE\Services\MeDataQualityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeDataQualityController extends Controller
{
    public function __construct(private readonly MeDataQualityService $service) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->service->scan($request->user())]);
    }
}
