<?php

namespace App\Http\Controllers\Api\V1\Risk;

use App\Http\Controllers\Controller;
use App\Modules\Risk\Services\RiskMatrixService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RiskMatrixController extends Controller
{
    public function __construct(private readonly RiskMatrixService $matrixService) {}

    public function matrix(Request $request): JsonResponse
    {
        $filters = $request->only(['exclude_closed']);
        $data = $this->matrixService->matrix($request->user(), $filters);
        return response()->json($data);
    }
}
