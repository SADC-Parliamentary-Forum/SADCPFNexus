<?php

namespace App\Http\Controllers\Api\V1\Stock;

use App\Http\Controllers\Controller;
use App\Models\StockBatch;
use App\Models\StockIssue;
use App\Models\StockItem;
use App\Models\StockReplenishmentRequest;
use App\Models\StockRequest;
use App\Models\StockReturn;
use App\Models\StockTransfer;
use App\Models\StockWriteOff;
use App\Modules\Stock\Services\StockService;
use App\Modules\Stock\Services\StockStoresWorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class StockStoresController extends Controller
{
    public function __construct(
        private readonly StockStoresWorkflowService $workflow,
        private readonly StockService $stockService,
        private readonly \App\Modules\Stock\Services\StockDemandForecastService $demandForecast,
    ) {}

    // ── Availability (PIF / Procurement) ─────────────────────────────────────

    public function availability(Request $request): JsonResponse
    {
        $data = $request->validate([
            'q'          => ['nullable', 'string', 'max:255'],
            'item_ids'   => ['nullable', 'array'],
            'item_ids.*' => ['integer'],
            'names'      => ['nullable', 'array'],
            'names.*'    => ['string', 'max:255'],
        ]);

        return response()->json([
            'data' => $this->stockService->checkAvailability($request->user()->tenant_id, $data),
        ]);
    }

    // ── Requests ─────────────────────────────────────────────────────────────

    public function indexRequests(Request $request): JsonResponse
    {
        $query = StockRequest::forTenant($request->user()->tenant_id)
            ->with(['requester:id,name', 'lines.item:id,item_code,name,unit,current_balance,quantity_reserved,quantity_quarantined'])
            ->orderByDesc('id');

        if ($status = $request->string('status')->toString()) {
            $query->where('status', $status);
        }

        return response()->json($query->paginate($request->integer('per_page', 25)));
    }

    public function storeRequest(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;
        $data = $request->validate([
            'purpose'                     => ['nullable', 'string', 'max:500'],
            'notes'                       => ['nullable', 'string', 'max:2000'],
            'department_id'               => ['nullable', 'integer'],
            'programme_id'                => ['nullable', 'integer'],
            'submit'                      => ['nullable', 'boolean'],
            'lines'                       => ['required', 'array', 'min:1'],
            'lines.*.stock_item_id'       => ['required', 'integer', Rule::exists('stock_items', 'id')->where('tenant_id', $tenantId)],
            'lines.*.quantity_requested'  => ['required', 'integer', 'min:1'],
            'lines.*.notes'               => ['nullable', 'string', 'max:1000'],
        ]);

        $row = $this->workflow->createRequest($data, $request->user());

        return response()->json(['message' => 'Stock request created.', 'data' => $row], 201);
    }

    public function showRequest(Request $request, StockRequest $stockRequest): JsonResponse
    {
        $this->assertTenant($stockRequest->tenant_id, $request);
        $stockRequest->load([
            'lines.item',
            'reservations',
            'requester:id,name',
            'approver:id,name',
            'issues.lines',
        ]);

        return response()->json(['data' => $stockRequest]);
    }

    public function submitRequest(Request $request, StockRequest $stockRequest): JsonResponse
    {
        $this->assertTenant($stockRequest->tenant_id, $request);
        $row = $this->workflow->submitRequest($stockRequest, $request->user());

        return response()->json(['message' => 'Stock request submitted.', 'data' => $row]);
    }

    public function approveRequest(Request $request, StockRequest $stockRequest): JsonResponse
    {
        $this->authorizeApprove($request);
        $this->assertTenant($stockRequest->tenant_id, $request);
        $data = $request->validate([
            'lines'                     => ['nullable', 'array'],
            'lines.*.id'                => ['required_with:lines', 'integer'],
            'lines.*.quantity_approved' => ['required_with:lines', 'integer', 'min:0'],
        ]);

        $row = $this->workflow->approveRequest($stockRequest, $request->user(), $data['lines'] ?? null);

        return response()->json(['message' => 'Stock request approved and reserved.', 'data' => $row]);
    }

    public function rejectRequest(Request $request, StockRequest $stockRequest): JsonResponse
    {
        $this->authorizeApprove($request);
        $this->assertTenant($stockRequest->tenant_id, $request);
        $data = $request->validate(['reason' => ['required', 'string', 'max:2000']]);
        $row = $this->workflow->rejectRequest($stockRequest, $request->user(), $data['reason']);

        return response()->json(['message' => 'Stock request rejected.', 'data' => $row]);
    }

    public function cancelRequest(Request $request, StockRequest $stockRequest): JsonResponse
    {
        $this->assertTenant($stockRequest->tenant_id, $request);
        $row = $this->workflow->cancelRequest($stockRequest, $request->user());

        return response()->json(['message' => 'Stock request cancelled.', 'data' => $row]);
    }

    // ── Issues ───────────────────────────────────────────────────────────────

    public function indexIssues(Request $request): JsonResponse
    {
        $query = StockIssue::forTenant($request->user()->tenant_id)
            ->with(['issuer:id,name', 'issuedToUser:id,name', 'request:id,reference_number'])
            ->orderByDesc('id');

        return response()->json($query->paginate($request->integer('per_page', 25)));
    }

    public function storeIssue(Request $request): JsonResponse
    {
        $this->authorizeIssue($request);
        $tenantId = $request->user()->tenant_id;
        $data = $request->validate([
            'stock_request_id'            => ['nullable', 'integer', Rule::exists('stock_requests', 'id')->where('tenant_id', $tenantId)],
            'issued_to_user_id'           => ['nullable', 'integer'],
            'issued_to_department_id'     => ['nullable', 'integer'],
            'issued_to_other'             => ['nullable', 'string', 'max:255'],
            'issue_date'                  => ['required', 'date'],
            'notes'                       => ['nullable', 'string', 'max:2000'],
            'lines'                       => ['required', 'array', 'min:1'],
            'lines.*.stock_item_id'       => ['required', 'integer', Rule::exists('stock_items', 'id')->where('tenant_id', $tenantId)],
            'lines.*.quantity'            => ['required', 'integer', 'min:1'],
            'lines.*.stock_request_line_id' => ['nullable', 'integer'],
            'lines.*.stock_batch_id'      => ['nullable', 'integer'],
            'lines.*.notes'               => ['nullable', 'string', 'max:1000'],
        ]);

        $row = $this->workflow->createIssue($data, $request->user());

        return response()->json(['message' => 'Stock issue voucher created.', 'data' => $row], 201);
    }

    public function showIssue(Request $request, StockIssue $stockIssue): JsonResponse
    {
        $this->assertTenant($stockIssue->tenant_id, $request);
        $stockIssue->load(['lines.item', 'request', 'issuer:id,name', 'issuedToUser:id,name', 'acknowledger:id,name']);

        return response()->json(['data' => $stockIssue]);
    }

    public function acknowledgeIssue(Request $request, StockIssue $stockIssue): JsonResponse
    {
        $this->assertTenant($stockIssue->tenant_id, $request);
        $row = $this->workflow->acknowledgeIssue($stockIssue, $request->user());

        return response()->json(['message' => 'Issue acknowledged.', 'data' => $row]);
    }

    // ── Returns ──────────────────────────────────────────────────────────────

    public function indexReturns(Request $request): JsonResponse
    {
        $query = StockReturn::forTenant($request->user()->tenant_id)
            ->with(['item:id,item_code,name', 'returner:id,name'])
            ->orderByDesc('id');

        return response()->json($query->paginate($request->integer('per_page', 25)));
    }

    public function storeReturn(Request $request): JsonResponse
    {
        $this->authorizeIssue($request);
        $tenantId = $request->user()->tenant_id;
        $data = $request->validate([
            'stock_item_id'  => ['required', 'integer', Rule::exists('stock_items', 'id')->where('tenant_id', $tenantId)],
            'quantity'       => ['required', 'integer', 'min:1'],
            'condition'      => ['nullable', Rule::in(['good', 'damaged', 'expired'])],
            'stock_issue_id' => ['nullable', 'integer'],
            'stock_batch_id' => ['nullable', 'integer'],
            'return_date'    => ['required', 'date'],
            'notes'          => ['nullable', 'string', 'max:2000'],
        ]);

        $row = $this->workflow->createReturn($data, $request->user());

        return response()->json(['message' => 'Stock return recorded.', 'data' => $row], 201);
    }

    // ── Transfers ────────────────────────────────────────────────────────────

    public function indexTransfers(Request $request): JsonResponse
    {
        $query = StockTransfer::forTenant($request->user()->tenant_id)
            ->with(['fromLocation:id,code,name', 'toLocation:id,code,name', 'creator:id,name'])
            ->orderByDesc('id');

        return response()->json($query->paginate($request->integer('per_page', 25)));
    }

    public function storeTransfer(Request $request): JsonResponse
    {
        $this->authorizeTransfer($request);
        $tenantId = $request->user()->tenant_id;
        $data = $request->validate([
            'from_location_id'      => ['required', 'integer', Rule::exists('stock_locations', 'id')->where('tenant_id', $tenantId)],
            'to_location_id'        => ['required', 'integer', Rule::exists('stock_locations', 'id')->where('tenant_id', $tenantId)],
            'notes'                 => ['nullable', 'string', 'max:2000'],
            'lines'                 => ['required', 'array', 'min:1'],
            'lines.*.stock_item_id' => ['required', 'integer', Rule::exists('stock_items', 'id')->where('tenant_id', $tenantId)],
            'lines.*.quantity'      => ['required', 'integer', 'min:1'],
            'lines.*.stock_batch_id'=> ['nullable', 'integer'],
            'lines.*.notes'         => ['nullable', 'string', 'max:1000'],
        ]);

        $row = $this->workflow->createTransfer($data, $request->user());

        return response()->json(['message' => 'Transfer drafted.', 'data' => $row], 201);
    }

    public function showTransfer(Request $request, StockTransfer $stockTransfer): JsonResponse
    {
        $this->assertTenant($stockTransfer->tenant_id, $request);
        $stockTransfer->load(['lines.item', 'fromLocation', 'toLocation', 'creator:id,name', 'dispatcher:id,name', 'receiver:id,name']);

        return response()->json(['data' => $stockTransfer]);
    }

    public function dispatchTransfer(Request $request, StockTransfer $stockTransfer): JsonResponse
    {
        $this->authorizeTransfer($request);
        $this->assertTenant($stockTransfer->tenant_id, $request);
        $row = $this->workflow->dispatchTransfer($stockTransfer, $request->user());

        return response()->json(['message' => 'Transfer dispatched.', 'data' => $row]);
    }

    public function receiveTransfer(Request $request, StockTransfer $stockTransfer): JsonResponse
    {
        $this->authorizeTransfer($request);
        $this->assertTenant($stockTransfer->tenant_id, $request);
        $row = $this->workflow->receiveTransfer($stockTransfer, $request->user());

        return response()->json(['message' => 'Transfer received.', 'data' => $row]);
    }

    // ── Write-offs ───────────────────────────────────────────────────────────

    public function indexWriteOffs(Request $request): JsonResponse
    {
        $query = StockWriteOff::forTenant($request->user()->tenant_id)
            ->with(['item:id,item_code,name', 'requester:id,name'])
            ->orderByDesc('id');

        return response()->json($query->paginate($request->integer('per_page', 25)));
    }

    public function storeWriteOff(Request $request): JsonResponse
    {
        $this->authorizeIssue($request);
        $tenantId = $request->user()->tenant_id;
        $data = $request->validate([
            'stock_item_id'   => ['required', 'integer', Rule::exists('stock_items', 'id')->where('tenant_id', $tenantId)],
            'quantity'        => ['required', 'integer', 'min:1'],
            'reason_code'     => ['required', Rule::in(['damaged', 'expired', 'shortage', 'other'])],
            'from_quarantine' => ['nullable', 'boolean'],
            'stock_batch_id'  => ['nullable', 'integer'],
            'notes'           => ['nullable', 'string', 'max:2000'],
        ]);

        $row = $this->workflow->requestWriteOff($data, $request->user());

        return response()->json(['message' => 'Write-off submitted for approval.', 'data' => $row], 201);
    }

    public function approveWriteOff(Request $request, StockWriteOff $stockWriteOff): JsonResponse
    {
        $this->authorizeApprove($request);
        $this->assertTenant($stockWriteOff->tenant_id, $request);
        $row = $this->workflow->approveWriteOff($stockWriteOff, $request->user());

        return response()->json(['message' => 'Write-off approved and ledgered.', 'data' => $row]);
    }

    // ── Replenishment ────────────────────────────────────────────────────────

    public function indexReplenishments(Request $request): JsonResponse
    {
        $query = StockReplenishmentRequest::forTenant($request->user()->tenant_id)
            ->with(['item:id,item_code,name,current_balance,reorder_level', 'requester:id,name'])
            ->orderByDesc('id');

        return response()->json($query->paginate($request->integer('per_page', 25)));
    }

    public function storeReplenishment(Request $request): JsonResponse
    {
        $this->authorizeIssue($request);
        $tenantId = $request->user()->tenant_id;
        $data = $request->validate([
            'stock_item_id'       => ['required', 'integer', Rule::exists('stock_items', 'id')->where('tenant_id', $tenantId)],
            'quantity_requested'  => ['required', 'integer', 'min:1'],
            'quantity_suggested'  => ['nullable', 'integer', 'min:1'],
            'notes'               => ['nullable', 'string', 'max:2000'],
        ]);

        $row = $this->workflow->createReplenishment($data, $request->user());

        return response()->json(['message' => 'Replenishment request created for Procurement.', 'data' => $row], 201);
    }

    // ── Quarantine / Batches ─────────────────────────────────────────────────

    public function quarantine(Request $request, StockItem $stockItem): JsonResponse
    {
        $this->authorizeIssue($request);
        $this->assertTenant($stockItem->tenant_id, $request);
        $data = $request->validate([
            'quantity' => ['required', 'integer', 'min:1'],
            'notes'    => ['nullable', 'string', 'max:2000'],
        ]);

        $item = $this->stockService->quarantine($stockItem, $data['quantity'], $request->user(), $data['notes'] ?? null);

        return response()->json(['message' => 'Quantity quarantined.', 'data' => $item]);
    }

    public function releaseQuarantine(Request $request, StockItem $stockItem): JsonResponse
    {
        $this->authorizeIssue($request);
        $this->assertTenant($stockItem->tenant_id, $request);
        $data = $request->validate(['quantity' => ['required', 'integer', 'min:1']]);
        $item = $this->stockService->releaseQuarantine($stockItem, $data['quantity'], $request->user());

        return response()->json(['message' => 'Quarantine released.', 'data' => $item]);
    }

    public function indexBatches(Request $request): JsonResponse
    {
        $query = StockBatch::forTenant($request->user()->tenant_id)
            ->with(['item:id,item_code,name', 'location:id,code,name'])
            ->orderBy('expiry_date');

        if ($itemId = $request->integer('stock_item_id')) {
            $query->where('stock_item_id', $itemId);
        }

        return response()->json($query->paginate($request->integer('per_page', 50)));
    }

    public function storeBatch(Request $request): JsonResponse
    {
        $this->authorizeIssue($request);
        $tenantId = $request->user()->tenant_id;
        $data = $request->validate([
            'stock_item_id'     => ['required', 'integer', Rule::exists('stock_items', 'id')->where('tenant_id', $tenantId)],
            'batch_number'      => ['required', 'string', 'max:64'],
            'expiry_date'       => ['nullable', 'date'],
            'quantity'          => ['required', 'integer', 'min:0'],
            'stock_location_id' => ['nullable', 'integer'],
            'notes'             => ['nullable', 'string', 'max:2000'],
        ]);

        $batch = StockBatch::create([
            ...$data,
            'tenant_id' => $tenantId,
            'status'    => StockBatch::STATUS_ACTIVE,
        ]);

        StockItem::whereKey($data['stock_item_id'])->update(['tracks_batches' => true]);

        return response()->json(['message' => 'Batch registered.', 'data' => $batch], 201);
    }

    public function demandForecast(Request $request): JsonResponse
    {
        $lookback = max(14, min(365, $request->integer('lookback_days', 90)));

        return response()->json([
            'success' => true,
            'data' => $this->demandForecast->suggest((int) $request->user()->tenant_id, $lookback),
            'meta' => ['lookback_days' => $lookback],
        ]);
    }

    // ── Auth helpers ─────────────────────────────────────────────────────────

    private function assertTenant(int $tenantId, Request $request): void
    {
        if ((int) $tenantId !== (int) $request->user()->tenant_id) {
            abort(404);
        }
    }

    private function authorizeIssue(Request $request): void
    {
        $user = $request->user();
        if (! $user->isSystemAdmin()
            && ! $user->hasPermissionTo('stock.admin')
            && ! $user->hasPermissionTo('stock.manage')
            && ! $user->hasPermissionTo('stock.issue')) {
            abort(403);
        }
    }

    private function authorizeApprove(Request $request): void
    {
        $user = $request->user();
        if (! $user->isSystemAdmin()
            && ! $user->hasPermissionTo('stock.admin')
            && ! $user->hasPermissionTo('stock.manage')
            && ! $user->hasPermissionTo('stock.approve')) {
            abort(403);
        }
    }

    private function authorizeTransfer(Request $request): void
    {
        $user = $request->user();
        if (! $user->isSystemAdmin()
            && ! $user->hasPermissionTo('stock.admin')
            && ! $user->hasPermissionTo('stock.manage')
            && ! $user->hasPermissionTo('stock.transfer')
            && ! $user->hasPermissionTo('stock.issue')) {
            abort(403);
        }
    }
}
