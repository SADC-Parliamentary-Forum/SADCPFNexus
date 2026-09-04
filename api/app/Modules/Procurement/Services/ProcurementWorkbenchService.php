<?php

namespace App\Modules\Procurement\Services;

use App\Models\ProcurementDocumentIntake;
use App\Models\ProcurementException;
use App\Models\ProcurementRequest;
use App\Models\PurchaseOrder;
use App\Models\User;

class ProcurementWorkbenchService
{
    /**
     * @return array<string, int>
     */
    public function cards(User $user): array
    {
        $tid = $user->tenant_id;
        $intakes = ProcurementDocumentIntake::query()->where('tenant_id', $tid);

        return [
            'new_documents' => (clone $intakes)->where('extraction_status', ProcurementDocumentIntake::STATUS_RECEIVED)->count(),
            'needs_extraction_review' => (clone $intakes)->where('extraction_status', ProcurementDocumentIntake::STATUS_NEEDS_REVIEW)->count(),
            'requests_pending' => ProcurementRequest::query()->where('tenant_id', $tid)->whereIn('status', ['submitted', 'hod_approved'])->count(),
            'awaiting_quotations' => ProcurementRequest::query()->where('tenant_id', $tid)->whereNotNull('rfq_issued_at')->where('status', 'approved')->count(),
            'ready_for_lpo' => (clone $intakes)->where('extraction_status', ProcurementDocumentIntake::STATUS_CONFIRMED)->whereNull('purchase_order_id')->count(),
            'awaiting_approval' => PurchaseOrder::query()->where('tenant_id', $tid)->where('status', 'awaiting_approval')->count(),
            'returned_for_correction' => PurchaseOrder::query()->where('tenant_id', $tid)->where('status', 'returned')->count(),
            'approved_ready_to_issue' => PurchaseOrder::query()->where('tenant_id', $tid)->where('status', 'approved')->count(),
            'outstanding_lpos' => PurchaseOrder::query()->where('tenant_id', $tid)->whereIn('status', ['issued', 'partially_received'])->count(),
            'awaiting_receipt' => PurchaseOrder::query()->where('tenant_id', $tid)->where('status', 'issued')->count(),
            'unmatched_invoices' => (clone $intakes)->where('document_type', 'invoice')->whereNull('purchase_order_id')->whereNotIn('extraction_status', [ProcurementDocumentIntake::STATUS_REJECTED])->count(),
            'ready_for_finance' => PurchaseOrder::query()->where('tenant_id', $tid)->where('finance_handover_status', 'ready_for_finance')->count(),
            'exceptions' => ProcurementException::query()->where('tenant_id', $tid)->where('status', ProcurementException::STATUS_REQUESTED)->count(),
        ];
    }
}
