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
            'lines.item:id,item_code,name,unit,current_balance,stock_location_id',
        ]);

        return response()->json(['data' => $stocktake]);
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

        return response()->json(['message' => 'Stocktake completed; variances posted to ledger.', 'data' => $completed]);
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
}
