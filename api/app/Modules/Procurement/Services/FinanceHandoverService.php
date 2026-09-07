<?php

namespace App\Modules\Procurement\Services;

use App\Models\AuditLog;
use App\Models\Invoice;
use App\Models\PurchaseOrder;
use App\Models\ServiceConfirmation;
use App\Models\User;
use App\Support\Money;
use Illuminate\Validation\ValidationException;

class FinanceHandoverService
{
    /**
     * @return array{status: string, variance: string|null, receipt: string, invoice: ?Invoice}
     */
    public function match(PurchaseOrder $po): array
    {
        $invoice = $po->invoices()->latest('id')->first();
        $grn = $po->goodsReceiptNotes()->where('status', 'accepted')->latest('id')->first();
        $service = $po->serviceConfirmations()->latest('id')->first();

        if (! $invoice) {
            return ['status' => 'PENDING_INVOICE', 'variance' => null, 'receipt' => $this->receiptLabel($grn, $service), 'invoice' => null];
        }

        $delta = Money::toCents($invoice->amount) - Money::toCents($po->total_amount);
        if ($delta !== 0) {
            $invoice->update([
                'match_status' => 'variance',
                'match_notes' => 'Invoice differs from LPO by '.Money::fromCents($delta),
            ]);
            AuditLog::record('procurement.invoice_variance', [
                'auditable_type' => PurchaseOrder::class,
                'auditable_id' => $po->id,
                'new_values' => ['delta' => Money::fromCents($delta)],
                'tags' => 'procurement',
            ]);

            return [
                'status' => 'VARIANCE',
                'variance' => Money::fromCents($delta),
                'receipt' => $this->receiptLabel($grn, $service),
                'invoice' => $invoice,
            ];
        }

        $receiptOk = ($grn && $grn->isAccepted()) || ($service && $service->isPositive());
        if (! $receiptOk) {
            return [
                'status' => 'PARTIAL_MATCH',
                'variance' => null,
                'receipt' => 'missing',
                'invoice' => $invoice,
            ];
        }

        $invoice->update(['match_status' => 'matched', 'match_notes' => 'PO, invoice and receipt evidence agree.']);
        AuditLog::record('procurement.invoice_matched', [
            'auditable_type' => PurchaseOrder::class,
            'auditable_id' => $po->id,
            'tags' => 'procurement',
        ]);
        $po->update(['status' => $po->status === 'issued' ? 'received' : $po->status, 'finance_handover_status' => 'ready_for_finance']);

        return [
            'status' => 'MATCHED',
            'variance' => null,
            'receipt' => $this->receiptLabel($grn, $service),
            'invoice' => $invoice,
        ];
    }

    public function sendToFinance(PurchaseOrder $po, User $user, ?string $idempotencyKey = null): PurchaseOrder
    {
        if ($idempotencyKey && $po->finance_handover_status === 'sent_to_finance') {
            return $po;
        }
        $match = $this->match($po);
        if ($match['status'] === 'VARIANCE') {
            throw ValidationException::withMessages([
                'match' => 'VARIANCE: Finance handover blocked. Invoice differs from LPO by '.$match['variance'],
            ]);
        }
        if ($match['status'] !== 'MATCHED') {
            throw ValidationException::withMessages([
                'match' => 'Three-way match is not complete. Status: '.$match['status'],
            ]);
        }

        $pack = [
            'procurement_request_id' => $po->procurement_request_id,
            'lpo_number' => $po->lpo_number ?: $po->reference_number,
            'invoice_id' => $match['invoice']?->id,
            'attachments' => $po->attachments()->pluck('id')->all(),
        ];

        $po->update([
            'finance_handover_status' => 'sent_to_finance',
            'sent_to_finance_at' => now(),
            'status' => 'sent_to_finance',
        ]);
        AuditLog::record('procurement.sent_to_finance', [
            'auditable_type' => PurchaseOrder::class,
            'auditable_id' => $po->id,
            'new_values' => $pack,
            'tags' => 'procurement',
        ]);

        return $po->fresh();
    }

    public function confirmService(PurchaseOrder $po, User $user, array $data): ServiceConfirmation
    {
        $confirmation = ServiceConfirmation::create([
            'tenant_id' => $po->tenant_id,
            'purchase_order_id' => $po->id,
            'confirmed_by' => $user->id,
            'delivered' => $data['delivered'],
            'satisfactory' => $data['satisfactory'] ?? null,
            'comments' => $data['comments'] ?? null,
            'confirmed_at' => now(),
        ]);
        AuditLog::record('procurement.service_confirmed', [
            'auditable_type' => PurchaseOrder::class,
            'auditable_id' => $po->id,
            'new_values' => ['delivered' => $confirmation->delivered, 'satisfactory' => $confirmation->satisfactory],
            'tags' => 'procurement',
        ]);
        $this->match($po);

        return $confirmation;
    }

    private function receiptLabel($grn, $service): string
    {
        if ($grn) {
            return 'grn:'.$grn->status;
        }
        if ($service) {
            return 'service:'.$service->delivered;
        }

        return 'none';
    }
}
