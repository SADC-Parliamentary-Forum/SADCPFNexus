<?php

namespace App\Modules\Procurement\Services;

use App\Mail\ModuleNotificationMail;
use App\Models\AuditLog;
use App\Models\Invoice;
use App\Models\PurchaseOrder;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Mail;
use InvalidArgumentException;

class InvoiceService
{
    public function __construct(private readonly NotificationService $notifications) {}

    public function list(array $filters, User $user): Collection
    {
        $query = Invoice::query()
            ->where('tenant_id', $user->tenant_id)
            ->with(['vendor', 'purchaseOrder', 'reviewedBy'])
            ->orderByDesc('created_at');

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if ($user->isSupplier() && $user->vendor_id) {
            $query->where('vendor_id', $user->vendor_id);
        }

        return $query->get();
    }

    public function create(array $data, User $user): Invoice
    {
        $po = PurchaseOrder::where('id', $data['purchase_order_id'])
            ->where('tenant_id', $user->tenant_id)
            ->firstOrFail();

        if ((float) $data['amount'] > (float) $po->total_amount) {
            throw new InvalidArgumentException(
                "Invoice amount exceeds PO total of {$po->currency} {$po->total_amount}."
            );
        }

        $invoice = Invoice::create(array_merge($data, [
            'tenant_id' => $user->tenant_id,
            'status'    => 'received',
        ]));

        $match = $invoice->performThreeWayMatch();
        $invoice->update([
            'match_status' => $match['match_status'],
            'match_notes'  => $match['match_notes'] ?: null,
        ]);

        AuditLog::record('procurement.invoice_received', [
            'auditable_type' => Invoice::class,
            'auditable_id'   => $invoice->id,
            'new_values'     => [
                'reference_number' => $invoice->reference_number,
                'amount'           => $invoice->amount,
                'match_status'     => $invoice->match_status,
            ],
            'tags' => ['procurement', 'invoice'],
        ]);

        return $invoice->load(['vendor', 'purchaseOrder']);
    }

    public function submitSupplierProforma(PurchaseOrder $po, array $data, User $user): Invoice
    {
        if ((int) $po->tenant_id !== (int) $user->tenant_id || (int) $po->vendor_id !== (int) $user->vendor_id) {
            abort(404);
        }

        if (! $po->isIssued() && $po->status !== 'received') {
            throw new InvalidArgumentException('Only issued purchase orders can receive a proforma invoice.');
        }

        if ((float) $data['amount'] > (float) $po->total_amount) {
            throw new InvalidArgumentException(
                "Invoice amount exceeds PO total of {$po->currency} {$po->total_amount}."
            );
        }

        $invoice = Invoice::query()->firstOrNew([
            'tenant_id'         => $user->tenant_id,
            'purchase_order_id' => $po->id,
            'vendor_id'         => $user->vendor_id,
        ]);

        $invoice->fill([
            'goods_receipt_note_id' => $invoice->goods_receipt_note_id,
            'vendor_invoice_number' => $data['vendor_invoice_number'],
            'invoice_date'          => $data['invoice_date'],
            'due_date'              => $data['due_date'],
            'amount'                => $data['amount'],
            'currency'              => $data['currency'] ?? $po->currency,
            'status'                => 'proforma_submitted',
            'match_status'          => 'pending',
            'match_notes'           => 'Awaiting finance review of supplier proforma invoice.',
            'rejection_reason'      => null,
            'reviewed_by'           => null,
            'reviewed_at'           => null,
        ]);
        $invoice->save();

        AuditLog::record('supplier.proforma_invoice_submitted', [
            'auditable_type' => Invoice::class,
            'auditable_id'   => $invoice->id,
            'new_values'     => [
                'purchase_order' => $po->reference_number,
                'amount'         => $invoice->amount,
                'status'         => $invoice->status,
            ],
            'tags' => ['procurement', 'invoice'],
        ]);

        $this->notifyFinancePaymentRequested($invoice);

        return $invoice->fresh(['vendor', 'purchaseOrder', 'reviewedBy']);
    }

