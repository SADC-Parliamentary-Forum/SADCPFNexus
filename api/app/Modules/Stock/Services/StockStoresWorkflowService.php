<?php

namespace App\Modules\Stock\Services;

use App\Models\AuditLog;
use App\Models\StockIssue;
use App\Models\StockIssueLine;
use App\Models\StockItem;
use App\Models\StockReplenishmentRequest;
use App\Models\StockRequest;
use App\Models\StockRequestLine;
use App\Models\StockReservation;
use App\Models\StockReturn;
use App\Models\StockTransaction;
use App\Models\StockTransfer;
use App\Models\StockTransferLine;
use App\Models\StockWriteOff;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Request → approve/reserve → issue → return / transfer / write-off / replenishment.
 */
class StockStoresWorkflowService
{
    public function __construct(private readonly StockService $stockService) {}

    /**
     * @param  array{
     *     purpose?: string|null,
     *     notes?: string|null,
     *     department_id?: int|null,
     *     programme_id?: int|null,
     *     submit?: bool,
     *     lines: array<int, array{stock_item_id: int, quantity_requested: int, notes?: string|null}>
     * }  $data
     */
    public function createRequest(array $data, User $user): StockRequest
    {
        if (empty($data['lines'])) {
            throw ValidationException::withMessages(['lines' => 'At least one line is required.']);
        }

        return DB::transaction(function () use ($data, $user) {
            $request = StockRequest::create([
                'tenant_id'        => $user->tenant_id,
                'reference_number' => 'SREQ-' . strtoupper(Str::random(8)),
                'status'           => ! empty($data['submit'])
                    ? StockRequest::STATUS_SUBMITTED
                    : StockRequest::STATUS_DRAFT,
                'requested_by'     => $user->id,
                'department_id'    => $data['department_id'] ?? $user->department_id,
                'programme_id'     => $data['programme_id'] ?? null,
                'purpose'          => $data['purpose'] ?? null,
                'notes'            => $data['notes'] ?? null,
            ]);

            foreach ($data['lines'] as $line) {
                $item = StockItem::where('tenant_id', $user->tenant_id)->find($line['stock_item_id'] ?? null);
                if (! $item) {
                    throw ValidationException::withMessages([
                        'lines' => 'Stock item not found for request line.',
                    ]);
                }
                $qty = (int) ($line['quantity_requested'] ?? 0);
                if ($qty <= 0) {
                    throw ValidationException::withMessages([
                        'lines' => 'quantity_requested must be positive.',
                    ]);
                }
                StockRequestLine::create([
                    'stock_request_id'   => $request->id,
                    'stock_item_id'      => $item->id,
                    'quantity_requested' => $qty,
                    'notes'              => $line['notes'] ?? null,
                ]);
            }

            AuditLog::record('stock.request_created', [
                'auditable_type' => StockRequest::class,
                'auditable_id'   => $request->id,
                'new_values'     => ['reference_number' => $request->reference_number, 'status' => $request->status],
                'tags'           => 'stock',
            ]);

            return $request->fresh(['lines.item', 'requester']);
        });
    }

    public function submitRequest(StockRequest $request, User $user): StockRequest
    {
        $this->assertTenant($request->tenant_id, $user);
        if ($request->status !== StockRequest::STATUS_DRAFT) {
            throw ValidationException::withMessages(['status' => 'Only draft requests can be submitted.']);
        }
        $request->update(['status' => StockRequest::STATUS_SUBMITTED]);
        AuditLog::record('stock.request_submitted', [
            'auditable_type' => StockRequest::class,
            'auditable_id'   => $request->id,
            'tags'           => 'stock',
        ]);

        return $request->fresh(['lines.item']);
    }

