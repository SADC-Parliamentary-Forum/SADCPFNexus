<?php

namespace App\Modules\Procurement\Services;

use App\Models\AuditLog;
use App\Models\ProcurementDocumentIntake;
use App\Models\ProcurementDocumentIntakeLine;
use App\Models\ProcurementException;
use App\Models\ProcurementProject;
use App\Models\ProcurementRequest;
use App\Models\User;
use App\Modules\Documents\Services\ModuleDocumentBridge;
use App\Modules\Procurement\Support\ArithmeticValidator;
use App\Modules\Procurement\Support\DocumentTextExtractor;
use App\Modules\Procurement\Support\OcrUnconfiguredAdapter;
use App\Modules\Procurement\Support\SupplierDocumentParser;
use App\Support\UploadContentSniffer;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class DocumentIntakeService
{
    public function __construct(
        private readonly ModuleDocumentBridge $bridge,
        private readonly DocumentTextExtractor $textExtractor,
        private readonly SupplierDocumentParser $parser,
        private readonly ArithmeticValidator $arithmetic,
        private readonly SupplierMatcher $matcher,
        private readonly DuplicateDocumentDetector $duplicates,
        private readonly InvoiceFirstDecisionService $invoiceFirst,
        private readonly ProcurementRuleEngine $rules,
    ) {}

    public function createFromUpload(User $user, UploadedFile $file, ?string $idempotencyKey = null, string $sourceType = 'upload'): ProcurementDocumentIntake
    {
        if ($idempotencyKey) {
            $existing = ProcurementDocumentIntake::query()
                ->where('tenant_id', $user->tenant_id)
                ->where('idempotency_key', $idempotencyKey)
                ->first();
            if ($existing) {
                return $existing->load(['lines', 'vendor', 'project']);
            }
        }

        UploadContentSniffer::assertAllowed($file, [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword',
            'image/jpeg',
            'image/png',
            'image/webp',
        ]);

        $contents = file_get_contents($file->getRealPath()) ?: '';
        $hash = hash('sha256', $contents);

        $intake = ProcurementDocumentIntake::create([
            'tenant_id' => $user->tenant_id,
            'uploaded_by' => $user->id,
            'source_type' => $sourceType,
            'original_filename' => $file->getClientOriginalName(),
            'mime_type' => $file->getMimeType() ?: 'application/octet-stream',
            'file_hash' => $hash,
            'file_size_bytes' => $file->getSize() ?: strlen($contents),
            'extraction_status' => ProcurementDocumentIntake::STATUS_EXTRACTING,
            'idempotency_key' => $idempotencyKey,
            'received_at' => now(),
        ]);

        $attachment = $this->bridge->storeAttachment($user, $intake, $file, [
            'document_type' => 'tax_invoice',
            'module' => 'procurement',
            'title' => $file->getClientOriginalName(),
        ]);
        $intake->update(['attachment_id' => $attachment->id]);

        AuditLog::record('procurement.document_uploaded', [
            'auditable_type' => ProcurementDocumentIntake::class,
            'auditable_id' => $intake->id,
            'new_values' => ['filename' => $file->getClientOriginalName(), 'hash' => $hash],
            'tags' => 'procurement',
        ]);

        return $this->extract($intake, $contents);
    }

    public function extract(ProcurementDocumentIntake $intake, ?string $contents = null): ProcurementDocumentIntake
    {
        if ($contents === null) {
            $attachment = $intake->attachments()->first();
            if ($attachment && $attachment->existsOnDisk()) {
                $contents = Storage::disk($attachment->getStorageDisk())->get($attachment->storage_path);
            }
        }
        $contents = $contents ?? '';

        $textResult = $this->textExtractor->extract($contents, (string) $intake->mime_type, (string) $intake->original_filename);
        $parsed = $this->parser->parse((string) ($textResult['text'] ?? ''), $textResult);
        $fields = $parsed['fields'] ?? [];
        $lines = $parsed['lines'] ?? [];
        $arithmetic = $this->arithmetic->validate(
            $lines,
            $fields['subtotal'] ?? null,
            $fields['vat_amount'] ?? null,
            $fields['discount_amount'] ?? null,
            $fields['grand_total'] ?? null,
        );

        $intake->lines()->delete();
        foreach ($lines as $line) {
            ProcurementDocumentIntakeLine::create([
                'intake_id' => $intake->id,
                'line_no' => $line['line_no'],
                'source_description' => $line['source_description'],
                'lpo_description' => $line['lpo_description'] ?? $line['source_description'],
                'quantity' => $line['quantity'],
                'unit' => $line['unit'] ?? 'unit',
                'unit_price' => $line['unit_price'],
                'discount' => $line['discount'] ?? null,
                'vat' => $line['vat'] ?? null,
                'line_total' => $line['line_total'],
                'confidence_score' => $line['confidence_score'] ?? 80,
                'original_extracted' => $line,
            ]);
        }

        $match = $this->matcher->match((int) $intake->tenant_id, $fields);
        if ($match['bank_mismatch'] ?? false) {
            $intake->update([
                'bank_mismatch' => true,
                'extraction_status' => ProcurementDocumentIntake::STATUS_ON_HOLD,
            ]);
            ProcurementException::create([
                'tenant_id' => $intake->tenant_id,
                'intake_id' => $intake->id,
                'exception_type' => ProcurementException::TYPE_BANK_CHANGE,
                'reason' => 'Bank details on the document differ from verified Supplier Master. Transaction placed on HOLD.',
                'requested_by' => $intake->uploaded_by,
                'status' => ProcurementException::STATUS_REQUESTED,
                'payload' => ['vendor_id' => $match['vendor']?->id],
            ]);
            AuditLog::record('procurement.supplier_difference_detected', [
                'auditable_type' => ProcurementDocumentIntake::class,
                'auditable_id' => $intake->id,
                'new_values' => ['type' => 'bank'],
                'tags' => 'procurement',
            ]);
        }

        $dupPayload = array_merge($fields, ['vendor_id' => $match['vendor']?->id]);
        $dup = $this->duplicates->detect((int) $intake->tenant_id, $dupPayload, (string) $intake->file_hash, $intake->id);

        $status = $parsed['needs_manual_classification'] || ($parsed['extraction_confidence'] ?? 0) < 70
            ? ProcurementDocumentIntake::STATUS_NEEDS_REVIEW
            : ProcurementDocumentIntake::STATUS_NEEDS_REVIEW;
        if (($textResult['method'] ?? '') === OcrUnconfiguredAdapter::METHOD) {
            $status = ProcurementDocumentIntake::STATUS_NEEDS_REVIEW;
        } elseif (($textResult['method'] ?? '') === 'unsupported' || ($parsed['extraction_confidence'] ?? 0) === 0) {
            $status = ProcurementDocumentIntake::STATUS_EXTRACTION_FAILED;
        }
        if ($dup['duplicate']) {
            $status = ProcurementDocumentIntake::STATUS_DUPLICATE_BLOCKED;
        }

        $intake->update([
            'document_type' => $parsed['document_type'],
            'classification_confidence' => $parsed['classification_confidence'],
            'classification_method' => $parsed['classification_method'],
            'needs_manual_classification' => $parsed['needs_manual_classification'],
            'extraction_status' => $intake->bank_mismatch ? ProcurementDocumentIntake::STATUS_ON_HOLD : $status,
            'extraction_confidence' => $parsed['extraction_confidence'],
            'raw_extraction' => [
                'text_method' => $textResult['method'] ?? null,
                'ocr_available' => array_key_exists('ocr_available', $textResult) ? (bool) $textResult['ocr_available'] : null,
                'fields' => $fields,
                'lines' => $lines,
                'message' => $parsed['message'] ?? ($textResult['message'] ?? null),
            ],
            'document_number' => $fields['document_number'] ?? null,
            'document_date' => $fields['document_date'] ?? null,
            'due_date' => $fields['due_date'] ?? null,
            'currency' => $fields['currency'] ?? 'NAD',
            'currency_ambiguous' => (bool) ($fields['currency_ambiguous'] ?? false),
            'payment_terms' => $fields['payment_terms'] ?? null,
            'supplier_name_raw' => $fields['supplier_name'] ?? null,
            'supplier_email_raw' => $fields['supplier_email'] ?? null,
            'supplier_phone_raw' => $fields['supplier_phone'] ?? null,
            'supplier_tax_number_raw' => $fields['supplier_tax_number'] ?? null,
            'supplier_registration_raw' => $fields['supplier_registration_number'] ?? null,
            'bank_details_raw' => array_filter([
                'account' => $fields['bank_account'] ?? null,
                'bank' => $fields['bank_name'] ?? null,
            ]),
            'subtotal' => $fields['subtotal'] ?? null,
            'vat_amount' => $fields['vat_amount'] ?? null,
            'vat_identified' => (bool) ($fields['vat_identified'] ?? false),
            'discount_amount' => $fields['discount_amount'] ?? null,
            'grand_total' => $fields['grand_total'] ?? null,
            'arithmetic' => $arithmetic,
            'vendor_id' => $match['vendor']?->id,
            'supplier_match_status' => $match['status'],
            'supplier_differences' => $match['differences'],
            'duplicate_of_id' => $dup['matches'][0]['intake_id'] ?? null,
        ]);

        AuditLog::record('procurement.document_extracted', [
            'auditable_type' => ProcurementDocumentIntake::class,
            'auditable_id' => $intake->id,
            'new_values' => [
                'document_type' => $parsed['document_type'],
                'confidence' => $parsed['extraction_confidence'],
                'duplicate' => $dup['duplicate'],
            ],
            'tags' => 'procurement',
        ]);
        if ($match['vendor']) {
            AuditLog::record('procurement.supplier_matched', [
                'auditable_type' => ProcurementDocumentIntake::class,
                'auditable_id' => $intake->id,
                'new_values' => ['vendor_id' => $match['vendor']->id],
                'tags' => 'procurement',
            ]);
        }

        $fresh = $intake->fresh(['lines', 'vendor', 'project']);
        $fresh->setAttribute('duplicate_matches', $dup['matches']);

        return $fresh;
    }

    public function confirm(ProcurementDocumentIntake $intake, User $user, array $payload): ProcurementDocumentIntake
    {
        if ($intake->extraction_status === ProcurementDocumentIntake::STATUS_DUPLICATE_BLOCKED
            && empty($payload['duplicate_override'])) {
            throw ValidationException::withMessages([
                'document' => 'Duplicate document detected. Open the existing record or supply a privileged override.',
            ]);
        }
        if ($intake->bank_mismatch && empty($payload['acknowledge_bank_hold'])) {
            throw ValidationException::withMessages([
                'bank' => 'HIGH-RISK SUPPLIER CHANGE: verified bank details differ. Supplier verification is required.',
            ]);
        }

        $original = $intake->raw_extraction;
        $corrections = $payload['fields'] ?? [];
        if ($corrections) {
            $merged = array_merge($intake->effectiveExtraction()['fields'] ?? $intake->effectiveExtraction(), $corrections);
            $intake->update([
                'corrected_extraction' => ['fields' => $merged, 'original' => $original],
                'corrected_by' => $user->id,
                'corrected_at' => now(),
                'document_number' => $corrections['document_number'] ?? $intake->document_number,
                'document_date' => $corrections['document_date'] ?? $intake->document_date,
                'currency' => $corrections['currency'] ?? $intake->currency,
                'supplier_name_raw' => $corrections['supplier_name'] ?? $intake->supplier_name_raw,
                'subtotal' => $corrections['subtotal'] ?? $intake->subtotal,
                'vat_amount' => array_key_exists('vat_amount', $corrections) ? $corrections['vat_amount'] : $intake->vat_amount,
                'vat_identified' => array_key_exists('vat_identified', $corrections) ? (bool) $corrections['vat_identified'] : $intake->vat_identified,
                'grand_total' => $corrections['grand_total'] ?? $intake->grand_total,
                'document_type' => $corrections['document_type'] ?? $intake->document_type,
            ]);
            AuditLog::record('procurement.extraction_corrected', [
                'auditable_type' => ProcurementDocumentIntake::class,
                'auditable_id' => $intake->id,
                'old_values' => $original,
                'new_values' => $corrections,
                'tags' => 'procurement',
            ]);
        }

        if (! empty($payload['lines'])) {
            foreach ($payload['lines'] as $line) {
                $row = $intake->lines()->where('id', $line['id'] ?? 0)->orWhere('line_no', $line['line_no'] ?? 0)->first();
                if (! $row) {
                    continue;
                }
                $row->update([
                    'lpo_description' => $line['lpo_description'] ?? $row->lpo_description,
                    'quantity' => $line['quantity'] ?? $row->quantity,
                    'unit_price' => $line['unit_price'] ?? $row->unit_price,
                    'line_total' => $line['line_total'] ?? $row->line_total,
                    'user_corrected' => true,
                ]);
            }
        }

        if (! empty($payload['vendor_id'])) {
            $intake->update(['vendor_id' => $payload['vendor_id'], 'supplier_match_status' => 'user_selected']);
        }
        if (! empty($payload['use_supplier_master']) && $intake->vendor) {
            $intake->update(['supplier_differences' => array_map(fn ($d) => array_merge($d, ['resolution' => 'use_master']), $intake->supplier_differences ?? [])]);
        }

        $project = null;
        if (! empty($payload['procurement_project_id'])) {
            $project = ProcurementProject::query()
                ->where('tenant_id', $intake->tenant_id)
                ->where('id', $payload['procurement_project_id'])
                ->firstOrFail();
            $intake->update(['procurement_project_id' => $project->id]);
            AuditLog::record('procurement.project_assigned', [
                'auditable_type' => ProcurementDocumentIntake::class,
                'auditable_id' => $intake->id,
                'new_values' => ['project' => $project->code],
                'tags' => 'procurement',
            ]);
        }

        $decision = $this->invoiceFirst->decide(
            (int) $intake->tenant_id,
            (string) $intake->document_type,
            [
                'document_number' => $intake->document_number,
                'document_date' => optional($intake->document_date)?->toDateString(),
                'grand_total' => $intake->grand_total,
                'supplier_name' => $intake->supplier_name_raw,
            ],
            $intake->vendor_id,
            (bool) ($project?->allows_no_po_payment),
            $project?->id,
        );

        $policy = $this->rules->evaluate(
            $intake->uploader->tenant ?? \App\Models\Tenant::findOrFail($intake->tenant_id),
            (float) ($intake->grand_total ?? 0),
            $payload['category'] ?? 'services',
            $project,
        );

        $intake->update([
            'invoice_first_case' => $decision['case'],
            'policy_result' => $policy,
            'extraction_status' => $decision['case'] === InvoiceFirstDecisionService::CASE_MATCH_EXISTING_LPO
                ? ProcurementDocumentIntake::STATUS_LINKED
                : ProcurementDocumentIntake::STATUS_CONFIRMED,
            'purchase_order_id' => $decision['existing_po']?->id,
        ]);

        if ($decision['case'] === InvoiceFirstDecisionService::CASE_MATCH_EXISTING_LPO && $decision['existing_po']) {
            app(LpoIssuanceService::class)->attachSupplierInvoice($intake->fresh(), $decision['existing_po']);
        }

        if ($decision['case'] === InvoiceFirstDecisionService::CASE_RETROSPECTIVE && ! empty($payload['exception'])) {
            $this->recordRetrospectiveException($intake, $user, $payload['exception'], $decision);
        }

        return $intake->fresh(['lines', 'vendor', 'project', 'purchaseOrder', 'procurementRequest']);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function matches(ProcurementDocumentIntake $intake): array
    {
        $q = ProcurementRequest::query()->where('tenant_id', $intake->tenant_id);
        if ($intake->grand_total) {
            $q->whereBetween('estimated_value', [
                (float) $intake->grand_total * 0.9,
                (float) $intake->grand_total * 1.1,
            ]);
        }
        return $q->orderByDesc('id')->limit(10)->get()->map(fn (ProcurementRequest $r) => [
            'id' => $r->id,
            'reference_number' => $r->reference_number,
            'title' => $r->title,
            'estimated_value' => $r->estimated_value,
            'status' => $r->status,
            'programme_id' => $r->programme_id,
        ])->all();
    }

    public function linkRequest(ProcurementDocumentIntake $intake, User $user, int $requestId): ProcurementDocumentIntake
    {
        $request = ProcurementRequest::query()
            ->where('tenant_id', $intake->tenant_id)
            ->where('id', $requestId)
            ->firstOrFail();
        $intake->update([
            'procurement_request_id' => $request->id,
            'extraction_status' => ProcurementDocumentIntake::STATUS_LINKED,
        ]);
        AuditLog::record('procurement.request_linked', [
            'auditable_type' => ProcurementDocumentIntake::class,
            'auditable_id' => $intake->id,
            'new_values' => ['procurement_request_id' => $request->id],
            'tags' => 'procurement',
        ]);

        return $intake->fresh(['procurementRequest']);
    }

    public function createRequest(ProcurementDocumentIntake $intake, User $user, array $data): ProcurementRequest
    {
        if ($intake->procurement_request_id) {
            return $intake->procurementRequest;
        }

        $request = ProcurementRequest::create([
            'tenant_id' => $user->tenant_id,
            'requester_id' => $data['requester_id'] ?? $user->id,
            'title' => $data['title'] ?? ($intake->supplier_name_raw ? 'Procurement — '.$intake->supplier_name_raw : 'Procurement from document'),
            'description' => $data['description'] ?? $intake->lines->pluck('source_description')->implode('; '),
            'category' => $data['category'] ?? 'services',
            'estimated_value' => $intake->grand_total ?? 0,
            'currency' => $intake->currency ?? 'NAD',
            'status' => 'draft',
            'justification' => $data['justification'] ?? null,
            'budget_line' => $data['budget_line'] ?? null,
            'programme_id' => $data['programme_id'] ?? $intake->project?->programme_id,
            'procurement_method' => $intake->policy_result['procurement_method'] ?? 'direct',
            'required_by_date' => $data['required_by_date'] ?? now()->addDays(14)->toDateString(),
        ]);

        foreach ($intake->lines as $line) {
            $request->items()->create([
                'description' => $line->lpo_description ?: $line->source_description,
                'quantity' => (int) round((float) $line->quantity),
                'unit' => $line->unit ?? 'unit',
                'estimated_unit_price' => $line->unit_price,
            ]);
        }

        $intake->update(['procurement_request_id' => $request->id]);
        AuditLog::record('procurement.request_created', [
            'auditable_type' => ProcurementRequest::class,
            'auditable_id' => $request->id,
            'new_values' => ['from_intake' => $intake->id],
            'tags' => 'procurement',
        ]);

        return $request->fresh(['items']);
    }

    private function recordRetrospectiveException(ProcurementDocumentIntake $intake, User $user, array $data, array $decision): void
    {
        $required = ['reason', 'requesting_officer', 'request_date', 'service_or_goods_date', 'already_received', 'emergency', 'justification', 'project'];
        foreach ($required as $field) {
            if (! isset($data[$field]) || $data[$field] === '' || $data[$field] === null) {
                throw ValidationException::withMessages([$field => 'Required for retrospective procurement.']);
            }
        }
        ProcurementException::create([
            'tenant_id' => $intake->tenant_id,
            'intake_id' => $intake->id,
            'procurement_request_id' => $intake->procurement_request_id,
            'exception_type' => ProcurementException::TYPE_RETROSPECTIVE,
            'reason' => $data['reason'],
            'requested_by' => $user->id,
            'status' => ProcurementException::STATUS_REQUESTED,
            'payload' => array_merge($data, ['invoice_first_case' => $decision['case']]),
        ]);
        AuditLog::record('procurement.exception_requested', [
            'auditable_type' => ProcurementDocumentIntake::class,
            'auditable_id' => $intake->id,
            'new_values' => ['type' => ProcurementException::TYPE_RETROSPECTIVE],
            'tags' => 'procurement',
        ]);
    }
}
