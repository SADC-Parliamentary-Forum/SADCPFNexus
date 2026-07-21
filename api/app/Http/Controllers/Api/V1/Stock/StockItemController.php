<?php

namespace App\Http\Controllers\Api\V1\Stock;

use App\Http\Controllers\Controller;
use App\Http\Requests\Stock\StoreStockItemRequest;
use App\Http\Requests\Stock\UpdateStockItemRequest;
use App\Models\AuditLog;
use App\Models\StockItem;
use App\Models\StockTransaction;
use App\Modules\Stock\Services\StockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StockItemController extends Controller
{
    public function __construct(private readonly StockService $stockService) {}

    /**
     * List stock items for the current tenant.
     * Filters: ?category_id, ?status, ?search, ?low_stock=1.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = StockItem::where('tenant_id', $user->tenant_id)
            ->with(['category:id,name,code', 'vendor:id,name'])
            ->orderBy('name');

        if ($categoryId = $request->integer('category_id')) {
            $query->where('stock_category_id', $categoryId);
        }
        if ($status = $request->string('status')->toString()) {
            $query->where('status', $status);
        }
        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('item_code', 'like', "%{$search}%");
            });
        }
        if ($request->boolean('low_stock')) {
            $query->lowStock();
        }

        $perPage = min((int) $request->input('per_page', 50), 100);

        return response()->json($query->paginate($perPage));
    }

    /**
     * Create a stock item. Any opening balance is recorded as an initial stock-in
     * movement so the ledger and balance stay consistent.
     */
    public function store(StoreStockItemRequest $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validated();
        $opening = (int) ($data['opening_balance'] ?? 0);
        unset($data['opening_balance']);

        $data['current_balance'] = 0;
        $item = $this->stockService->createItem($data, $user);

        if ($opening > 0) {
            $this->stockService->recordTransaction($item, [
                'type'             => StockTransaction::TYPE_IN,
                'quantity'         => $opening,
                'reason'           => 'Opening balance',
                'transaction_date' => now()->toDateString(),
            ], $user);
            $item->refresh();
        }

        return response()->json(['message' => 'Stock item created.', 'data' => $item->fresh()->load('category:id,name,code')], 201);
    }

    /**
     * Show a single stock item with its recent movements.
     */
    public function show(Request $request, StockItem $stockItem): JsonResponse
    {
        if ((int) $stockItem->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $stockItem->load([
            'category:id,name,code',
            'vendor:id,name',
            'procurementRequest:id,reference_number',
            'purchaseOrder:id,reference_number',
            'transactions' => fn ($q) => $q->with([
                'issuedToUser:id,name',
                'issuedToDepartment:id,name',
                'recorder:id,name',
            ])->orderByDesc('transaction_date')->orderByDesc('id')->limit(50),
        ]);

        return response()->json(['data' => $stockItem]);
    }

    /**
     * Update a stock item (balance is immutable here — use movements).
     */
    public function update(UpdateStockItemRequest $request, StockItem $stockItem): JsonResponse
    {
        $item = $this->stockService->updateItem($stockItem, $request->validated(), $request->user());

        return response()->json(['message' => 'Stock item updated.', 'data' => $item->load('category:id,name,code')]);
    }

    /**
     * Archive a stock item (soft retire to preserve movement history).
     */
    public function destroy(Request $request, StockItem $stockItem): JsonResponse
    {
        $user = $request->user();
        if (! $user->isSystemAdmin() && ! $user->hasPermissionTo('stock.admin') && ! $user->hasPermissionTo('stock.manage') && ! $user->hasPermissionTo('stock.edit')) {
            abort(403, 'You do not have permission to archive stock items.');
        }
        if ((int) $stockItem->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }

        $stockItem->update(['status' => 'archived']);

        AuditLog::record('stock.item_archived', [
            'auditable_type' => StockItem::class,
            'auditable_id'   => $stockItem->id,
            'tags'           => 'stock',
        ]);

        return response()->json(['message' => 'Stock item archived.']);
    }
}
