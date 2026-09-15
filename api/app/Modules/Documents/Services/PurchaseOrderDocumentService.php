<?php

namespace App\Modules\Documents\Services;

use App\Models\Attachment;
use App\Models\AuditLog;
use App\Models\DocumentOutput;
use App\Models\DocumentTemplate;
use App\Models\PurchaseOrder;
use App\Models\User;
use App\Modules\Documents\Support\PurchaseOrderLayoutSanitizer;
use App\Support\FrontendUrl;
use Barryvdh\DomPDF\Facade\Pdf;
use Endroid\QrCode\Builder\Builder;
use Endroid\QrCode\Writer\PngWriter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final class PurchaseOrderDocumentService
{
    public function __construct(
        private readonly PurchaseOrderTemplateService $templates,
        private readonly PurchaseOrderDocumentContext $context,
        private readonly PurchaseOrderDocumentRenderer $renderer,
    ) {}

    public function renderPdf(PurchaseOrder $po, ?DocumentTemplate $template = null, string $mode = 'real', ?array $layoutOverride = null): \Barryvdh\DomPDF\PDF
    {
        $tenantId = (int) ($po->tenant_id ?: 0);
        $chosen = $template;
        if (! $chosen && $po->document_template_id) {
            $chosen = DocumentTemplate::query()->find($po->document_template_id);
        }
        if ($mode !== 'real') {
            $chosen ??= $this->templates->defaultTemplate($tenantId);
            $draft = $chosen->draftVersion ?: $chosen->publishedVersion;
            $layout = PurchaseOrderLayoutSanitizer::sanitize(
                $layoutOverride ?? $draft?->layout_json ?? []
            );
        } else {
            [, $version, $layout] = $this->templates->publishedLayoutFor($chosen, $tenantId);
            if ($po->issued_template_version_id) {
                $frozen = $po->issuedTemplateVersion()->first();
                if ($frozen) {
                    $layout = $frozen->layout_json;
                    $version = $frozen;
                }
            }
            unset($version);
        }
        $verifyUrl = $this->verifyUrl($po);
        $qr = $this->qrDataUri($verifyUrl);
        $ctx = $mode === 'sample'
            ? $this->context->sample()
            : $this->context->build($po, $mode, $verifyUrl, $qr);
        if ($mode === 'sample') {
            $ctx['qr'] = $qr;
            $ctx['verify_url'] = $verifyUrl;
        }
        $html = $this->renderer->toHtml($layout, $ctx, $mode);
        $paper = (($layout['page']['orientation'] ?? 'portrait') === 'landscape') ? 'landscape' : 'portrait';

        return Pdf::loadHTML($html)->setPaper('a4', $paper);
    }

    public function output(PurchaseOrder $po): string
    {
        $issued = $this->issuedBytes($po);
        if ($issued !== null) {
            return $issued;
        }

        return $this->renderPdf($po)->output();
    }

    public function freezeIssued(PurchaseOrder $po, User $actor, string $binary, ?int $attachmentId, string $hash): DocumentOutput
    {
        if ($po->issued_document_output_id) {
            $existing = DocumentOutput::query()->find($po->issued_document_output_id);
            if ($existing) {
                return $existing;
            }
        }
        $template = null;
        if ($po->document_template_id) {
            $template = DocumentTemplate::query()->find($po->document_template_id);
        }
        [, $version] = $this->templates->publishedLayoutFor($template, (int) $po->tenant_id);
        $token = $po->issuedDocumentOutput?->verify_token ?: Str::lower(Str::random(40));
        $ctx = $this->context->build($po, 'real', $this->verifyUrlForToken($token));
        $output = DocumentOutput::query()->create([
            'tenant_id' => $po->tenant_id,
            'subject_type' => $po->getMorphClass(),
            'subject_id' => $po->id,
            'template_version_id' => $version?->id,
            'file_attachment_id' => $attachmentId,
            'data_snapshot' => [
                'reference' => $po->lpo_number ?: $po->reference_number,
                'supplier' => $po->vendor?->name,
                'amount' => $po->total_amount,
                'currency' => $po->currency,
            ],
            'workflow_snapshot' => $ctx['approvals'] ?? [],
            'document_hash' => $hash,
            'verify_token' => $token,
            'status' => 'issued',
            'generated_at' => now(),
            'generated_by' => $actor->id,
        ]);
        $po->update([
            'issued_template_version_id' => $version?->id,
            'issued_document_output_id' => $output->id,
        ]);
        AuditLog::record('procurement.lpo_document_issued', [
            'auditable_type' => PurchaseOrder::class,
            'auditable_id' => $po->id,
            'new_values' => ['hash' => $hash, 'template_version_id' => $version?->id],
            'tags' => 'procurement',
        ]);

        return $output;
    }

    /**
     * @return array{po: string, supplier: string, amount: string, issued: string|null, status: string}
     */
    public function publicVerify(string $token): array
    {
        $output = DocumentOutput::query()->where('verify_token', $token)->first();
        if (! $output) {
            abort(404);
        }
        $po = PurchaseOrder::query()->with('vendor')->find($output->subject_id);
        if (! $po) {
            abort(404);
        }
        $status = $po->status === 'void' ? 'VOID' : 'VALID';
        if ($output->status === 'void' || $po->status === 'void') {
            $status = 'VOID';
        }

        return [
            'po' => (string) ($po->lpo_number ?: $po->reference_number),
            'supplier' => (string) ($po->vendor?->name ?? ''),
            'amount' => $this->context->money($po->total_amount, $po->currency),
            'currency' => (string) ($po->currency ?: 'NAD'),
            'issued' => optional($po->issued_at ?? $po->lpo_date)?->format('Y-m-d'),
            'status' => $status,
        ];
    }

    public function markVoid(PurchaseOrder $po): void
    {
        DocumentOutput::query()
            ->where('subject_type', $po->getMorphClass())
            ->where('subject_id', $po->id)
            ->update(['status' => 'void']);
    }

    public function filename(PurchaseOrder $po): string
    {
        $number = preg_replace('/\s+/', '_', (string) ($po->lpo_number ?: $po->reference_number));
        $supplier = preg_replace('/[^A-Za-z0-9]+/', '_', (string) ($po->vendor?->name ?? 'supplier'));

        return 'LPO_'.$number.'_'.trim((string) $supplier, '_').'.pdf';
    }

    private function issuedOutput(PurchaseOrder $po): ?DocumentOutput
    {
        if ($po->issued_document_output_id) {
            return DocumentOutput::query()->find($po->issued_document_output_id);
        }

        return DocumentOutput::query()
            ->where('subject_type', $po->getMorphClass())
            ->where('subject_id', $po->id)
            ->where('status', 'issued')
            ->latest('id')
            ->first();
    }

    private function issuedBytes(PurchaseOrder $po): ?string
    {
        $output = $this->issuedOutput($po);
        $attachmentId = $output?->file_attachment_id ?: $po->final_pdf_attachment_id;
        if (! $attachmentId) {
            return null;
        }
        $attachment = Attachment::query()->find($attachmentId);
        if (! $attachment?->storage_path) {
            return null;
        }
        if (! Storage::disk('local')->exists($attachment->storage_path)) {
            return null;
        }

        return Storage::disk('local')->get($attachment->storage_path);
    }

    private function verifyUrl(PurchaseOrder $po): string
    {
        $output = $this->issuedOutput($po);
        $token = $output?->verify_token ?: 'preview';

        return $this->verifyUrlForToken($token);
    }

    private function verifyUrlForToken(string $token): string
    {
        return FrontendUrl::to('/verify/po/'.$token);
    }

    private function qrDataUri(string $url): ?string
    {
        try {
            $png = Builder::create()
                ->writer(new PngWriter)
                ->data($url)
                ->size(120)
                ->margin(4)
                ->build()
                ->getString();

            return 'data:image/png;base64,'.base64_encode($png);
        } catch (\Throwable) {
            return null;
        }
    }
}