    /**
     * @param  array<int, array{id: int, quantity_approved: int}>|null  $lineApprovals
     */
    public function approveRequest(StockRequest $request, User $user, ?array $lineApprovals = null): StockRequest
    {
        $this->assertTenant($request->tenant_id, $user);
        if ($request->status !== StockRequest::STATUS_SUBMITTED) {
            throw ValidationException::withMessages(['status' => 'Only submitted requests can be approved.']);
        }

        return DB::transaction(function () use ($request, $user, $lineApprovals) {
            $request->load('lines.item');
            $approvalsById = collect($lineApprovals ?? [])->keyBy('id');

            foreach ($request->lines as $line) {
                $approvedQty = $approvalsById->has($line->id)
                    ? (int) $approvalsById[$line->id]['quantity_approved']
                    : (int) $line->quantity_requested;

                if ($approvedQty < 0 || $approvedQty > (int) $line->quantity_requested) {
                    throw ValidationException::withMessages([
                        'lines' => "Invalid approved quantity for line #{$line->id}.",
                    ]);
                }

                if ($approvedQty === 0) {
                    $line->update(['quantity_approved' => 0]);
                    continue;
                }

                $this->stockService->reserve($line->item, $approvedQty, $user);
                $line->update(['quantity_approved' => $approvedQty]);

                StockReservation::create([
                    'tenant_id'            => $request->tenant_id,
                    'stock_request_id'     => $request->id,
                    'stock_request_line_id'=> $line->id,
                    'stock_item_id'        => $line->stock_item_id,
                    'quantity'             => $approvedQty,
                    'quantity_released'    => 0,
                    'status'               => StockReservation::STATUS_ACTIVE,
                ]);
            }

            $request->update([
                'status'      => StockRequest::STATUS_APPROVED,
                'approved_by' => $user->id,
                'approved_at' => now(),
            ]);

            AuditLog::record('stock.request_approved', [
                'auditable_type' => StockRequest::class,
                'auditable_id'   => $request->id,
                'tags'           => 'stock',
            ]);

            return $request->fresh(['lines.item', 'reservations', 'approver']);
        });
    }

    public function rejectRequest(StockRequest $request, User $user, string $reason): StockRequest
    {
        $this->assertTenant($request->tenant_id, $user);
        if (! in_array($request->status, [StockRequest::STATUS_SUBMITTED, StockRequest::STATUS_APPROVED], true)) {
            throw ValidationException::withMessages(['status' => 'Request cannot be rejected in its current status.']);
        }

        return DB::transaction(function () use ($request, $user, $reason) {
            $this->releaseAllReservations($request, $user);
            $request->update([
                'status'           => StockRequest::STATUS_REJECTED,
                'rejection_reason' => $reason,
                'approved_by'      => $user->id,
                'approved_at'      => now(),
            ]);

            AuditLog::record('stock.request_rejected', [
                'auditable_type' => StockRequest::class,
                'auditable_id'   => $request->id,
                'new_values'     => ['reason' => $reason],
                'tags'           => 'stock',
            ]);

            return $request->fresh();
        });
    }

    public function cancelRequest(StockRequest $request, User $user): StockRequest
    {
        $this->assertTenant($request->tenant_id, $user);
        if (in_array($request->status, [StockRequest::STATUS_ISSUED, StockRequest::STATUS_CANCELLED], true)) {
            throw ValidationException::withMessages(['status' => 'Request cannot be cancelled.']);
        }

        return DB::transaction(function () use ($request, $user) {
            $this->releaseAllReservations($request, $user);
            $request->update(['status' => StockRequest::STATUS_CANCELLED]);
            AuditLog::record('stock.request_cancelled', [
                'auditable_type' => StockRequest::class,
                'auditable_id'   => $request->id,
                'tags'           => 'stock',
            ]);

            return $request->fresh();
        });
    }

