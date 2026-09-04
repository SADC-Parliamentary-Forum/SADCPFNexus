<?php

namespace App\Modules\Procurement\Services;

use App\Models\Invoice;
use App\Models\ProcurementDocumentIntake;
use App\Support\Money;

final class DuplicateDocumentDetector
{
    /**
     * @return array{duplicate: bool, matches: list<array<string, mixed>>}
     */
    public function detect(int $tenantId, array $extracted, string $fileHash, ?int $ignoreIntakeId = null): array
    {
        $matches = [];

        $hashHit = ProcurementDocumentIntake::query()
            ->where('tenant_id', $tenantId)
            ->where('file_hash', $fileHash)
            ->when($ignoreIntakeId, fn ($q) => $q->where('id', '!=', $ignoreIntakeId))
            ->first();
        if ($hashHit) {
            $matches[] = ['reason' => 'file_hash', 'intake_id' => $hashHit->id, 'document_number' => $hashHit->document_number];
        }

        $number = trim((string) ($extracted['document_number'] ?? ''));
        $vendorId = $extracted['vendor_id'] ?? null;
        if ($number !== '') {
            $q = ProcurementDocumentIntake::query()
                ->where('tenant_id', $tenantId)
                ->where('document_number', $number)
                ->when($ignoreIntakeId, fn ($q) => $q->where('id', '!=', $ignoreIntakeId));
            if ($vendorId) {
                $q->where('vendor_id', $vendorId);
            } elseif (! empty($extracted['supplier_name'])) {
                $q->where('supplier_name_raw', 'ilike', '%'.mb_substr((string) $extracted['supplier_name'], 0, 20).'%');
            }
            $hit = $q->first();
            if ($hit) {
                $matches[] = ['reason' => 'supplier_document_number', 'intake_id' => $hit->id, 'document_number' => $hit->document_number];
            }

            $invoiceHit = Invoice::query()
                ->where('tenant_id', $tenantId)
                ->where('vendor_invoice_number', $number)
                ->when($vendorId, fn ($q) => $q->where('vendor_id', $vendorId))
                ->first();
            if ($invoiceHit) {
                $matches[] = [
                    'reason' => 'existing_invoice',
                    'invoice_id' => $invoiceHit->id,
                    'purchase_order_id' => $invoiceHit->purchase_order_id,
                    'document_number' => $invoiceHit->vendor_invoice_number,
                ];
            }
        }

        if (! empty($extracted['grand_total']) && ! empty($extracted['document_date']) && ! empty($extracted['supplier_name'])) {
            $amountHit = ProcurementDocumentIntake::query()
                ->where('tenant_id', $tenantId)
                ->whereDate('document_date', $extracted['document_date'])
                ->when($ignoreIntakeId, fn ($q) => $q->where('id', '!=', $ignoreIntakeId))
                ->get()
                ->first(function (ProcurementDocumentIntake $row) use ($extracted) {
                    return Money::equals($row->grand_total, $extracted['grand_total'])
                        && similar_text(strtolower((string) $row->supplier_name_raw), strtolower((string) $extracted['supplier_name'])) > 70;
                });
            if ($amountHit) {
                $matches[] = ['reason' => 'supplier_amount_date', 'intake_id' => $amountHit->id];
            }
        }

        return ['duplicate' => $matches !== [], 'matches' => $matches];
    }
}
