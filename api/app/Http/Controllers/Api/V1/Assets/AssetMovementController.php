<?php

namespace App\Http\Controllers\Api\V1\Assets;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\AssetMovement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AssetMovementController extends Controller
{
    /**
     * List all movements for the current tenant, optionally filtered by asset.
     */
    public function index(Request $request): JsonResponse
    {
        $query = AssetMovement::where('tenant_id', $request->user()->tenant_id)
            ->with([
                'asset:id,asset_code,name,category',
                'fromUser:id,name,email',
                'toUser:id,name,email',
                'recorder:id,name,email',
            ])
            ->orderByDesc('movement_date')
            ->orderByDesc('created_at');

        if ($assetId = $request->integer('asset_id')) {
            $query->where('asset_id', $assetId);
        }

        if ($type = $request->string('movement_type')) {
            $query->where('movement_type', $type);
        }

        $movements = $query->paginate($request->integer('per_page', 20));

        return response()->json($movements);
    }

    /**
     * Record a new asset movement.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'asset_id'      => ['required', 'integer', 'exists:assets,id'],
            'from_user_id'  => ['nullable', 'integer', 'exists:users,id'],
            'to_user_id'    => ['nullable', 'integer', 'exists:users,id'],
            'movement_type' => ['required', 'in:transfer,maintenance,disposal,storage,return'],
            'reason'        => ['nullable', 'string', 'max:255'],
            'notes'         => ['nullable', 'string'],
            'movement_date' => ['required', 'date'],
        ]);

        $data['tenant_id']   = $request->user()->tenant_id;
        $data['recorded_by'] = $request->user()->id;

        $movement = AssetMovement::create($data);

        // If it's a transfer, update the asset's assigned_to
        if ($data['movement_type'] === 'transfer' && isset($data['to_user_id'])) {
            Asset::where('id', $data['asset_id'])->update([
                'assigned_to' => $data['to_user_id'],
                'issued_at'   => $data['movement_date'],
            ]);
        }

        $movement->load(['asset:id,asset_code,name', 'fromUser:id,name', 'toUser:id,name', 'recorder:id,name']);

        return response()->json(['data' => $movement, 'message' => 'Movement recorded successfully.'], 201);
    }

    /**
     * Show a single movement.
     */
    public function show(AssetMovement $assetMovement): JsonResponse
    {
        $assetMovement->load(['asset:id,asset_code,name,category', 'fromUser:id,name,email', 'toUser:id,name,email', 'recorder:id,name,email']);

        return response()->json($assetMovement);
    }
}
