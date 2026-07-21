<?php

namespace App\Http\Controllers\Api\V1\MAndE;

use App\Http\Controllers\Controller;
use App\Http\Requests\MAndE\StoreIndicatorRequest;
use App\Http\Requests\MAndE\UpdateIndicatorRequest;
use App\Models\Indicator;
use App\Modules\MAndE\Services\IndicatorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class IndicatorController extends Controller
{
    public function __construct(private readonly IndicatorService $service) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->only([
            'result_level', 'results_framework_id', 'programme_id', 'is_active', 'search', 'per_page',
        ]);
        return response()->json($this->service->list($filters, $request->user()));
    }

    public function show(Request $request, Indicator $indicator): JsonResponse
    {
        $this->ensureTenant($request, $indicator);
        return response()->json(['data' => $this->service->get($indicator)]);
    }

    public function store(StoreIndicatorRequest $request): JsonResponse
    {
        $indicator = $this->service->create($request->validated(), $request->user());
        return response()->json(['message' => 'Indicator created.', 'data' => $indicator], 201);
    }

    public function update(UpdateIndicatorRequest $request, Indicator $indicator): JsonResponse
    {
        $this->ensureTenant($request, $indicator);
        $indicator = $this->service->update($indicator, $request->validated(), $request->user());
        return response()->json(['message' => 'Indicator updated.', 'data' => $indicator]);
    }

    public function destroy(Request $request, Indicator $indicator): JsonResponse
    {
        $this->ensureTenant($request, $indicator);
        $this->service->delete($indicator, $request->user());
        return response()->json(['message' => 'Indicator deleted.']);
    }

    private function ensureTenant(Request $request, Indicator $indicator): void
    {
        if ((int) $indicator->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
    }
}
