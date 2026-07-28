<?php

namespace App\Http\Controllers\Api\V1\Stock;

use App\Http\Controllers\Controller;
use App\Modules\Stock\Services\StockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StockDashboardController extends Controller
{
    public function __construct(private readonly StockService $stockService) {}

    public function __invoke(Request $request): JsonResponse
    {
        $data = $this->stockService->dashboard((int) $request->user()->tenant_id);

        return response()->json(['data' => $data]);
    }
}
