<?php

namespace App\Http\Controllers\Api\V1\Assets;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\AssetRevaluation;
use App\Modules\Assets\Services\AssetRevaluationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AssetRevaluationController extends Controller
{
    public function __construct(private readonly AssetRevaluationService $revaluations)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $query = AssetRevaluation::where('tenant_id', $request->user()->tenant_id)
            ->with(['asset:id,asset_code,name,status,book_value', 'requester:id,name', 'approver:id,name']);

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        return response()->json($query->orderByDesc('id')->paginate(min((int) $request->input('per_page', 50), 100)));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'asset_id' => ['required', 'integer', 'exists:assets,id'],
            'proposed_value' => ['required', 'numeric', 'min:0'],
            'reason' => ['required', 'string', 'max:5000'],
            'effective_date' => ['required', 'date'],
        ]);

        $asset = Asset::where('tenant_id', $request->user()->tenant_id)->findOrFail($validated['asset_id']);
        $reval = $this->revaluations->request($asset, $validated, $request->user());

        return response()->json(['data' => $reval, 'message' => 'Revaluation requested.'], 201);
    }

    public function show(Request $request, AssetRevaluation $assetRevaluation): JsonResponse
    {
        if ((int) $assetRevaluation->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        return response()->json([
            'data' => $assetRevaluation->load(['asset', 'requester:id,name', 'approver:id,name']),
        ]);
    }

    public function approve(Request $request, AssetRevaluation $assetRevaluation): JsonResponse
    {
        $validated = $request->validate(['comments' => ['nullable', 'string', 'max:2000']]);
        $reval = $this->revaluations->approve($assetRevaluation, $request->user(), $validated['comments'] ?? null);

        return response()->json(['data' => $reval, 'message' => 'Revaluation approved. Book value updated.']);
    }

    public function reject(Request $request, AssetRevaluation $assetRevaluation): JsonResponse
    {
        $validated = $request->validate(['reason' => ['required', 'string', 'max:2000']]);
        $reval = $this->revaluations->reject($assetRevaluation, $request->user(), $validated['reason']);

        return response()->json(['data' => $reval, 'message' => 'Revaluation rejected.']);
    }
}
