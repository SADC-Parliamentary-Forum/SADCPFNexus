<?php

namespace App\Modules\Procurement\Services;

use App\Models\AuditLog;
use App\Models\Invoice;
use App\Models\PurchaseOrder;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Pagination\LengthAwarePaginator;

class InvoiceService
{
    public function __construct(private readonly NotificationService $notifications) {}

    public function list(array $filters, User $user): \Illuminate\Database\Eloquent\Collection
    {
        $query = Invoice::query()
            ->where('tenant_id', $user->tenant_id)
            ->with(['vendor', 'purchaseOrder', 'reviewedBy'])
            ->orderByDesc('created_at');

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        return $query->get();
    }

    public function create(array $data, User $user): Invoice
    {
        // Validate PO belongs to same tenant
        $po = PurchaseOrder::where('id', $data['purchase_order_id'])
            ->where('tenant_id', $user->tenant_id)
            ->firstOrFail();

        // Amount cannot exceed PO total
        if ((float) $data['amount'] > (float) $po->total_amount) {
            throw new \InvalidArgumentException(
                "Invoice amount exceeds PO total of {$po->currency} {$po->total_amount}."
            );
        }

        $invoice = Invoice::create(array_merge($data, [
            'tenant_id' => $user->tenant_id,
            'status'    => 'received',
        ]));

        // Run 3-way match immediately
        $match = $invoice->performThreeWayMatch();
        $invoice->update([
            'match_status' => $match['match_status'],
            'match_notes'  => $match['match_notes'] ?: null,
        ]);

        AuditLog::record('procurement.invoice_received', [
            'auditable_type' => Invoice::class,
            'auditable_id'   => $invoice->id,
            'new_values'     => [
                'reference_number'  => $invoice->reference_number,
                'amount'            => $invoice->amount,
                'match_status'      => $invoice->match_status,
            ],
            'tags' => ['procurement', 'invoice'],
        ]);

        return $invoice->load(['vendor', 'purchaseOrder']);
    }

    public function approve(Invoice $invoice, User $user): Invoice
    {
        $invoice->update([
            'status'      => 'approved',
            'reviewed_by' => $user->id,
            'reviewed_at' => now(),
        ]);

        AuditLog::record('procurement.invoice_approved', [
            'auditable_type' => Invoice::class,
            'auditable_id'   => $invoice->id,
            'new_values'     => ['status' => 'approved'],
            'tags'           => ['procurement', 'invoice'],
        ]);

        // Notify vendor / finance director for payment handoff
        try {
            $this->notifications->dispatch(
                'procurement.invoice_approved',
                $user,
                [
                    'invoice_reference' => $invoice->reference_number,
                    'amount'            => "{$invoice->currency} {$invoice->amount}",
                    'vendor'            => $invoice->vendor?->name ?? 'N/A',
                ],
                $user->tenant_id,
            );
        } catch (\Throwable) {
            // Non-fatal
        }

        return $invoice->fresh(['vendor', 'purchaseOrder', 'reviewedBy']);
    }

    public function reject(Invoice $invoice, string $reason, User $user): Invoice
    {
        $invoice->update([
            'status'           => 'rejected',
            'rejection_reason' => $reason,
            'reviewed_by'      => $user->id,
            'reviewed_at'      => now(),
        ]);

        AuditLog::record('procurement.invoice_rejected', [
            'auditable_type' => Invoice::class,
            'auditable_id'   => $invoice->id,
            'new_values'     => ['status' => 'rejected', 'rejection_reason' => $reason],
            'tags'           => ['procurement', 'invoice'],
        ]);

        return $invoice->fresh(['vendor', 'purchaseOrder', 'reviewedBy']);
    }
}