    /**
     * @param  array{
     *     stock_request_id?: int|null,
     *     issued_to_user_id?: int|null,
     *     issued_to_department_id?: int|null,
     *     issued_to_other?: string|null,
     *     issue_date: string,
     *     notes?: string|null,
     *     lines: array<int, array{stock_item_id: int, quantity: int, stock_request_line_id?: int|null, stock_batch_id?: int|null, notes?: string|null}>
     * }  $data
     */
    public function createIssue(array $data, User $user): StockIssue
    {
        if (empty($data['lines'])) {
            throw ValidationException::withMessages(['lines' => 'At least one issue line is required.']);
        }

        return DB::transaction(function () use ($data, $user) {
            $request = null;
            if (! empty($data['stock_request_id'])) {
                $request = StockRequest::where('tenant_id', $user->tenant_id)->findOrFail($data['stock_request_id']);
                if (! in_array($request->status, [
                    StockRequest::STATUS_APPROVED,
                    StockRequest::STATUS_PARTIALLY_ISSUED,
                ], true)) {
                    throw ValidationException::withMessages([
                        'stock_request_id' => 'Issues against a request require an approved (or partially issued) request.',
                    ]);
                }
            }

            $issue = StockIssue::create([
                'tenant_id'               => $user->tenant_id,
                'voucher_number'          => 'SISS-' . strtoupper(Str::random(8)),
                'stock_request_id'        => $request?->id,
                'issued_by'               => $user->id,
                'issued_to_user_id'       => $data['issued_to_user_id'] ?? $request?->requested_by,
                'issued_to_department_id' => $data['issued_to_department_id'] ?? $request?->department_id,
                'issued_to_other'         => $data['issued_to_other'] ?? null,
                'issue_date'              => $data['issue_date'],
                'status'                  => StockIssue::STATUS_ISSUED,
                'notes'                   => $data['notes'] ?? null,
            ]);

            foreach ($data['lines'] as $payload) {
                $item = StockItem::where('tenant_id', $user->tenant_id)->findOrFail($payload['stock_item_id']);
                $qty = (int) $payload['quantity'];
                if ($qty <= 0) {
                    throw ValidationException::withMessages(['lines' => 'Issue quantity must be positive.']);
                }

                $requestLine = null;
                $againstReservation = false;
                if (! empty($payload['stock_request_line_id'])) {
                    $requestLine = StockRequestLine::where('stock_request_id', $request?->id)
                        ->whereKey($payload['stock_request_line_id'])
                        ->firstOrFail();
                    $remaining = (int) $requestLine->quantity_approved - (int) $requestLine->quantity_issued;
                    if ($qty > $remaining) {
                        throw ValidationException::withMessages([
                            'lines' => "Cannot issue {$qty}: only {$remaining} remaining on approved line.",
                        ]);
                    }
                    $againstReservation = true;
                }

                $txn = $this->stockService->recordTransaction($item, [
                    'type'                    => StockTransaction::TYPE_OUT,
                    'quantity'                => $qty,
                    'issued_to_user_id'       => $issue->issued_to_user_id,
                    'issued_to_department_id' => $issue->issued_to_department_id,
                    'issued_to_other'         => $issue->issued_to_other,
                    'reference'               => $issue->voucher_number,
                    'reason'                  => 'Stock issue voucher',
                    'reason_code'             => StockTransaction::REASON_ISSUE,
                    'stock_request_id'        => $request?->id,
                    'stock_issue_id'          => $issue->id,
                    'stock_batch_id'          => $payload['stock_batch_id'] ?? null,
                    'notes'                   => $payload['notes'] ?? null,
                    'transaction_date'        => $data['issue_date'],
                    'allow_from_reserved'     => $againstReservation,
                ], $user);

                if ($againstReservation && $requestLine) {
                    $this->stockService->releaseReserved($item, $qty, $user);
                    $reservation = StockReservation::where('stock_request_line_id', $requestLine->id)
                        ->where('status', StockReservation::STATUS_ACTIVE)
                        ->first();
                    if ($reservation) {
                        $reservation->quantity_released = (int) $reservation->quantity_released + $qty;
                        if ($reservation->remaining() === 0) {
                            $reservation->status = StockReservation::STATUS_FULFILLED;
                        }
                        $reservation->save();
                    }
                    $requestLine->quantity_issued = (int) $requestLine->quantity_issued + $qty;
                    $requestLine->save();
                }

                StockIssueLine::create([
                    'stock_issue_id'        => $issue->id,
                    'stock_item_id'         => $item->id,
                    'stock_request_line_id' => $requestLine?->id,
                    'stock_batch_id'        => $payload['stock_batch_id'] ?? null,
                    'stock_transaction_id'  => $txn->id,
                    'quantity'              => $qty,
                    'notes'                 => $payload['notes'] ?? null,
                ]);
            }

            if ($request) {
                $request->load('lines');
                $allIssued = $request->lines->every(
                    fn (StockRequestLine $l) => (int) $l->quantity_issued >= (int) ($l->quantity_approved ?? 0)
                );
                $anyIssued = $request->lines->contains(fn (StockRequestLine $l) => (int) $l->quantity_issued > 0);
                $request->update([
                    'status' => $allIssued
                        ? StockRequest::STATUS_ISSUED
                        : ($anyIssued ? StockRequest::STATUS_PARTIALLY_ISSUED : $request->status),
                ]);
            }

            AuditLog::record('stock.issue_created', [
                'auditable_type' => StockIssue::class,
                'auditable_id'   => $issue->id,
                'new_values'     => ['voucher_number' => $issue->voucher_number],
                'tags'           => 'stock',
            ]);

            return $issue->fresh(['lines.item', 'request', 'issuer', 'issuedToUser']);
        });
    }

