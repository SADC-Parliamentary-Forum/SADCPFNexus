<?php

namespace App\Http\Controllers\Api\V1\Assets;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\AssetDisposal;
use App\Modules\Assets\Services\AssetDisposalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AssetDisposalController extends Controller
{
    public function __construct(private readonly AssetDisposalService $disposals)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $query = AssetDisposal::where('tenant_id', $request->user()->tenant_id)
            ->with(['asset:id,asset_code,name,status', 'requester:id,name']);

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        return response()->json($query->orderByDesc('id')->paginate(min((int) $request->input('per_page', 50), 100)));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'asset_id' => ['required', 'integer', 'exists:assets,id'],
            'reason' => ['required', 'string', 'in:obsolete,damaged,lost,stolen,surplus,other'],
            'method' => ['nullable', 'string', 'in:sale,donation,scrap,write_off,transfer'],
            'justification' => ['required', 'string', 'max:5000'],
            'estimated_value' => ['nullable', 'numeric', 'min:0'],
        ]);
        $asset = Asset::where('tenant_id', $request->user()->tenant_id)->findOrFail($validated['asset_id']);
        $disposal = $this->disposals->request($asset, $validated, $request->user());

        return response()->json(['data' => $disposal, 'message' => 'Disposal requested.'], 201);
    }

    public function recommend(Request $request, AssetDisposal $assetDisposal): JsonResponse
    {
        $validated = $request->validate(['comments' => ['nullable', 'string', 'max:2000']]);
        $disposal = $this->disposals->recommend($assetDisposal, $request->user(), $validated['comments'] ?? null);

        return response()->json(['data' => $disposal, 'message' => 'HOD recommendation recorded.']);
    }

    public function financeReview(Request $request, AssetDisposal $assetDisposal): JsonResponse
    {
        $validated = $request->validate(['comments' => ['nullable', 'string', 'max:2000']]);
        $disposal = $this->disposals->financeReview($assetDisposal, $request->user(), $validated['comments'] ?? null);

        return response()->json(['data' => $disposal, 'message' => 'Finance review recorded.']);
    }

    public function approve(Request $request, AssetDisposal $assetDisposal): JsonResponse
    {
        $disposal = $this->disposals->approve($assetDisposal, $request->user());

        return response()->json(['data' => $disposal, 'message' => 'Disposal approved.']);
    }

    public function complete(Request $request, AssetDisposal $assetDisposal): JsonResponse
    {
        $validated = $request->validate([
            'method' => ['nullable', 'string', 'in:sale,donation,scrap,write_off,transfer'],
            'proceeds' => ['nullable', 'numeric', 'min:0'],
            'accounting_reference' => ['nullable', 'string', 'max:128'],
        ]);
        $disposal = $this->disposals->complete($assetDisposal, $request->user(), $validated);

        return response()->json(['data' => $disposal, 'message' => 'Disposal completed. Asset retained in register.']);
    }
}
