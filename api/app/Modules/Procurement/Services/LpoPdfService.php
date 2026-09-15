<?php

namespace App\Modules\Procurement\Services;

use App\Models\PurchaseOrder;
use App\Modules\Documents\Services\PurchaseOrderDocumentService;

class LpoPdfService
{
    public function __construct(private readonly PurchaseOrderDocumentService $documents) {}

    public function render(PurchaseOrder $po): \Barryvdh\DomPDF\PDF
    {
        return $this->documents->renderPdf($po);
    }

    /**
     * @return array<int, string>
     */
    public function signatureStamps(PurchaseOrder $po): array
    {
        return app(\App\Modules\Documents\Services\PurchaseOrderDocumentContext::class)->signatureStamps($po);
    }

    public function output(PurchaseOrder $po): string
    {
        return $this->documents->output($po);
    }

    public function filename(PurchaseOrder $po): string
    {
        return $this->documents->filename($po);
    }
}