    public function acknowledgeIssue(StockIssue $issue, User $user): StockIssue
    {
        $this->assertTenant($issue->tenant_id, $user);
        if ($issue->status !== StockIssue::STATUS_ISSUED) {
            throw ValidationException::withMessages(['status' => 'Only issued vouchers can be acknowledged.']);
        }
        $issue->update([
            'status'          => StockIssue::STATUS_ACKNOWLEDGED,
            'acknowledged_by' => $user->id,
            'acknowledged_at' => now(),
        ]);
        AuditLog::record('stock.issue_acknowledged', [
            'auditable_type' => StockIssue::class,
            'auditable_id'   => $issue->id,
            'tags'           => 'stock',
        ]);

        return $issue->fresh();
    }

    /**
     * @param  array{
     *     stock_item_id: int,
     *     quantity: int,
     *     condition?: string,
     *     stock_issue_id?: int|null,
     *     stock_batch_id?: int|null,
     *     return_date: string,
     *     notes?: string|null
     * }  $data
     */
    public function createReturn(array $data, User $user): StockReturn
    {
        return DB::transaction(function () use ($data, $user) {
            $item = StockItem::where('tenant_id', $user->tenant_id)->findOrFail($data['stock_item_id']);
            $qty = (int) $data['quantity'];
            $condition = $data['condition'] ?? StockReturn::CONDITION_GOOD;

            $txn = $this->stockService->recordTransaction($item, [
                'type'             => StockTransaction::TYPE_IN,
                'quantity'         => $qty,
                'reference'        => null,
                'reason'           => 'Stock return',
                'reason_code'      => StockTransaction::REASON_RETURN,
                'stock_batch_id'   => $data['stock_batch_id'] ?? null,
                'notes'            => $data['notes'] ?? null,
                'transaction_date' => $data['return_date'],
            ], $user);

            if (in_array($condition, [StockReturn::CONDITION_DAMAGED, StockReturn::CONDITION_EXPIRED], true)) {
                $this->stockService->quarantine($item->fresh(), $qty, $user, 'Returned as ' . $condition);
            }

            $ret = StockReturn::create([
                'tenant_id'            => $user->tenant_id,
                'reference_number'     => 'SRET-' . strtoupper(Str::random(8)),
                'stock_issue_id'       => $data['stock_issue_id'] ?? null,
                'stock_item_id'        => $item->id,
                'stock_batch_id'       => $data['stock_batch_id'] ?? null,
                'stock_transaction_id' => $txn->id,
                'quantity'             => $qty,
                'condition'            => $condition,
                'returned_by'          => $user->id,
                'received_by'          => $user->id,
                'return_date'          => $data['return_date'],
                'notes'                => $data['notes'] ?? null,
            ]);

            $txn->update(['reference' => $ret->reference_number]);

            AuditLog::record('stock.return_created', [
                'auditable_type' => StockReturn::class,
                'auditable_id'   => $ret->id,
                'tags'           => 'stock',
            ]);

            return $ret->fresh(['item']);
        });
    }

