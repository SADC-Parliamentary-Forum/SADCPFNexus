<?php

namespace App\Http\Controllers\Api\V1\Stock;

use App\Http\Controllers\Controller;
use App\Http\Requests\Stock\StoreStockCategoryRequest;
use App\Http\Requests\Stock\UpdateStockCategoryRequest;
use App\Models\AuditLog;
use App\Models\StockCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StockCategoryController extends Controller
{
    /**
     * List stock categories for the current tenant.
     */
    public function index(Request $request): JsonResponse
    {
        $categories = StockCategory::forTenant($request->user()->tenant_id)
            ->withCount('items')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $categories]);
    }

    /**
     * Create a stock category (admin config — PRD §27).
     */
    public function store(StoreStockCategoryRequest $request): JsonResponse
    {
        $data = $request->validated();

        $category = StockCategory::create([
            'tenant_id'  => $request->user()->tenant_id,
            'name'       => $data['name'],
            'code'       => $data['code'],
            'sort_order' => $data['sort_order'] ?? 0,
        ]);

        AuditLog::record('stock.category_created', [
            'auditable_type' => StockCategory::class,
            'auditable_id'   => $category->id,
            'new_values'     => ['name' => $category->name, 'code' => $category->code],
            'tags'           => 'stock',
        ]);

        return response()->json(['message' => 'Category created.', 'data' => $category], 201);
    }

    /**
     * Update a stock category.
     */
    public function update(UpdateStockCategoryRequest $request, StockCategory $stockCategory): JsonResponse
    {
        if ((int) $stockCategory->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $stockCategory->update($request->validated());

        AuditLog::record('stock.category_updated', [
            'auditable_type' => StockCategory::class,
            'auditable_id'   => $stockCategory->id,
            'tags'           => 'stock',
        ]);

        return response()->json(['message' => 'Category updated.', 'data' => $stockCategory->fresh()]);
    }

    /**
     * Delete a stock category. Forbidden if any stock item uses it.
     */
    public function destroy(Request $request, StockCategory $stockCategory): JsonResponse
    {
        $user = $request->user();
        if (! $user->isSystemAdmin() && ! $user->hasPermissionTo('stock.admin') && ! $user->hasPermissionTo('stock.manage')) {
            abort(403, 'Only stock administrators can delete categories.');
        }
        if ((int) $stockCategory->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }

        if ($stockCategory->items()->exists()) {
            abort(422, 'Cannot delete category: it is in use by one or more stock items.');
        }

        $stockCategory->delete();

        AuditLog::record('stock.category_deleted', [
            'auditable_type' => StockCategory::class,
            'auditable_id'   => $stockCategory->id,
            'tags'           => 'stock',
        ]);

        return response()->json(['message' => 'Category deleted.']);
    }
}
