<?php

namespace App\Modules\Procurement\Services;

use App\Models\PurchaseOrder;
use App\Models\SignatureEvent;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;

class LpoPdfService
{
    public function render(PurchaseOrder $po): \Barryvdh\DomPDF\PDF
    {
        $po->loadMissing([
            'vendor', 'items', 'procurementRequest.requester', 'project',
            'createdBy', 'issuedBy', 'approvalRequest.history.user',
        ]);

        return Pdf::loadView('pdf.lpo', [
            'po' => $po,
            'letterhead' => [
                'org_name' => 'SADC Parliamentary Forum',
                'org_abbreviation' => 'SADC-PF',
                'letterhead_tagline' => 'Parliamentary Forum of the Southern African Development Community',
            ],
            'generatedAt' => now(),
            'signatureStamps' => $this->signatureStamps($po),
        ])->setPaper('a4');
    }

    /**
     * Map signer user id → data-URI of their pinned SAAM specimen.
     * Email-token events are ignored — those are not a locked wet-ink equivalent.
     *
     * @return array<int, string>
     */
    public function signatureStamps(PurchaseOrder $po): array
    {
        $events = SignatureEvent::query()
            ->where('signable_type', $po->getMorphClass())
            ->where('signable_id', $po->id)
            ->whereNotNull('signature_version_id')
            ->where(function ($q) {
                $q->whereNull('auth_level')->orWhere('auth_level', '!=', 'email_token');
            })
            ->with('signatureVersion')
            ->orderBy('signed_at')
            ->get();

        $stamps = [];
        foreach ($events as $event) {
            $version = $event->signatureVersion;
            if ($version === null || ! $version->file_path) {
                continue;
            }
            if (! Storage::disk('local')->exists($version->file_path)) {
                continue;
            }
            $bytes = Storage::disk('local')->get($version->file_path);
            $mime = Storage::disk('local')->mimeType($version->file_path) ?: 'image/png';
            $stamps[(int) $event->signer_user_id] = 'data:'.$mime.';base64,'.base64_encode($bytes);
        }

        return $stamps;
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
