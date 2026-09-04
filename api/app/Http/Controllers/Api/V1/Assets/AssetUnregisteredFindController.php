<?php

namespace App\Http\Controllers\Api\V1\Assets;

use App\Http\Controllers\Controller;
use App\Models\AssetUnregisteredFind;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AssetUnregisteredFindController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $rows = AssetUnregisteredFind::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 25));

        return response()->json($rows);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->isSystemAdmin() && ! $user->hasPermissionTo('assets.verify') && ! $user->hasPermissionTo('assets.admin') && ! $user->hasPermissionTo('assets.manage')) {
            abort(403);
        }
        $data = $request->validate([
            'campaign_id' => ['nullable', 'integer'],
            'description' => ['required', 'string', 'max:500'],
            'make' => ['nullable', 'string', 'max:128'],
            'model' => ['nullable', 'string', 'max:255'],
            'serial_number' => ['nullable', 'string', 'max:128'],
            'found_location' => ['nullable', 'string', 'max:255'],
            'location_id' => ['nullable', 'integer'],
            'notes' => ['nullable', 'string'],
            'photos' => ['nullable', 'array'],
        ]);
        $find = AssetUnregisteredFind::create([
            ...$data,
            'tenant_id' => $user->tenant_id,
            'status' => 'open',
            'found_by' => $user->id,
            'found_at' => now(),
        ]);
        AuditLog::record('assets.unregistered_found', [
            'auditable_type' => AssetUnregisteredFind::class,
            'auditable_id' => $find->id,
            'new_values' => ['description' => $find->description],
            'tags' => 'assets',
        ]);

        return response()->json(['data' => $find], 201);
    }

    public function promote(Request $request, AssetUnregisteredFind $find): JsonResponse
    {
        $user = $request->user();
        abort_unless((int) $find->tenant_id === (int) $user->tenant_id, 404);
        if (! $user->isSystemAdmin() && ! $user->hasPermissionTo('assets.admin') && ! $user->hasPermissionTo('assets.manage') && ! $user->hasPermissionTo('assets.import')) {
            abort(403);
        }
        $data = $request->validate([
            'asset_tag' => ['required', 'string', 'max:64'],
            'name' => ['nullable', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:64'],
        ]);
        $asset = \App\Models\Asset::create([
            'tenant_id' => $user->tenant_id,
            'asset_code' => strtoupper($data['asset_tag']),
            'tag_number' => strtoupper($data['asset_tag']),
            'name' => $data['name'] ?: $find->description,
            'manufacturer' => $find->make,
            'model' => $find->model,
            'serial_number' => $find->serial_number,
            'location_id' => $find->location_id,
            'legacy_location' => $find->found_location,
            'category' => $data['category'] ?? 'equipment',
            'status' => 'active',
            'verification_status' => 'unverified',
            'notes' => $find->notes,
        ]);
        app(\App\Modules\Assets\Services\AssetQrService::class)->ensure($asset, $user);
        $find->status = 'promoted';
        $find->promoted_asset_id = $asset->id;
        $find->reviewed_by = $user->id;
        $find->reviewed_at = now();
        $find->save();
        AuditLog::record('assets.unregistered_promoted', [
            'auditable_type' => AssetUnregisteredFind::class,
            'auditable_id' => $find->id,
            'new_values' => ['asset_id' => $asset->id, 'asset_tag' => $asset->tag_number],
            'tags' => 'assets',
        ]);

        return response()->json(['data' => ['find' => $find->fresh(), 'asset' => $asset->fresh()]]);
    }
}
