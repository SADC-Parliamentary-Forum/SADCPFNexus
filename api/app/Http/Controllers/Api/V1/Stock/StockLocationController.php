<?php

namespace App\Http\Controllers\Api\V1\Stock;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\StockLocation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class StockLocationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $locations = StockLocation::forTenant($request->user()->tenant_id)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $locations]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeManage($request);

        $tenantId = $request->user()->tenant_id;
        $data = $request->validate([
            'code'        => ['required', 'string', 'max:32', Rule::unique('stock_locations', 'code')->where('tenant_id', $tenantId)],
            'name'        => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:500'],
            'is_active'   => ['nullable', 'boolean'],
            'sort_order'  => ['nullable', 'integer', 'min:0'],
        ]);

        $location = StockLocation::create([
            'tenant_id'   => $tenantId,
            'code'        => strtoupper($data['code']),
            'name'        => $data['name'],
            'description' => $data['description'] ?? null,
            'is_active'   => $data['is_active'] ?? true,
            'sort_order'  => $data['sort_order'] ?? 0,
        ]);

        AuditLog::record('stock.location_created', [
            'auditable_type' => StockLocation::class,
            'auditable_id'   => $location->id,
            'new_values'     => $location->only(['code', 'name']),
            'tags'           => 'stock',
        ]);

        return response()->json(['message' => 'Store location created.', 'data' => $location], 201);
    }

    public function update(Request $request, StockLocation $stockLocation): JsonResponse
    {
        $this->authorizeManage($request);
        if ((int) $stockLocation->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $data = $request->validate([
            'code'        => ['sometimes', 'string', 'max:32', Rule::unique('stock_locations', 'code')->where('tenant_id', $request->user()->tenant_id)->ignore($stockLocation->id)],
            'name'        => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:500'],
            'is_active'   => ['nullable', 'boolean'],
            'sort_order'  => ['nullable', 'integer', 'min:0'],
        ]);
        if (isset($data['code'])) {
            $data['code'] = strtoupper($data['code']);
        }

        $stockLocation->update($data);

        AuditLog::record('stock.location_updated', [
            'auditable_type' => StockLocation::class,
            'auditable_id'   => $stockLocation->id,
            'tags'           => 'stock',
        ]);

        return response()->json(['message' => 'Location updated.', 'data' => $stockLocation->fresh()]);
    }

    public function destroy(Request $request, StockLocation $stockLocation): JsonResponse
    {
        $this->authorizeManage($request);
        if ((int) $stockLocation->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
        if ($stockLocation->items()->exists()) {
            abort(422, 'Cannot delete location: it is in use by one or more stock items.');
        }

        $stockLocation->delete();

        AuditLog::record('stock.location_deleted', [
            'auditable_type' => StockLocation::class,
            'auditable_id'   => $stockLocation->id,
            'tags'           => 'stock',
        ]);

        return response()->json(['message' => 'Location deleted.']);
    }

    private function authorizeManage(Request $request): void
    {
        $user = $request->user();
        if (! $user->isSystemAdmin() && ! $user->hasPermissionTo('stock.admin') && ! $user->hasPermissionTo('stock.manage')) {
            abort(403, 'Only stock managers can manage store locations.');
        }
    }
}
