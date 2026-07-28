<?php

namespace App\Http\Controllers\Api\V1\Stock;

use App\Http\Controllers\Controller;
use App\Models\Stocktake;
use App\Modules\Stock\Services\StocktakeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class StocktakeController extends Controller
{
    public function __construct(private readonly StocktakeService $stocktakeService) {}

    public function index(Request $request): JsonResponse
    {
        $query = Stocktake::forTenant($request->user()->tenant_id)
            ->with(['location:id,code,name', 'creator:id,name'])
            ->withCount('lines')
            ->orderByDesc('count_date')
            ->orderByDesc('id');

        if ($status = $request->string('status')->toString()) {
            $query->where('status', $status);
        }

        return response()->json($query->paginate($request->integer('per_page', 25)));
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeIssue($request);

        $tenantId = $request->user()->tenant_id;
        $data = $request->validate([
            'name'               => ['required', 'string', 'max:255'],
            'count_date'         => ['required', 'date'],
            'stock_location_id'  => ['nullable', 'integer', Rule::exists('stock_locations', 'id')->where('tenant_id', $tenantId)],
            'notes'              => ['nullable', 'string', 'max:2000'],
            'is_blind'           => ['nullable', 'boolean'],
            'include_all_active' => ['nullable', 'boolean'],
            'stock_item_ids'     => ['nullable', 'array'],
            'stock_item_ids.*'   => ['integer', Rule::exists('stock_items', 'id')->where('tenant_id', $tenantId)],
        ]);

        $stocktake = $this->stocktakeService->create($data, $request->user());

        return response()->json(['message' => 'Stocktake created.', 'data' => $stocktake], 201);
    }

    public function show(Request $request, Stocktake $stocktake): JsonResponse
    {
        if ((int) $stocktake->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $stocktake->load([
            'location:id,code,name',
            'creator:id,name',
            'completer:id,name',
            'varianceApprover:id,name',
            'lines.item:id,item_code,name,unit,current_balance,stock_location_id',
        ]);

        return response()->json([
            'data' => $this->stocktakeService->present($stocktake, $request->user()),
        ]);
    }

    public function updateCounts(Request $request, Stocktake $stocktake): JsonResponse
    {
        $this->authorizeIssue($request);

        $data = $request->validate([
            'lines'               => ['required', 'array', 'min:1'],
            'lines.*.id'          => ['required', 'integer'],
            'lines.*.counted_qty' => ['nullable', 'integer', 'min:0'],
            'lines.*.notes'       => ['nullable', 'string', 'max:1000'],
        ]);

        $updated = $this->stocktakeService->updateCounts($stocktake, $data['lines'], $request->user());

        return response()->json(['message' => 'Counts updated.', 'data' => $updated]);
    }

    public function complete(Request $request, Stocktake $stocktake): JsonResponse
    {
        $this->authorizeIssue($request);

        $completed = $this->stocktakeService->complete($stocktake, $request->user());
        $message = $completed->status === Stocktake::STATUS_PENDING_APPROVAL
            ? 'Stocktake submitted; variance approval required before ledger adjustments.'
            : 'Stocktake completed with no variances.';

        return response()->json(['message' => $message, 'data' => $completed]);
    }

    public function approveVariances(Request $request, Stocktake $stocktake): JsonResponse
    {
        $this->authorizeApprove($request);

        $approved = $this->stocktakeService->approveVariances($stocktake, $request->user());

        return response()->json([
            'message' => 'Variances approved and posted to ledger.',
            'data'    => $approved,
        ]);
    }

    public function cancel(Request $request, Stocktake $stocktake): JsonResponse
    {
        $this->authorizeIssue($request);

        $cancelled = $this->stocktakeService->cancel($stocktake, $request->user());

        return response()->json(['message' => 'Stocktake cancelled.', 'data' => $cancelled]);
    }

    private function authorizeIssue(Request $request): void
    {
        $user = $request->user();
        if (! $user->isSystemAdmin()
            && ! $user->hasPermissionTo('stock.admin')
            && ! $user->hasPermissionTo('stock.manage')
            && ! $user->hasPermissionTo('stock.issue')) {
            abort(403, 'You do not have permission to manage stocktakes.');
        }
    }

    private function authorizeApprove(Request $request): void
    {
        $user = $request->user();
        if (! $user->isSystemAdmin()
            && ! $user->hasPermissionTo('stock.admin')
            && ! $user->hasPermissionTo('stock.manage')
            && ! $user->hasPermissionTo('stock.approve')) {
            abort(403, 'You do not have permission to approve stocktake variances.');
        }
    }
}