    public function approve(Invoice $invoice, User $user): Invoice
    {
        $invoice->update([
            'status'      => 'approved_for_payment',
            'reviewed_by' => $user->id,
            'reviewed_at' => now(),
        ]);

        AuditLog::record('procurement.invoice_approved', [
            'auditable_type' => Invoice::class,
            'auditable_id'   => $invoice->id,
            'new_values'     => ['status' => 'approved_for_payment'],
            'tags'           => ['procurement', 'invoice'],
        ]);

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

    public function markPaid(Invoice $invoice, User $user): Invoice
    {
        $invoice->update([
            'status'      => 'paid',
            'reviewed_by' => $user->id,
            'reviewed_at' => now(),
        ]);

        AuditLog::record('finance.invoice_paid', [
            'auditable_type' => Invoice::class,
            'auditable_id'   => $invoice->id,
            'new_values'     => ['status' => 'paid'],
            'tags'           => ['procurement', 'invoice', 'finance'],
        ]);

        $this->notifySupplierToSubmitFinalInvoice($invoice);

        return $invoice->fresh(['vendor', 'purchaseOrder', 'reviewedBy']);
    }

    public function submitSupplierFinal(Invoice $invoice, array $data, User $user): Invoice
    {
        if ((int) $invoice->tenant_id !== (int) $user->tenant_id || (int) $invoice->vendor_id !== (int) $user->vendor_id) {
            abort(404);
        }

        if ($invoice->status !== 'paid') {
            throw new InvalidArgumentException('Final invoice documents can only be submitted after finance records payment.');
        }

        $amount = array_key_exists('amount', $data) ? (float) $data['amount'] : (float) $invoice->amount;
        $poTotal = (float) ($invoice->purchaseOrder?->total_amount ?? 0);
        if ($poTotal > 0 && $amount > $poTotal) {
            throw new InvalidArgumentException(
                "Invoice amount exceeds PO total of {$invoice->purchaseOrder->currency} {$invoice->purchaseOrder->total_amount}."
            );
        }

        $invoice->update([
            'vendor_invoice_number' => $data['vendor_invoice_number'] ?? $invoice->vendor_invoice_number,
            'invoice_date'          => $data['invoice_date'] ?? $invoice->invoice_date,
            'due_date'              => $data['due_date'] ?? $invoice->due_date,
            'amount'                => $amount,
            'currency'              => $data['currency'] ?? $invoice->currency,
            'status'                => 'final_invoice_submitted',
            'match_notes'           => 'Supplier submitted final invoice and proof of payment package.',
            'rejection_reason'      => null,
        ]);

        AuditLog::record('supplier.final_invoice_submitted', [
            'auditable_type' => Invoice::class,
            'auditable_id'   => $invoice->id,
            'new_values'     => ['status' => 'final_invoice_submitted'],
            'tags'           => ['procurement', 'invoice'],
        ]);

        foreach ($this->financeRecipients($invoice->tenant_id) as $recipient) {
            $this->notifications->dispatch(
                $recipient,
                'supplier.final_invoice_submitted',
                [
                    'name'      => $recipient->name,
                    'reference' => $invoice->reference_number,
                    'vendor'    => $invoice->vendor?->name ?? 'Supplier',
                    'amount'    => number_format((float) $invoice->amount, 2) . ' ' . $invoice->currency,
                ],
                ['module' => 'procurement', 'record_id' => $invoice->id, 'url' => '/procurement/invoices/' . $invoice->id]
            );
        }

        return $invoice->fresh(['vendor', 'purchaseOrder', 'reviewedBy']);
    }

    private function financeRecipients(int $tenantId): Collection
    {
        return User::query()
            ->with(['roles.permissions', 'permissions'])
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->get()
            ->filter(fn (User $user) => $user->isSystemAdmin()
                || $user->hasAnyPermission(['finance.approve', 'finance.admin'])
                || $user->hasAnyRole(['Finance Controller', 'Secretary General']))
            ->values();
    }

    private function notifyFinancePaymentRequested(Invoice $invoice): void
    {
        $amount = number_format((float) $invoice->amount, 2) . ' ' . $invoice->currency;
        $url = '/procurement/invoices/' . $invoice->id;

        foreach ($this->financeRecipients($invoice->tenant_id) as $recipient) {
            $this->notifications->dispatch(
                $recipient,
                'finance.payment_requested',
                [
                    'name'      => $recipient->name,
                    'reference' => $invoice->reference_number,
                    'vendor'    => $invoice->vendor?->name ?? 'Supplier',
                    'amount'    => $amount,
                    'po'        => $invoice->purchaseOrder?->reference_number ?? 'N/A',
                ],
                ['module' => 'procurement', 'record_id' => $invoice->id, 'url' => $url]
            );
        }
    }

    private function notifySupplierToSubmitFinalInvoice(Invoice $invoice): void
    {
        $invoice->loadMissing(['vendor.portalUsers', 'purchaseOrder']);
        $portalUrl = rtrim((string) env('FRONTEND_URL', 'http://localhost:3000'), '/') . '/supplier/invoices';
        $amount = number_format((float) $invoice->amount, 2) . ' ' . $invoice->currency;

        foreach ($invoice->vendor?->portalUsers ?? [] as $portalUser) {
            if (! $portalUser->is_active) {
                continue;
            }

            $this->notifications->dispatch(
                $portalUser,
                'supplier.final_invoice_requested',
                [
                    'name'      => $portalUser->name,
                    'reference' => $invoice->purchaseOrder?->reference_number ?? $invoice->reference_number,
                    'vendor'    => $invoice->vendor?->name ?? 'Supplier',
                    'amount'    => $amount,
                ],
                ['module' => 'procurement', 'record_id' => $invoice->id, 'url' => '/supplier/invoices']
            );
        }

        if ($invoice->vendor?->contact_email) {
            Mail::to($invoice->vendor->contact_email)->queue(new ModuleNotificationMail(
                "Payment recorded - submit final invoice documents",
                "Payment has been recorded against purchase order {$invoice->purchaseOrder?->reference_number}.\n\nPlease upload the final invoice and proof-of-payment supporting documents in the supplier portal.\n\nAmount: {$amount}",
                $invoice->vendor->contact_name ?: $invoice->vendor->name,
                $portalUrl,
                null,
            ));
        }
    }
}