    /**
     * @param  array{
     *     from_location_id: int,
     *     to_location_id: int,
     *     notes?: string|null,
     *     lines: array<int, array{stock_item_id: int, quantity: int, stock_batch_id?: int|null, notes?: string|null}>
     * }  $data
     */
    public function createTransfer(array $data, User $user): StockTransfer
    {
        if ((int) $data['from_location_id'] === (int) $data['to_location_id']) {
            throw ValidationException::withMessages([
                'to_location_id' => 'Source and destination locations must differ.',
            ]);
        }
        if (empty($data['lines'])) {
            throw ValidationException::withMessages(['lines' => 'At least one transfer line is required.']);
        }

        return DB::transaction(function () use ($data, $user) {
            $transfer = StockTransfer::create([
                'tenant_id'         => $user->tenant_id,
                'reference_number'  => 'SXFER-' . strtoupper(Str::random(8)),
                'from_location_id'  => $data['from_location_id'],
                'to_location_id'    => $data['to_location_id'],
                'status'            => StockTransfer::STATUS_DRAFT,
                'created_by'        => $user->id,
                'notes'             => $data['notes'] ?? null,
            ]);

            foreach ($data['lines'] as $line) {
                $item = StockItem::where('tenant_id', $user->tenant_id)->findOrFail($line['stock_item_id']);
                $qty = (int) $line['quantity'];
                if ($qty <= 0) {
                    throw ValidationException::withMessages(['lines' => 'Transfer quantity must be positive.']);
                }
                StockTransferLine::create([
                    'stock_transfer_id' => $transfer->id,
                    'stock_item_id'     => $item->id,
                    'stock_batch_id'    => $line['stock_batch_id'] ?? null,
                    'quantity'          => $qty,
                    'notes'             => $line['notes'] ?? null,
                ]);
            }

            AuditLog::record('stock.transfer_created', [
                'auditable_type' => StockTransfer::class,
                'auditable_id'   => $transfer->id,
                'tags'           => 'stock',
            ]);

            return $transfer->fresh(['lines.item', 'fromLocation', 'toLocation']);
        });
    }

    public function dispatchTransfer(StockTransfer $transfer, User $user): StockTransfer
    {
        $this->assertTenant($transfer->tenant_id, $user);
        if ($transfer->status !== StockTransfer::STATUS_DRAFT) {
            throw ValidationException::withMessages(['status' => 'Only draft transfers can be dispatched.']);
        }

        return DB::transaction(function () use ($transfer, $user) {
            $transfer->load('lines.item');
            foreach ($transfer->lines as $line) {
                $txn = $this->stockService->recordTransaction($line->item, [
                    'type'               => StockTransaction::TYPE_OUT,
                    'quantity'           => $line->quantity,
                    'reference'          => $transfer->reference_number,
                    'reason'             => 'Transfer dispatch',
                    'reason_code'        => StockTransaction::REASON_TRANSFER,
                    'stock_location_id'  => $transfer->from_location_id,
                    'stock_transfer_id'  => $transfer->id,
                    'stock_batch_id'     => $line->stock_batch_id,
                    'transaction_date'   => now()->toDateString(),
                ], $user);
                $line->update(['dispatch_transaction_id' => $txn->id]);
            }

            $transfer->update([
                'status'        => StockTransfer::STATUS_DISPATCHED,
                'dispatched_by' => $user->id,
                'dispatched_at' => now(),
            ]);

            AuditLog::record('stock.transfer_dispatched', [
                'auditable_type' => StockTransfer::class,
                'auditable_id'   => $transfer->id,
                'tags'           => 'stock',
            ]);

            return $transfer->fresh(['lines.item', 'fromLocation', 'toLocation']);
        });
    }

