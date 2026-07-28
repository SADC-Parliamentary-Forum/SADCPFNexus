<?php

namespace App\Http\Controllers\Api\V1\Stock;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\StockUnit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class StockUnitController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $units = StockUnit::forTenant($request->user()->tenant_id)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $units]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeManage($request);

        $tenantId = $request->user()->tenant_id;
        $data = $request->validate([
            'code'       => ['required', 'string', 'max:32', Rule::unique('stock_units', 'code')->where('tenant_id', $tenantId)],
            'name'       => ['required', 'string', 'max:255'],
            'is_active'  => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $unit = StockUnit::create([
            'tenant_id'  => $tenantId,
            'code'       => strtolower($data['code']),
            'name'       => $data['name'],
            'is_active'  => $data['is_active'] ?? true,
            'sort_order' => $data['sort_order'] ?? 0,
        ]);

        AuditLog::record('stock.unit_created', [
            'auditable_type' => StockUnit::class,
            'auditable_id'   => $unit->id,
            'new_values'     => $unit->only(['code', 'name']),
            'tags'           => 'stock',
        ]);

        return response()->json(['message' => 'Unit of measure created.', 'data' => $unit], 201);
    }

    public function update(Request $request, StockUnit $stockUnit): JsonResponse
    {
        $this->authorizeManage($request);
        if ((int) $stockUnit->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $data = $request->validate([
            'code'       => ['sometimes', 'string', 'max:32', Rule::unique('stock_units', 'code')->where('tenant_id', $request->user()->tenant_id)->ignore($stockUnit->id)],
            'name'       => ['sometimes', 'string', 'max:255'],
            'is_active'  => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);
        if (isset($data['code'])) {
            $data['code'] = strtolower($data['code']);
        }

        $stockUnit->update($data);

        AuditLog::record('stock.unit_updated', [
            'auditable_type' => StockUnit::class,
            'auditable_id'   => $stockUnit->id,
            'tags'           => 'stock',
        ]);

        return response()->json(['message' => 'Unit updated.', 'data' => $stockUnit->fresh()]);
    }

    public function destroy(Request $request, StockUnit $stockUnit): JsonResponse
    {
        $this->authorizeManage($request);
        if ((int) $stockUnit->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
        if ($stockUnit->items()->exists()) {
            abort(422, 'Cannot delete unit: it is in use by one or more stock items.');
        }

        $stockUnit->delete();

        AuditLog::record('stock.unit_deleted', [
            'auditable_type' => StockUnit::class,
            'auditable_id'   => $stockUnit->id,
            'tags'           => 'stock',
        ]);

        return response()->json(['message' => 'Unit deleted.']);
    }

    private function authorizeManage(Request $request): void
    {
        $user = $request->user();
        if (! $user->isSystemAdmin() && ! $user->hasPermissionTo('stock.admin') && ! $user->hasPermissionTo('stock.manage')) {
            abort(403, 'Only stock managers can manage units of measure.');
        }
    }
}
