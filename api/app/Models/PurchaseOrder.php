<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class PurchaseOrder extends Model
{
    use SoftDeletes;

    public const ISSUED_IMMUTABLE_STATUSES = ['issued', 'partially_received', 'received', 'invoiced', 'closed', 'sent_to_finance'];

    protected $fillable = [
        'tenant_id', 'procurement_request_id', 'vendor_id', 'reference_number',
        'title', 'description', 'delivery_address', 'payment_terms',
        'total_amount', 'currency', 'status',
        'issued_at', 'expected_delivery_date', 'cancellation_reason',
        'created_by', 'issued_by',
        'lpo_number', 'lpo_sequence_number', 'lpo_date',
        'procurement_project_id', 'programme_id', 'source_intake_id', 'exception_id',
        'requested_by_user_id', 'prepared_by_user_id', 'source_type',
        'procurement_method', 'retrospective', 'revision',
        'subtotal', 'tax_amount', 'vat_identified', 'discount_amount', 'tax_exempt_reason',
        'submitted_at', 'approved_at', 'sent_to_supplier_at',
        'supplier_email_status', 'supplier_email_recipient', 'closed_at',
        'final_pdf_attachment_id', 'final_document_hash',
        'finance_handover_status', 'sent_to_finance_at',
        'void_reason', 'voided_by', 'voided_at', 'idempotency_key',
    ];

    protected $casts = [
        'total_amount'           => 'float',
        'issued_at'              => 'datetime',
        'expected_delivery_date' => 'date',
        'lpo_date'               => 'date',
        'retrospective'          => 'boolean',
        'vat_identified'         => 'boolean',
        'subtotal'               => 'decimal:2',
        'tax_amount'             => 'decimal:2',
        'discount_amount'        => 'decimal:2',
        'submitted_at'           => 'datetime',
        'approved_at'            => 'datetime',
        'sent_to_supplier_at'    => 'datetime',
        'closed_at'              => 'datetime',
        'sent_to_finance_at'     => 'datetime',
        'voided_at'              => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $po): void {
            if (empty($po->reference_number)) {
                $po->reference_number = 'PO-' . strtoupper(Str::random(8));
            }
        });
        static::updating(function (self $po): void {
            if (! $po->isDirty()) {
                return;
            }
            $locked = ['vendor_id', 'procurement_project_id', 'total_amount', 'currency', 'subtotal', 'tax_amount', 'lpo_number', 'lpo_date'];
            if (in_array($po->getOriginal('status'), self::ISSUED_IMMUTABLE_STATUSES, true)
                && $po->isDirty($locked)
                && ! in_array($po->status, ['draft', 'void'], true)
                && $po->getOriginal('status') === $po->status) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'status' => 'Issued LPO financial fields are immutable. Use amend or void-and-replace.',
                ]);
            }
        });
    }

    public function procurementRequest() { return $this->belongsTo(ProcurementRequest::class); }
    public function vendor()             { return $this->belongsTo(Vendor::class); }
    public function items()              { return $this->hasMany(PurchaseOrderItem::class); }
    public function goodsReceiptNotes()  { return $this->hasMany(GoodsReceiptNote::class); }
    public function createdBy()          { return $this->belongsTo(User::class, 'created_by'); }
    public function issuedBy()           { return $this->belongsTo(User::class, 'issued_by'); }
    public function project()            { return $this->belongsTo(ProcurementProject::class, 'procurement_project_id'); }
    public function sourceIntake()       { return $this->belongsTo(ProcurementDocumentIntake::class, 'source_intake_id'); }
    public function serviceConfirmations() { return $this->hasMany(ServiceConfirmation::class); }
    public function purchaseOrderRevisions() { return $this->hasMany(PurchaseOrderRevision::class); }
    public function invoices()           { return $this->hasMany(Invoice::class); }

    public function approvalRequest(): MorphOne
    {
        return $this->morphOne(ApprovalRequest::class, 'approvable');
    }

    public function isDraft(): bool    { return in_array($this->status, ['draft', 'returned'], true); }
    public function isIssued(): bool   { return in_array($this->status, ['issued', 'partially_received']); }
    public function isReceived(): bool { return $this->status === 'received'; }
    public function isClosed(): bool   { return $this->status === 'closed'; }

    public function canBeIssued(): bool   { return $this->isDraft() || $this->status === 'approved'; }
    public function canReceiveGoods(): bool { return in_array($this->status, ['issued', 'partially_received']); }

    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable')->latest();
    }

    public function onWorkflowApproved(User $approver): void
    {
        $this->update([
            'status' => 'approved',
            'approved_at' => now(),
        ]);
        try {
            app(\App\Modules\Procurement\Services\LpoIssuanceService::class)->generateFinalPdf($this, $approver);
        } catch (\Throwable) {
            // PDF failed → remain APPROVED, not ISSUED.
        }
        AuditLog::record('procurement.lpo_approved', [
            'auditable_type' => self::class,
            'auditable_id' => $this->id,
            'tags' => 'procurement',
        ]);
        $this->loadMissing('createdBy');
        if ($this->createdBy) {
            app(\App\Services\NotificationService::class)->dispatch(
                $this->createdBy,
                'procurement.lpo_approved',
                ['name' => $this->createdBy->name, 'reference' => $this->lpo_number ?: $this->reference_number],
                ['module' => 'procurement', 'record_id' => $this->id, 'url' => '/procurement/purchase-orders/'.$this->id]
            );
        }
    }

    public function onWorkflowRejected(User $approver, ?string $reason): void
    {
        $this->update(['status' => 'rejected']);
    }

    public function onWorkflowReturned(User $approver, ?string $comment = null): void
    {
        $this->update(['status' => 'returned']);
    }

    public function onWorkflowWithdrawn(): void
    {
        $this->update(['status' => 'draft']);
    }

    public function onWorkflowResubmitted(): void
    {
        $this->update(['status' => 'awaiting_approval']);
    }
}
