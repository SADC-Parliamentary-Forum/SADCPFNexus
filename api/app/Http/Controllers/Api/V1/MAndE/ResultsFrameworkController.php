<?php

namespace App\Http\Controllers\Api\V1\MAndE;

use App\Http\Controllers\Controller;
use App\Http\Requests\MAndE\StoreResultsFrameworkRequest;
use App\Models\ResultsFramework;
use App\Modules\MAndE\Services\ResultsFrameworkService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ResultsFrameworkController extends Controller
{
    public function __construct(private readonly ResultsFrameworkService $service) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->only(['type', 'status', 'search', 'per_page']);
        return response()->json($this->service->list($filters, $request->user()));
    }

    public function show(Request $request, ResultsFramework $resultsFramework): JsonResponse
    {
        $this->ensureTenant($request, $resultsFramework);
        return response()->json(['data' => $this->service->get($resultsFramework)]);
    }

    public function store(StoreResultsFrameworkRequest $request): JsonResponse
    {
        $framework = $this->service->create($request->validated(), $request->user());
        return response()->json(['message' => 'Results framework created.', 'data' => $framework], 201);
    }

    public function update(StoreResultsFrameworkRequest $request, ResultsFramework $resultsFramework): JsonResponse
    {
        $this->ensureTenant($request, $resultsFramework);
        $framework = $this->service->update($resultsFramework, $request->validated(), $request->user());
        return response()->json(['message' => 'Results framework updated.', 'data' => $framework]);
    }

    public function destroy(Request $request, ResultsFramework $resultsFramework): JsonResponse
    {
        $this->ensureTenant($request, $resultsFramework);
        $this->service->delete($resultsFramework, $request->user());
        return response()->json(['message' => 'Results framework deleted.']);
    }

    private function ensureTenant(Request $request, ResultsFramework $framework): void
    {
        if ((int) $framework->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
    }
}