    public function receiveTransfer(StockTransfer $transfer, User $user): StockTransfer
    {
        $this->assertTenant($transfer->tenant_id, $user);
        if ($transfer->status !== StockTransfer::STATUS_DISPATCHED) {
            throw ValidationException::withMessages(['status' => 'Only dispatched transfers can be received.']);
        }

        return DB::transaction(function () use ($transfer, $user) {
            $transfer->load('lines.item');
            foreach ($transfer->lines as $line) {
                // Destination receive: ledger in; if item is location-scoped, update item location.
                $txn = $this->stockService->recordTransaction($line->item, [
                    'type'               => StockTransaction::TYPE_IN,
                    'quantity'           => $line->quantity,
                    'reference'          => $transfer->reference_number,
                    'reason'             => 'Transfer receive',
                    'reason_code'        => StockTransaction::REASON_TRANSFER,
                    'stock_location_id'  => $transfer->to_location_id,
                    'stock_transfer_id'  => $transfer->id,
                    'stock_batch_id'     => $line->stock_batch_id,
                    'transaction_date'   => now()->toDateString(),
                ], $user);
                $line->update(['receive_transaction_id' => $txn->id]);

                if ((int) $line->item->stock_location_id === (int) $transfer->from_location_id) {
                    $line->item->update(['stock_location_id' => $transfer->to_location_id]);
                }
            }

            $transfer->update([
                'status'      => StockTransfer::STATUS_RECEIVED,
                'received_by' => $user->id,
                'received_at' => now(),
            ]);

            AuditLog::record('stock.transfer_received', [
                'auditable_type' => StockTransfer::class,
                'auditable_id'   => $transfer->id,
                'tags'           => 'stock',
            ]);

            return $transfer->fresh(['lines.item', 'fromLocation', 'toLocation']);
        });
    }

    /**
     * @param  array{
     *     stock_item_id: int,
     *     quantity: int,
     *     reason_code: string,
     *     from_quarantine?: bool,
     *     stock_batch_id?: int|null,
     *     notes?: string|null
     * }  $data
     */
    public function requestWriteOff(array $data, User $user): StockWriteOff
    {
        $item = StockItem::where('tenant_id', $user->tenant_id)->findOrFail($data['stock_item_id']);
        $qty = (int) $data['quantity'];
        if ($qty <= 0) {
            throw ValidationException::withMessages(['quantity' => 'Write-off quantity must be positive.']);
        }

        $writeOff = StockWriteOff::create([
            'tenant_id'        => $user->tenant_id,
            'reference_number' => 'SWO-' . strtoupper(Str::random(8)),
            'stock_item_id'    => $item->id,
            'stock_batch_id'   => $data['stock_batch_id'] ?? null,
            'quantity'         => $qty,
            'reason_code'      => $data['reason_code'],
            'from_quarantine'  => (bool) ($data['from_quarantine'] ?? false),
            'status'           => StockWriteOff::STATUS_PENDING,
            'requested_by'     => $user->id,
            'notes'            => $data['notes'] ?? null,
        ]);

        AuditLog::record('stock.write_off_requested', [
            'auditable_type' => StockWriteOff::class,
            'auditable_id'   => $writeOff->id,
            'tags'           => 'stock',
        ]);

        return $writeOff->fresh(['item']);
    }

