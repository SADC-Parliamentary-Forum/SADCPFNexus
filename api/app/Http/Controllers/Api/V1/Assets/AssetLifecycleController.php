<?php

namespace App\Http\Controllers\Api\V1\Assets;

use App\Http\Controllers\Controller;
use App\Models\AssetLocation;
use App\Models\AssetVerificationCampaign;
use App\Modules\Assets\Services\AssetDepreciationService;
use App\Modules\Assets\Services\AssetMaintenanceService;
use App\Modules\Assets\Services\AssetVerificationService;
use App\Models\Asset;
use App\Models\AssetCapitalisationPolicy;
use App\Models\AssetDepreciationRun;
use App\Models\AssetMaintenanceRecord;
use App\Modules\Assets\Services\AssetCapitalisationPolicyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AssetLifecycleController extends Controller
{
    public function __construct(
        private readonly AssetVerificationService $verification,
        private readonly AssetMaintenanceService $maintenance,
        private readonly AssetDepreciationService $depreciation,
        private readonly AssetCapitalisationPolicyService $policies,
    ) {}

    public function locations(Request $request): JsonResponse
    {
        $rows = AssetLocation::where('tenant_id', $request->user()->tenant_id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function storeLocation(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->isSystemAdmin() && ! $user->hasPermissionTo('assets.admin') && ! $user->hasPermissionTo('assets.manage')) {
            abort(403);
        }
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:64'],
            'name' => ['required', 'string', 'max:255'],
            'building' => ['nullable', 'string', 'max:128'],
            'floor' => ['nullable', 'string', 'max:64'],
            'room' => ['nullable', 'string', 'max:64'],
            'location_type' => ['nullable', 'string', 'max:32'],
        ]);
        $loc = AssetLocation::create([
            ...$validated,
            'tenant_id' => $user->tenant_id,
            'location_type' => $validated['location_type'] ?? 'office',
            'is_active' => true,
        ]);

        return response()->json(['data' => $loc], 201);
    }

    public function policies(Request $request): JsonResponse
    {
        $rows = AssetCapitalisationPolicy::where('tenant_id', $request->user()->tenant_id)
            ->orderByDesc('effective_from')
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function storePolicy(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->isSystemAdmin() && ! $user->hasPermissionTo('assets.admin')) {
            abort(403);
        }
        $validated = $request->validate([
            'version' => ['required', 'string', 'max:32'],
            'effective_from' => ['required', 'date'],
            'threshold_amount' => ['required', 'numeric', 'min:0'],
            'threshold_currency' => ['nullable', 'string', 'max:8'],
            'min_useful_life_years' => ['nullable', 'integer', 'min:1'],
            'approved_by' => ['nullable', 'string', 'max:128'],
            'source_document' => ['nullable', 'string', 'max:255'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        $policy = $this->policies->createVersion((int) $user->tenant_id, $validated);

        return response()->json(['data' => $policy], 201);
    }

    public function campaigns(Request $request): JsonResponse
    {
        $rows = AssetVerificationCampaign::where('tenant_id', $request->user()->tenant_id)
            ->orderByDesc('id')
            ->paginate(50);

        return response()->json($rows);
    }

    public function storeCampaign(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'starts_on' => ['required', 'date'],
            'ends_on' => ['nullable', 'date', 'after_or_equal:starts_on'],
        ]);
        $campaign = $this->verification->createCampaign($validated, $request->user());

        return response()->json(['data' => $campaign], 201);
    }

    public function recordVerification(Request $request, AssetVerificationCampaign $assetVerificationCampaign): JsonResponse
    {
        $validated = $request->validate([
            'asset_id' => ['required', 'integer', 'exists:assets,id'],
            'result' => ['required', 'string', 'in:verified,missing,damaged,unregistered,relocated'],
            'condition' => ['nullable', 'string', 'max:32'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
        $result = $this->verification->recordResult($assetVerificationCampaign, $validated, $request->user());

        return response()->json(['data' => $result], 201);
    }

    public function closeCampaign(Request $request, AssetVerificationCampaign $assetVerificationCampaign): JsonResponse
    {
        return response()->json(['data' => $this->verification->closeCampaign($assetVerificationCampaign, $request->user())]);
    }

    public function maintenanceIndex(Request $request): JsonResponse
    {
        $query = AssetMaintenanceRecord::where('tenant_id', $request->user()->tenant_id)
            ->with('asset:id,asset_code,name');
        if ($request->filled('asset_id')) {
            $query->where('asset_id', (int) $request->input('asset_id'));
        }

        return response()->json($query->orderByDesc('id')->paginate(50));
    }

    public function storeMaintenance(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'asset_id' => ['required', 'integer', 'exists:assets,id'],
            'title' => ['required', 'string', 'max:255'],
            'maintenance_type' => ['nullable', 'string', 'in:preventive,corrective,warranty'],
            'description' => ['nullable', 'string'],
            'scheduled_on' => ['nullable', 'date'],
            'cost' => ['nullable', 'numeric', 'min:0'],
            'vendor' => ['nullable', 'string', 'max:128'],
            'under_warranty' => ['nullable', 'boolean'],
            'status' => ['nullable', 'string', 'in:open,in_progress,completed,cancelled'],
        ]);
        $asset = Asset::where('tenant_id', $request->user()->tenant_id)->findOrFail($validated['asset_id']);
        $record = $this->maintenance->create($asset, $validated, $request->user());

        return response()->json(['data' => $record], 201);
    }

    public function completeMaintenance(Request $request, AssetMaintenanceRecord $assetMaintenanceRecord): JsonResponse
    {
        $validated = $request->validate([
            'completed_on' => ['nullable', 'date'],
            'cost' => ['nullable', 'numeric', 'min:0'],
        ]);

        return response()->json(['data' => $this->maintenance->complete($assetMaintenanceRecord, $request->user(), $validated)]);
    }

    public function depreciationRuns(Request $request): JsonResponse
    {
        $rows = AssetDepreciationRun::where('tenant_id', $request->user()->tenant_id)
            ->orderByDesc('id')
            ->paginate(20);

        return response()->json($rows);
    }

    public function runDepreciation(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->isSystemAdmin() && ! $user->hasPermissionTo('assets.admin') && ! $user->hasPermissionTo('finance.approve')) {
            abort(403);
        }
        $run = $this->depreciation->run((int) $user->tenant_id, $user);

        return response()->json([
            'data' => $run,
            'message' => 'Depreciation run completed for monitoring. Official GL remains the accounting system.',
        ], 201);
    }
}
