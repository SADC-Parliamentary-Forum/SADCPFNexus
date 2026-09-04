<?php

namespace App\Http\Controllers\Api\V1\Assets;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\AssetQrToken;
use App\Modules\Assets\Services\AssetQrService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PublicAssetQrController extends Controller
{
    public function __construct(private readonly AssetQrService $qr) {}

    public function show(string $token): JsonResponse
    {
        $record = $this->qr->findByToken($token);
        if (! $record) {
            return response()->json(['message' => 'Asset not found.'], 404);
        }
        $asset = $record->asset;
        if (! $asset) {
            return response()->json(['message' => 'Asset not found.'], 404);
        }

        return response()->json(['data' => $this->qr->publicPayload($asset)]);
    }

    public function authenticated(Request $request, string $token): JsonResponse
    {
        $record = AssetQrToken::query()->where('token', $token)->whereNull('revoked_at')->first();
        if (! $record) {
            return response()->json(['message' => 'Asset not found.'], 404);
        }
        $asset = Asset::query()->with(['location', 'assignedUser'])->find($record->asset_id);
        if (! $asset || (int) $asset->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $user = $request->user();
        // Staff hold finance.view for self-service advances; asset book values stay admin/finance-control.
        $canFinance = $user->isSystemAdmin()
            || $user->hasPermissionTo('assets.admin')
            || $user->hasPermissionTo('finance.admin')
            || $user->hasPermissionTo('finance.approve')
            || $user->hasPermissionTo('finance.export');

        return response()->json([
            'data' => [
                'id' => $asset->id,
                'uuid' => $asset->uuid,
                'asset_tag' => $asset->tag_number ?: $asset->asset_code,
                'name' => $asset->name,
                'make' => $asset->manufacturer,
                'model' => $asset->model,
                'serial_number' => $asset->serial_number,
                'location' => $asset->location,
                'custodian' => $asset->assignedUser?->only(['id', 'name', 'email']),
                'status' => $asset->status,
                'condition' => $asset->condition,
                'verification_status' => $asset->verification_status,
                'purchase_value' => $canFinance ? $asset->purchase_value : null,
                'book_value' => $canFinance ? $asset->book_value : null,
            ],
        ]);
    }
}
