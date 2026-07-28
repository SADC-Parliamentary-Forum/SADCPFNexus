<?php

namespace App\Http\Controllers\Api\V1\Stock;

use App\Http\Controllers\Controller;
use App\Http\Requests\Stock\StoreStockTransactionRequest;
use App\Models\StockItem;
use App\Models\StockTransaction;
use App\Modules\Stock\Services\StockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StockTransactionController extends Controller
{
    public function __construct(private readonly StockService $stockService) {}

    /**
     * List stock movements for the current tenant.
     * Filters: stock_item_id, type, reason_code, issued_to_user_id, issued_to_department_id, date_from, date_to.
     */
    public function index(Request $request): JsonResponse
    {
        $query = StockTransaction::where('tenant_id', $request->user()->tenant_id)
            ->with([
                'item:id,item_code,name,unit',
                'issuedToUser:id,name,email',
                'issuedToDepartment:id,name',
                'recorder:id,name,email',
                'location:id,code,name',
            ])
            ->orderByDesc('transaction_date')
            ->orderByDesc('id');

        if ($itemId = $request->integer('stock_item_id')) {
            $query->where('stock_item_id', $itemId);
        }
        if ($type = $request->string('type')->toString()) {
            $query->where('type', $type);
        }
        if ($reasonCode = $request->string('reason_code')->toString()) {
            $query->where('reason_code', $reasonCode);
        }
        if ($userId = $request->integer('issued_to_user_id')) {
            $query->where('issued_to_user_id', $userId);
        }
        if ($deptId = $request->integer('issued_to_department_id')) {
            $query->where('issued_to_department_id', $deptId);
        }
        if ($from = $request->string('date_from')->toString()) {
            $query->whereDate('transaction_date', '>=', $from);
        }
        if ($to = $request->string('date_to')->toString()) {
            $query->whereDate('transaction_date', '<=', $to);
        }

        return response()->json($query->paginate($request->integer('per_page', 25)));
    }

    /**
     * Record a stock movement (stock-in, stock-out or adjustment).
     * Balance is updated atomically inside the service.
     */
    public function store(StoreStockTransactionRequest $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validated();

        $item = StockItem::where('tenant_id', $user->tenant_id)->findOrFail($data['stock_item_id']);

        $transaction = $this->stockService->recordTransaction($item, $data, $user);

        $transaction->load(['item:id,item_code,name', 'issuedToUser:id,name', 'issuedToDepartment:id,name', 'recorder:id,name']);

        return response()->json([
            'message' => 'Stock movement recorded.',
            'data'    => $transaction,
        ], 201);
    }

    /**
     * Show a single stock movement.
     */
    public function show(Request $request, StockTransaction $stockTransaction): JsonResponse
    {
        if ((int) $stockTransaction->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $stockTransaction->load([
            'item:id,item_code,name,unit',
            'issuedToUser:id,name,email',
            'issuedToDepartment:id,name',
            'recorder:id,name,email',
        ]);

        return response()->json(['data' => $stockTransaction]);
    }
}
