<?php

namespace App\Modules\Procurement\Services;

use App\Models\AuditLog;
use App\Models\ProcurementDocumentIntake;
use App\Models\ProcurementException;
use App\Models\ProcurementRequest;
use App\Models\PurchaseOrder;
use App\Models\User;
use App\Modules\Documents\Services\ModuleDocumentBridge;
use App\Modules\Procurement\Support\ArithmeticValidator;
use App\Services\NotificationService;
use App\Services\WorkflowService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LpoIssuanceService
{
    public function __construct(
        private readonly LpoSequenceAllocator $sequence,
        private readonly LpoPdfService $pdf,
        private readonly WorkflowService $workflow,
        private readonly NotificationService $notifications,
        private readonly ModuleDocumentBridge $bridge,
        private readonly ArithmeticValidator $arithmetic,
    ) {}

    public function createDraftFromIntake(ProcurementDocumentIntake $intake, User $user, array $data = []): PurchaseOrder
    {
        if ($intake->invoice_first_case === InvoiceFirstDecisionService::CASE_MATCH_EXISTING_LPO && $intake->purchase_order_id) {
            throw ValidationException::withMessages([
                'purchase_order' => 'An existing LPO already matches this invoice. Match the invoice instead of creating another LPO.',
            ]);
        }
        if ($intake->invoice_first_case === InvoiceFirstDecisionService::CASE_NO_PO_PAYMENT) {
            throw ValidationException::withMessages([
                'purchase_order' => 'This invoice is routed as a no-PO payment. An LPO will not be manufactured.',
            ]);
        }
        if (! $intake->procurement_project_id && empty($data['procurement_project_id'])) {
            throw ValidationException::withMessages([
                'procurement_project_id' => 'Project is mandatory before LPO generation.',
            ]);
        }
        if (! $intake->vendor_id) {
            throw ValidationException::withMessages(['vendor_id' => 'Confirm the supplier before generating an LPO.']);
        }
        if (! $intake->procurement_request_id) {
            throw ValidationException::withMessages(['procurement_request_id' => 'Link or create a Procurement Request first.']);
        }
        if ($intake->purchase_order_id) {
            return PurchaseOrder::findOrFail($intake->purchase_order_id);
        }

        $request = ProcurementRequest::findOrFail($intake->procurement_request_id);
        $lines = $intake->lines;
        $arithmetic = $this->arithmetic->validate(
            $lines->map(fn ($line) => [
                'quantity' => $line->quantity,
                'unit_price' => $line->unit_price,
                'line_total' => $line->line_total,
            ])->all(),
            $intake->subtotal,
            $intake->vat_identified ? $intake->vat_amount : 0,
            $intake->discount_amount,
            $intake->grand_total,
        );
        if (! $arithmetic['ok'] && empty($data['accept_arithmetic_exception'])) {
            throw ValidationException::withMessages(['arithmetic' => implode(' ', $arithmetic['issues'])]);
        }

        $draftRef = 'PROC-DRAFT-'.now()->year.'-'.strtoupper(Str::random(6));
        $po = PurchaseOrder::create([
            'tenant_id' => $user->tenant_id,
            'procurement_request_id' => $request->id,
            'vendor_id' => $intake->vendor_id,
            'reference_number' => $draftRef,
            'title' => $data['title'] ?? ($request->title ?: 'LPO '.$intake->supplier_name_raw),
            'description' => $data['description'] ?? $request->description,
            'total_amount' => $intake->grand_total ?? 0,
            'subtotal' => $intake->subtotal,
            'tax_amount' => $intake->vat_identified ? $intake->vat_amount : null,
            'vat_identified' => (bool) $intake->vat_identified,
            'discount_amount' => $intake->discount_amount,
            'currency' => $intake->currency ?? 'NAD',
            'status' => 'draft',
            'created_by' => $user->id,
            'prepared_by_user_id' => $user->id,
            'requested_by_user_id' => $request->requester_id,
            'source_intake_id' => $intake->id,
            'source_type' => $intake->document_type,
            'procurement_project_id' => $intake->procurement_project_id,
            'programme_id' => $request->programme_id,
            'procurement_method' => $intake->policy_result['procurement_method'] ?? 'direct',
            'retrospective' => $intake->invoice_first_case === InvoiceFirstDecisionService::CASE_RETROSPECTIVE,
            'revision' => 1,
            'idempotency_key' => $data['idempotency_key'] ?? ('lpo-draft:'.$intake->id),
        ]);

        foreach ($lines as $line) {
            $po->items()->create([
                'description' => $line->lpo_description ?: $line->source_description,
                'source_description' => $line->source_description,
                'quantity' => max(1, (int) round((float) $line->quantity)),
                'unit' => $line->unit ?? 'unit',
                'unit_price' => $line->unit_price,
                'total_price' => $line->line_total,
                'source_intake_line_id' => $line->id,
            ]);
        }

        $intake->update(['purchase_order_id' => $po->id]);
        $this->attachSupplierInvoice($intake, $po);
        AuditLog::record('procurement.lpo_generated', [
            'auditable_type' => PurchaseOrder::class,
            'auditable_id' => $po->id,
            'new_values' => ['reference' => $po->reference_number, 'intake_id' => $intake->id],
            'tags' => 'procurement',
        ]);

        return $po->load(['vendor', 'items', 'project', 'procurementRequest']);
    }

    public function submit(PurchaseOrder $po, User $user, ?string $idempotencyKey = null): PurchaseOrder
    {
        if ($idempotencyKey && $po->status === 'awaiting_approval') {
            return $po;
        }
        if (! $po->isDraft() && $po->status !== 'returned') {
            throw ValidationException::withMessages(['status' => 'Only draft or returned LPOs can be submitted.']);
        }
        if ($po->isIssued() || in_array($po->status, ['issued', 'void', 'cancelled'], true)) {
            throw ValidationException::withMessages(['status' => 'This LPO cannot be submitted.']);
        }
        if (! $po->isIntakeLpo()) {
            throw ValidationException::withMessages([
                'reference_number' => 'Award-path purchase orders keep PO- references. Use Issue PO, not LPO submit.',
            ]);
        }
        if (! $po->procurement_project_id) {
            throw ValidationException::withMessages(['procurement_project_id' => 'Project is mandatory before submission.']);
        }
        if ($po->retrospective) {
            $approved = ProcurementException::query()
                ->where('exception_type', ProcurementException::TYPE_RETROSPECTIVE)
                ->where('status', ProcurementException::STATUS_APPROVED)
                ->where(function ($q) use ($po) {
                    $q->where('purchase_order_id', $po->id);
                    if ($po->source_intake_id) {
                        $q->orWhere('intake_id', $po->source_intake_id);
                    }
                })
                ->exists();
            if (! $approved) {
                throw ValidationException::withMessages([
                    'exception' => 'Retrospective procurement exception must be approved before LPO submission.',
                ]);
            }
        }

        if (! $po->lpo_number) {
            $allocated = $this->sequence->allocate((int) $po->tenant_id, $user);
            $po->lpo_number = $allocated['formatted'];
            $po->lpo_sequence_number = $allocated['sequence'];
            $po->reference_number = $allocated['formatted'];
            $po->lpo_date = now()->toDateString();
            AuditLog::record('procurement.lpo_number_allocated', [
                'auditable_type' => PurchaseOrder::class,
                'auditable_id' => $po->id,
                'new_values' => ['lpo_number' => $po->lpo_number, 'lpo_date' => $po->lpo_date],
                'tags' => 'procurement',
            ]);
        }

        $po->status = 'awaiting_approval';
        $po->submitted_at = now();
        $po->save();

        $started = $this->workflow->initiate($po, 'purchase_order', $user, $idempotencyKey ?? ('po-submit:'.$po->id), [
            'amount' => (float) $po->total_amount,
        ]);
        if (! $started) {
            $po->update(['status' => 'draft']);
            throw ValidationException::withMessages([
                'workflow' => 'SUBMISSION_BLOCKED: no active Purchase Order approval workflow is configured.',
            ]);
        }

        AuditLog::record('procurement.lpo_submitted', [
            'auditable_type' => PurchaseOrder::class,
            'auditable_id' => $po->id,
            'tags' => 'procurement',
        ]);

        return $po->fresh(['vendor', 'items', 'project']);
    }

    public function approve(PurchaseOrder $po, User $user, ?string $comment = null, ?string $idempotencyKey = null): PurchaseOrder
    {
        $approval = $po->approvalRequest()->whereIn('status', ['pending', 'returned'])->latest('id')->first();
        if (! $approval) {
            abort(403, 'No open approval step.');
        }
        $this->workflow->approve($approval, $user, $comment, $idempotencyKey);

        return $po->fresh();
    }

    public function returnForCorrection(PurchaseOrder $po, User $user, string $comment): PurchaseOrder
    {
        $approval = $po->approvalRequest()->whereIn('status', ['pending'])->latest('id')->firstOrFail();
        $this->workflow->returnForCorrection($approval, $user, $comment);
        AuditLog::record('procurement.lpo_returned', [
            'auditable_type' => PurchaseOrder::class,
            'auditable_id' => $po->id,
            'new_values' => ['comment' => $comment],
            'tags' => 'procurement',
        ]);

        return $po->fresh();
    }

    public function reject(PurchaseOrder $po, User $user, string $reason, ?string $idempotencyKey = null): PurchaseOrder
    {
        $approval = $po->approvalRequest()->whereIn('status', ['pending'])->latest('id')->firstOrFail();
        $this->workflow->reject($approval, $user, $reason, $idempotencyKey);
        AuditLog::record('procurement.lpo_rejected', [
            'auditable_type' => PurchaseOrder::class,
            'auditable_id' => $po->id,
            'new_values' => ['reason' => $reason],
            'tags' => 'procurement',
        ]);

        return $po->fresh();
    }

    public function generateFinalPdf(PurchaseOrder $po, User $user): PurchaseOrder
    {
        try {
            $binary = $this->pdf->output($po);
        } catch (\Throwable $e) {
            throw ValidationException::withMessages([
                'pdf' => 'PDF failed. LPO remains approved and is not issued.',
            ]);
        }

        $tmp = tempnam(sys_get_temp_dir(), 'lpo');
        file_put_contents($tmp, $binary);
        $uploaded = new UploadedFile($tmp, $this->pdf->filename($po), 'application/pdf', null, true);
        $attachment = $this->bridge->storeAttachment($user, $po, $uploaded, [
            'document_type' => 'signed_po',
            'module' => 'procurement',
            'title' => $this->pdf->filename($po),
        ]);
        @unlink($tmp);

        $hash = hash('sha256', $binary);
        $po->update([
            'final_pdf_attachment_id' => $attachment->id,
            'final_document_hash' => $hash,
            'status' => 'issued',
            'issued_at' => $po->issued_at ?: now(),
            'issued_by' => $user->id,
            'lpo_date' => $po->lpo_date ?: now()->toDateString(),
        ]);
        AuditLog::record('procurement.lpo_issued', [
            'auditable_type' => PurchaseOrder::class,
            'auditable_id' => $po->id,
            'new_values' => ['hash' => $hash, 'lpo_number' => $po->lpo_number],
            'tags' => 'procurement',
        ]);

        return $po->fresh(['vendor', 'items']);
    }

    public function emailSupplier(PurchaseOrder $po, User $user, ?string $to = null, ?string $idempotencyKey = null): PurchaseOrder
    {
        if ($po->status !== 'issued') {
            throw ValidationException::withMessages(['status' => 'Only issued LPOs can be emailed.']);
        }
        if ($idempotencyKey && $po->supplier_email_status === 'queued') {
            return $po;
        }
        $recipient = $to ?: $po->vendor?->contact_email;
        if (! $recipient) {
            throw ValidationException::withMessages(['email' => 'Supplier Master has no verified email.']);
        }
        try {
            $this->notifications->dispatchExternal(
                (int) $po->tenant_id,
                $recipient,
                (string) ($po->vendor->contact_name ?: $po->vendor->name),
                'procurement.lpo_issued_external',
                [
                    'name' => $po->vendor->contact_name ?: $po->vendor->name,
                    'reference' => $po->lpo_number ?: $po->reference_number,
                    'amount' => number_format((float) $po->total_amount, 2).' '.$po->currency,
                    'filename' => $this->pdf->filename($po),
                ],
                [
                    'module' => 'procurement',
                    'record_id' => $po->id,
                    'idempotency_key' => $idempotencyKey ?? ('lpo-email:'.$po->id),
                ],
            );
            $po->update([
                'supplier_email_status' => 'queued',
                'supplier_email_recipient' => $recipient,
                'sent_to_supplier_at' => now(),
            ]);
            AuditLog::record('procurement.lpo_emailed', [
                'auditable_type' => PurchaseOrder::class,
                'auditable_id' => $po->id,
                'new_values' => ['recipient' => $recipient, 'status' => 'queued'],
                'tags' => 'procurement',
            ]);
        } catch (\Throwable $e) {
            $po->update(['supplier_email_status' => 'failed']);
            throw ValidationException::withMessages(['email' => 'Email failed. Status remains EMAIL_FAILED, not sent.']);
        }

        return $po->fresh();
    }

    public function void(PurchaseOrder $po, User $user, string $reason): PurchaseOrder
    {
        if ($po->lpo_number) {
            $this->sequence->recordVoid((int) $po->tenant_id, $po->lpo_number);
        }
        $po->update([
            'status' => 'void',
            'void_reason' => $reason,
            'voided_by' => $user->id,
            'voided_at' => now(),
        ]);
        ProcurementException::create([
            'tenant_id' => $po->tenant_id,
            'purchase_order_id' => $po->id,
            'exception_type' => ProcurementException::TYPE_VOID,
            'reason' => $reason,
            'requested_by' => $user->id,
            'status' => ProcurementException::STATUS_APPROVED,
            'resolved_at' => now(),
        ]);
        AuditLog::record('procurement.lpo_voided', [
            'auditable_type' => PurchaseOrder::class,
            'auditable_id' => $po->id,
            'new_values' => ['reason' => $reason, 'lpo_number' => $po->lpo_number],
            'tags' => 'procurement',
        ]);

        return $po->fresh();
    }

    public function amend(PurchaseOrder $po, User $user, array $data): PurchaseOrder
    {
        if (! in_array($po->status, ['issued', 'approved'], true)) {
            throw ValidationException::withMessages(['status' => 'Only approved or issued LPOs can be amended.']);
        }
        $reason = $data['reason'] ?? '';
        if ($reason === '') {
            throw ValidationException::withMessages(['reason' => 'Amendment reason is required.']);
        }
        $snapshot = $po->load('items')->toArray();
        $po->purchaseOrderRevisions()->create([
            'revision' => $po->revision,
            'reason' => $reason,
            'changed_by' => $user->id,
            'snapshot' => $snapshot,
            'changes' => $data,
        ]);
        $po->update([
            'revision' => $po->revision + 1,
            'status' => 'draft',
            'final_pdf_attachment_id' => null,
            'final_document_hash' => null,
        ]);
        AuditLog::record('procurement.lpo_amended', [
            'auditable_type' => PurchaseOrder::class,
            'auditable_id' => $po->id,
            'new_values' => ['revision' => $po->revision, 'reason' => $reason],
            'tags' => 'procurement',
        ]);

        return $po->fresh(['items']);
    }

    public function attachSupplierInvoice(ProcurementDocumentIntake $intake, PurchaseOrder $po): void
    {
        if (! in_array($intake->document_type, ['invoice', 'proforma_invoice', 'credit_note'], true)) {
            return;
        }
        $number = $intake->document_number ?: ('UNNUMBERED-'.$intake->id);
        $exists = \App\Models\Invoice::query()
            ->where('tenant_id', $intake->tenant_id)
            ->where('vendor_id', $intake->vendor_id)
            ->where('vendor_invoice_number', $number)
            ->exists();
        if ($exists) {
            return;
        }
        $date = optional($intake->document_date)?->toDateString() ?: now()->toDateString();
        \App\Models\Invoice::create([
            'tenant_id' => $intake->tenant_id,
            'purchase_order_id' => $po->id,
            'vendor_id' => $intake->vendor_id,
            'vendor_invoice_number' => $number,
            'invoice_date' => $date,
            'due_date' => optional($intake->due_date)?->toDateString() ?: $date,
            'amount' => $intake->grand_total ?? $po->total_amount,
            'currency' => $intake->currency ?? $po->currency,
            'status' => 'received',
            'intake_id' => $intake->id,
            'file_hash' => $intake->file_hash,
            'document_type' => $intake->document_type,
        ]);
    }
}
