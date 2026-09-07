<?php

namespace App\Modules\Procurement\Services;

use App\Models\PurchaseOrder;
use App\Support\Money;
use Carbon\Carbon;

final class InvoiceFirstDecisionService
{
    public const CASE_MATCH_EXISTING_LPO = 'existing_lpo';
    public const CASE_NO_PO_PAYMENT = 'no_po_payment';
    public const CASE_RETROSPECTIVE = 'retrospective';
    public const CASE_NORMAL = 'normal';

    /**
     * @return array{case: string, existing_po: ?PurchaseOrder, retrospective: bool, reason: string}
     */
    public function decide(int $tenantId, string $documentType, array $extracted, ?int $vendorId, bool $allowsNoPo = false, ?int $projectId = null): array
    {
        $isInvoice = in_array($documentType, ['invoice', 'credit_note'], true);
        if (! $isInvoice) {
            return ['case' => self::CASE_NORMAL, 'existing_po' => null, 'retrospective' => false, 'reason' => 'Quotation or pro-forma follows the normal procurement path.'];
        }

        $existing = $this->findExistingPo($tenantId, $vendorId, $extracted);
        if ($existing) {
            return [
                'case' => self::CASE_MATCH_EXISTING_LPO,
                'existing_po' => $existing,
                'retrospective' => false,
                'reason' => 'Invoice matches an existing LPO/PO. Do not generate another LPO.',
            ];
        }

        if ($allowsNoPo) {
            return [
                'case' => self::CASE_NO_PO_PAYMENT,
                'existing_po' => null,
                'retrospective' => false,
                'reason' => 'Project allows routine no-PO payments. Route through NO_PO_PAYMENT.',
            ];
        }

        $sourceDate = $extracted['document_date'] ?? null;
        $retrospective = false;
        if ($sourceDate) {
            $retrospective = Carbon::parse($sourceDate)->lt(Carbon::today());
        }

        return [
            'case' => self::CASE_RETROSPECTIVE,
            'existing_po' => null,
            'retrospective' => $retrospective,
            'reason' => 'Final invoice received with no existing LPO. Retrospective procurement exception is required before regularisation.',
        ];
    }

    private function findExistingPo(int $tenantId, ?int $vendorId, array $extracted): ?PurchaseOrder
    {
        $q = PurchaseOrder::query()
            ->where('tenant_id', $tenantId)
            ->whereNotIn('status', ['cancelled', 'void']);
        if ($vendorId) {
            $q->where('vendor_id', $vendorId);
        }
        $amount = $extracted['grand_total'] ?? null;
        $candidates = $q->orderByDesc('id')->limit(50)->get();
        foreach ($candidates as $po) {
            if ($amount !== null && Money::equals($po->total_amount, $amount)) {
                return $po;
            }
            $docNo = strtolower((string) ($extracted['document_number'] ?? ''));
            if ($docNo !== '' && str_contains(strtolower((string) $po->description), $docNo)) {
                return $po;
            }
        }

        return null;
    }
}