    public function approveWriteOff(StockWriteOff $writeOff, User $user): StockWriteOff
    {
        $this->assertTenant($writeOff->tenant_id, $user);
        if ($writeOff->status !== StockWriteOff::STATUS_PENDING) {
            throw ValidationException::withMessages(['status' => 'Only pending write-offs can be approved.']);
        }

        return DB::transaction(function () use ($writeOff, $user) {
            $item = $writeOff->item;
            $txn = $this->stockService->recordTransaction($item, [
                'type'                 => StockTransaction::TYPE_OUT,
                'quantity'             => $writeOff->quantity,
                'reference'            => $writeOff->reference_number,
                'reason'               => 'Approved write-off',
                'reason_code'          => StockTransaction::REASON_WRITE_OFF,
                'stock_batch_id'       => $writeOff->stock_batch_id,
                'notes'                => $writeOff->notes,
                'transaction_date'     => now()->toDateString(),
                'skip_available_check' => (bool) $writeOff->from_quarantine,
            ], $user);

            if ($writeOff->from_quarantine) {
                $this->stockService->consumeQuarantine($item, $writeOff->quantity, $user);
            }

            $writeOff->update([
                'status'               => StockWriteOff::STATUS_APPROVED,
                'approved_by'          => $user->id,
                'approved_at'          => now(),
                'stock_transaction_id' => $txn->id,
            ]);

            AuditLog::record('stock.write_off_approved', [
                'auditable_type' => StockWriteOff::class,
                'auditable_id'   => $writeOff->id,
                'tags'           => 'stock',
            ]);

            return $writeOff->fresh(['item', 'transaction']);
        });
    }

    /**
     * @param  array{
     *     stock_item_id: int,
     *     quantity_requested: int,
     *     quantity_suggested?: int|null,
     *     notes?: string|null
     * }  $data
     */
    public function createReplenishment(array $data, User $user): StockReplenishmentRequest
    {
        $item = StockItem::where('tenant_id', $user->tenant_id)->findOrFail($data['stock_item_id']);
        $requested = (int) $data['quantity_requested'];
        if ($requested <= 0) {
            throw ValidationException::withMessages(['quantity_requested' => 'Must be positive.']);
        }

        $suggested = (int) ($data['quantity_suggested'] ?? max(
            $requested,
            max(0, (int) ($item->max_level ?? $item->reorder_level * 2) - $item->available_quantity)
        ));

        $row = StockReplenishmentRequest::create([
            'tenant_id'           => $user->tenant_id,
            'reference_number'    => 'SREP-' . strtoupper(Str::random(8)),
            'stock_item_id'       => $item->id,
            'quantity_suggested'  => $suggested,
            'quantity_requested'  => $requested,
            'status'              => StockReplenishmentRequest::STATUS_OPEN,
            'requested_by'        => $user->id,
            'notes'               => $data['notes'] ?? null,
        ]);

        AuditLog::record('stock.replenishment_requested', [
            'auditable_type' => StockReplenishmentRequest::class,
            'auditable_id'   => $row->id,
            'tags'           => 'stock',
        ]);

        return $row->fresh(['item']);
    }

    private function releaseAllReservations(StockRequest $request, User $user): void
    {
        $request->loadMissing('reservations.item');
        foreach ($request->reservations as $reservation) {
            if ($reservation->status !== StockReservation::STATUS_ACTIVE) {
                continue;
            }
            $remaining = $reservation->remaining();
            if ($remaining > 0) {
                $this->stockService->releaseReserved($reservation->item, $remaining, $user);
            }
            $reservation->update([
                'status'            => StockReservation::STATUS_CANCELLED,
                'quantity_released' => (int) $reservation->quantity,
            ]);
        }
    }

    private function assertTenant(int $tenantId, User $user): void
    {
        if ((int) $tenantId !== (int) $user->tenant_id) {
            abort(404);
        }
    }
}
