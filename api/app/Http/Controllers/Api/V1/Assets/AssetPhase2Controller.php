<?php

namespace App\Http\Controllers\Api\V1\Assets;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\AssetAttestationCampaign;
use App\Models\AssetEquipmentTemplate;
use App\Models\AssetKit;
use App\Models\AssetLocation;
use App\Models\AssetScanBasket;
use App\Modules\Assets\Services\AssetHandoverService;
use App\Modules\Assets\Services\AssetPhase2Service;
use App\Modules\Assets\Support\AssetAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AssetPhase2Controller extends Controller
{
    public function __construct(
        private readonly AssetPhase2Service $ops,
        private readonly AssetHandoverService $handovers,
    ) {}

    public function storeBasket(Request $request): JsonResponse
    {
        $basket = $this->ops->createBasket($request->user());

        return response()->json(['data' => $this->ops->presentBasket($basket)], 201);
    }

    public function showBasket(Request $request, AssetScanBasket $scanBasket): JsonResponse
    {
        $this->assertTenant($scanBasket->tenant_id, $request->user());

        return response()->json(['data' => $this->ops->presentBasket($scanBasket)]);
    }

    public function addBasketItem(Request $request, AssetScanBasket $scanBasket): JsonResponse
    {
        $data = $request->validate([
            'token' => ['nullable', 'string', 'max:255'],
            'nfc_uid' => ['nullable', 'string', 'max:64'],
        ]);
        $this->ops->addBasketItem($scanBasket, $request->user(), $data);

        return response()->json(['data' => $this->ops->presentBasket($scanBasket->fresh())], 201);
    }

    public function startBasketHandover(Request $request, AssetScanBasket $scanBasket): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', 'string', 'in:issue,transfer,return'],
            'custody_target_type' => ['required', 'string', 'in:person,department,location,pool,vehicle_facility'],
            'to_user_id' => ['nullable', 'integer'],
            'to_department_id' => ['nullable', 'integer'],
            'to_location_id' => ['nullable', 'integer'],
            'delegate_user_id' => ['nullable', 'integer'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
        $handover = $this->ops->startHandoverFromBasket($scanBasket, $request->user(), $data);

        return response()->json(['data' => $this->handovers->present($handover, $request->user())], 201);
    }

    public function indexKits(Request $request): JsonResponse
    {
        $this->assertManage($request->user());
        $kits = AssetKit::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->with('items.asset')
            ->orderByDesc('id')
            ->get()
            ->map(fn (AssetKit $kit) => $this->ops->presentKit($kit));

        return response()->json(['data' => $kits]);
    }

    public function storeKit(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:191'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'asset_ids' => ['nullable', 'array'],
            'asset_ids.*' => ['integer'],
        ]);
        $kit = $this->ops->createKit($request->user(), $data);

        return response()->json(['data' => $this->ops->presentKit($kit)], 201);
    }

    public function setParent(Request $request, Asset $asset): JsonResponse
    {
        $data = $request->validate([
            'parent_asset_id' => ['nullable', 'integer'],
        ]);
        $updated = $this->ops->setParent($asset, $request->user(), isset($data['parent_asset_id']) ? (int) $data['parent_asset_id'] : null);

        return response()->json(['data' => [
            'id' => $updated->id,
            'parent_asset_id' => $updated->parent_asset_id,
        ]]);
    }

    public function issueRoomToken(Request $request, AssetLocation $assetLocation): JsonResponse
    {
        $updated = $this->ops->issueRoomToken($assetLocation, $request->user());

        return response()->json(['data' => [
            'id' => $updated->id,
            'name' => $updated->name,
            'qr_token' => $updated->qr_token,
        ]]);
    }

    public function showRoom(Request $request, string $token): JsonResponse
    {
        return response()->json(['data' => $this->ops->roomByToken($token, $request->user())]);
    }

    public function indexTemplates(Request $request): JsonResponse
    {
        $this->assertManage($request->user());
        $rows = AssetEquipmentTemplate::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->orderByDesc('id')
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function storeTemplate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:191'],
            'role_name' => ['required', 'string', 'max:64'],
            'required_categories' => ['required', 'array', 'min:1'],
            'required_categories.*' => ['string', 'max:64'],
        ]);
        $template = $this->ops->createTemplate($request->user(), $data);

        return response()->json(['data' => $template], 201);
    }

    public function templateGaps(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_id' => ['required', 'integer'],
        ]);

        return response()->json(['data' => $this->ops->templateGaps($request->user(), (int) $data['user_id'])]);
    }

    public function indexAttestations(Request $request): JsonResponse
    {
        $this->assertManage($request->user());
        $rows = AssetAttestationCampaign::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->withCount('responses')
            ->orderByDesc('id')
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function storeAttestation(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:191'],
            'due_on' => ['nullable', 'date'],
        ]);
        $campaign = $this->ops->createAttestation($request->user(), $data);

        return response()->json(['data' => $campaign], 201);
    }

    public function attest(Request $request, AssetAttestationCampaign $assetAttestationCampaign): JsonResponse
    {
        $data = $request->validate([
            'asset_ids' => ['required', 'array', 'min:1'],
            'asset_ids.*' => ['integer'],
            'confirmed' => ['nullable', 'boolean'],
        ]);
        $campaign = $this->ops->attest($assetAttestationCampaign, $request->user(), $data);

        return response()->json(['data' => $campaign]);
    }

    public function storePlannerSlot(Request $request): JsonResponse
    {
        $data = $request->validate([
            'asset_id' => ['required', 'integer'],
            'to_user_id' => ['required', 'integer'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
        $slot = $this->ops->createPlannerSlot($request->user(), $data);
        $handover = $slot->handover()->firstOrFail();

        return response()->json([
            'data' => [
                'id' => $slot->id,
                'asset_id' => $slot->asset_id,
                'to_user_id' => $slot->to_user_id,
                'notes' => $slot->notes,
                'handover' => $this->handovers->present($handover, $request->user()),
            ],
        ], 201);
    }

    private function assertManage($user): void
    {
        if (! AssetAccess::canManage($user) && ! AssetAccess::canManageHandover($user)) {
            abort(403);
        }
    }

    private function assertTenant(mixed $tenantId, $user): void
    {
        if ((int) $tenantId !== (int) $user->tenant_id) {
            abort(404);
        }
    }
}
