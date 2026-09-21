<?php

namespace App\Http\Controllers\Api\V1\Assets;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\AssetLocationHistory;
use App\Models\AssetMovement;
use App\Models\AuditLog;
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
            'asset_id' => ['required', 'integer', 'exists:assets,id'],
            'from_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'to_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'movement_type' => ['required', 'in:transfer,maintenance,disposal,storage,return,assign,move,check_out,check_in,send_for_repair,return_from_repair,mark_missing,recover,dispose,write_off'],
            'reason' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'movement_date' => ['required', 'date'],
            'from_location_id' => ['nullable', 'integer', 'exists:asset_locations,id'],
            'to_location_id' => ['nullable', 'integer', 'exists:asset_locations,id'],
            'from_department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'to_department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'approved_by' => ['nullable', 'integer', 'exists:users,id'],
            'reference_document' => ['nullable', 'string', 'max:128'],
            'effective_date' => ['nullable', 'date'],
        ]);

        $data['tenant_id'] = $request->user()->tenant_id;
        $data['recorded_by'] = $request->user()->id;

        $asset = Asset::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($data['asset_id']);

        $data['from_user_id'] = $data['from_user_id'] ?? $asset->assigned_to;
        $data['from_location_id'] = $data['from_location_id'] ?? $asset->location_id;

        $movement = AssetMovement::create($data);
        $this->applyMovementAssetState($asset, $data);

        $movement->load(['asset:id,asset_code,name', 'fromUser:id,name', 'toUser:id,name', 'recorder:id,name']);

        return response()->json(['data' => $movement, 'message' => 'Movement recorded successfully.'], 201);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function applyMovementAssetState(Asset $asset, array $data): void
    {
        $type = (string) $data['movement_type'];
        $custodyChanged = false;

        if (in_array($type, ['assign', 'transfer'], true) && ! empty($data['to_user_id'])) {
            $asset->assigned_to = (int) $data['to_user_id'];
            $asset->issued_at = $data['movement_date'] ?? now()->toDateString();
            $asset->status = 'assigned';
            $custodyChanged = true;
        }

        if (in_array($type, ['return', 'check_in'], true)) {
            $asset->assigned_to = null;
            $asset->status = 'active';
            $custodyChanged = true;
        }

        if ($type === 'check_out') {
            $asset->status = 'issued';
            if (! empty($data['to_user_id'])) {
                $asset->assigned_to = (int) $data['to_user_id'];
            }
            $custodyChanged = true;
        }

        if (in_array($type, ['send_for_repair', 'maintenance'], true)) {
            $asset->status = 'under_repair';
        }

        if ($type === 'return_from_repair') {
            $asset->status = $asset->assigned_to ? 'assigned' : 'active';
        }

        if ($type === 'mark_missing') {
            $asset->status = 'missing';
        }

        if ($type === 'recover') {
            $asset->status = $asset->assigned_to ? 'assigned' : 'active';
        }

        if (in_array($type, ['dispose', 'disposal'], true)) {
            $asset->status = 'disposed';
        }

        if ($type === 'write_off') {
            $asset->status = 'written_off';
        }

        if (in_array($type, ['move', 'storage'], true) && ! empty($data['to_location_id'])) {
            $asset->location_id = (int) $data['to_location_id'];
            AssetLocationHistory::create([
                'tenant_id' => $asset->tenant_id,
                'asset_id' => $asset->id,
                'location_id' => (int) $data['to_location_id'],
                'moved_at' => now(),
                'moved_by' => $data['recorded_by'] ?? null,
                'notes' => $data['notes'] ?? $data['reason'] ?? null,
            ]);
            $custodyChanged = true;
        }

        if ($custodyChanged && ($asset->label_status ?? 'never_printed') !== 'never_printed') {
            $asset->label_status = 'reprint_required';
            $asset->label_reprint_reason = 'CUSTODY_OR_LOCATION_CHANGED';
        }

        $asset->save();

        AuditLog::record('assets.movement_recorded', [
            'auditable_type' => Asset::class,
            'auditable_id' => $asset->id,
            'new_values' => ['movement_type' => $type, 'status' => $asset->status],
            'tags' => 'assets',
        ]);
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
