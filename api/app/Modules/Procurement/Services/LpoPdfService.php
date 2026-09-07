<?php

namespace App\Modules\Procurement\Services;

use App\Models\PurchaseOrder;
use Barryvdh\DomPDF\Facade\Pdf;

class LpoPdfService
{
    public function render(PurchaseOrder $po): \Barryvdh\DomPDF\PDF
    {
        $po->loadMissing(['vendor', 'items', 'procurementRequest.requester', 'project', 'createdBy', 'issuedBy']);

        return Pdf::loadView('pdf.lpo', [
            'po' => $po,
            'letterhead' => [
                'org_name' => 'SADC Parliamentary Forum',
                'org_abbreviation' => 'SADC-PF',
                'letterhead_tagline' => 'Parliamentary Forum of the Southern African Development Community',
            ],
            'generatedAt' => now(),
        ])->setPaper('a4');
    }

    public function output(PurchaseOrder $po): string
    {
        return $this->render($po)->output();
    }

    public function filename(PurchaseOrder $po): string
    {
        $number = preg_replace('/\s+/', '_', (string) ($po->lpo_number ?: $po->reference_number));
        $supplier = preg_replace('/[^A-Za-z0-9]+/', '_', (string) ($po->vendor?->name ?? 'supplier'));

        return 'LPO_'.$number.'_'.trim($supplier, '_').'.pdf';
    }
}
