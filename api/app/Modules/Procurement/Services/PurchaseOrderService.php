<?php

namespace App\Modules\Procurement\Services;

use App\Models\AuditLog;
use App\Models\ProcurementRequest;
use App\Models\PurchaseOrder;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Validation\ValidationException;

class PurchaseOrderService
{
    public function __construct(protected NotificationService $notificationService) {}

    public function list(array $filters, User $user): LengthAwarePaginator
    {
        $query = PurchaseOrder::with(['vendor', 'procurementRequest', 'createdBy'])
            ->where('tenant_id', $user->tenant_id)
            ->orderByDesc('created_at');

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['search'])) {
            $q = "%{$filters['search']}%";
            $query->where(function ($qb) use ($q) {
                $qb->where('reference_number', 'ilike', $q)
                   ->orWhere('title', 'ilike', $q);
            });
        }

        return $query->paginate($filters['per_page'] ?? 20);
    }

    public function create(ProcurementRequest $req, array $data, User $user): PurchaseOrder
    {
        if ((int) $req->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }

        if (!$req->isAwarded()) {
            throw ValidationException::withMessages([
                'procurement_request_id' => 'Only awarded procurement requests can have a Purchase Order created.',
            ]);
        }

        $po = PurchaseOrder::create([
            'tenant_id'              => $user->tenant_id,
            'procurement_request_id' => $req->id,
            'vendor_id'              => $data['vendor_id'],
            'title'                  => $data['title'],
            'description'            => $data['description'] ?? null,
            'delivery_address'       => $data['delivery_address'] ?? null,
            'payment_terms'          => $data['payment_terms'] ?? 'net_30',
            'total_amount'           => $data['total_amount'] ?? 0,
            'currency'               => $data['currency'] ?? ($req->currency ?? 'USD'),
            'status'                 => 'draft',
            'expected_delivery_date' => $data['expected_delivery_date'] ?? null,
            'created_by'             => $user->id,
        ]);

        if (!empty($data['items'])) {
            $total = 0;
            foreach ($data['items'] as $item) {
                $lineTotal = ($item['quantity'] ?? 1) * ($item['unit_price'] ?? 0);
                $po->items()->create([
                    'description'         => $item['description'],
                    'quantity'            => $item['quantity'] ?? 1,
                    'unit'                => $item['unit'] ?? 'unit',
                    'unit_price'          => $item['unit_price'] ?? 0,
                    'total_price'         => $item['total_price'] ?? $lineTotal,
                    'procurement_item_id' => $item['procurement_item_id'] ?? null,
                ]);
                $total += $item['total_price'] ?? $lineTotal;
            }
            // Update total_amount from items if not explicitly provided
            if (empty($data['total_amount'])) {
                $po->update(['total_amount' => $total]);
            }
        }

        AuditLog::record('procurement.po_created', [
            'auditable_type' => PurchaseOrder::class,
            'auditable_id'   => $po->id,
            'new_values'     => ['reference' => $po->reference_number],
            'tags'           => 'procurement',
        ]);

        return $po->load(['vendor', 'items', 'procurementRequest']);
    }

    public function update(PurchaseOrder $po, array $data, User $user): PurchaseOrder
    {
        if ((int) $po->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }

        if (!$po->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Only draft purchase orders can be edited.']);
        }

        $po->update(array_filter([
            'title'                  => $data['title'] ?? null,
            'description'            => $data['description'] ?? null,
            'delivery_address'       => $data['delivery_address'] ?? null,
            'payment_terms'          => $data['payment_terms'] ?? null,
            'expected_delivery_date' => $data['expected_delivery_date'] ?? null,
        ], fn($v) => $v !== null));

        return $po->fresh(['vendor', 'items']);
    }

    public function issue(PurchaseOrder $po, User $user): PurchaseOrder
    {
        if ((int) $po->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }

        if (!$po->canBeIssued()) {
            throw ValidationException::withMessages(['status' => 'Only draft purchase orders can be issued.']);
        }

        $po->update([
            'status'    => 'issued',
            'issued_at' => now(),
            'issued_by' => $user->id,
        ]);

        AuditLog::record('procurement.po_issued', [
            'auditable_type' => PurchaseOrder::class,
            'auditable_id'   => $po->id,
            'tags'           => 'procurement',
        ]);

        // Notify vendor contact if available
        $po->loadMissing('vendor');
        if ($po->vendor && $po->vendor->contact_email) {
            $this->notificationService->dispatch(
                $po->vendor,
                'procurement.po_issued',
                [
                    'name'          => $po->vendor->name,
                    'reference'     => $po->reference_number,
                    'vendor'        => $po->vendor->name,
                    'amount'        => number_format($po->total_amount, 2) . ' ' . $po->currency,
                    'delivery_date' => $po->expected_delivery_date?->toDateString() ?? '—',
                ],
                ['module' => 'procurement', 'record_id' => $po->id]
            );
        }

        return $po->fresh();
    }

    public function cancel(PurchaseOrder $po, string $reason, User $user): PurchaseOrder
    {
        if ((int) $po->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }

        if (in_array($po->status, ['closed', 'cancelled'])) {
            throw ValidationException::withMessages(['status' => 'This purchase order cannot be cancelled.']);
        }

        $po->update([
            'status'               => 'cancelled',
            'cancellation_reason'  => $reason,
        ]);

        AuditLog::record('procurement.po_cancelled', [
            'auditable_type' => PurchaseOrder::class,
            'auditable_id'   => $po->id,
            'new_values'     => ['reason' => $reason],
            'tags'           => 'procurement',
        ]);

        return $po->fresh();
    }
}
