<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProcurementDocumentIntake extends Model
{
    use SoftDeletes;

    public const STATUS_RECEIVED = 'received';
    public const STATUS_EXTRACTING = 'extracting';
    public const STATUS_NEEDS_REVIEW = 'needs_review';
    public const STATUS_EXTRACTION_FAILED = 'extraction_failed';
    public const STATUS_CONFIRMED = 'confirmed';
    public const STATUS_DUPLICATE_BLOCKED = 'duplicate_blocked';
    public const STATUS_ON_HOLD = 'on_hold';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_LINKED = 'linked';

    protected $fillable = [
        'tenant_id', 'uploaded_by', 'attachment_id', 'source_type',
        'original_filename', 'mime_type', 'file_hash', 'file_size_bytes',
        'document_type', 'classification_confidence', 'classification_method',
        'needs_manual_classification', 'extraction_status', 'extraction_confidence',
        'raw_extraction', 'corrected_extraction', 'corrected_by', 'corrected_at',
        'document_number', 'document_date', 'due_date', 'currency', 'currency_ambiguous',
        'payment_terms', 'supplier_name_raw', 'supplier_email_raw', 'supplier_phone_raw',
        'supplier_tax_number_raw', 'supplier_registration_raw', 'supplier_address_raw',
        'bank_details_raw', 'bank_mismatch', 'subtotal', 'vat_amount', 'vat_identified',
        'discount_amount', 'grand_total', 'arithmetic', 'vendor_id', 'supplier_match_status',
        'supplier_differences', 'procurement_request_id', 'purchase_order_id',
        'procurement_project_id', 'duplicate_of_id', 'invoice_first_case', 'policy_result',
        'idempotency_key', 'received_at',
    ];

    protected $casts = [
        'raw_extraction' => 'array',
        'corrected_extraction' => 'array',
        'supplier_address_raw' => 'array',
        'bank_details_raw' => 'array',
        'arithmetic' => 'array',
        'supplier_differences' => 'array',
        'policy_result' => 'array',
        'needs_manual_classification' => 'boolean',
        'currency_ambiguous' => 'boolean',
        'vat_identified' => 'boolean',
        'bank_mismatch' => 'boolean',
        'document_date' => 'date',
        'due_date' => 'date',
        'corrected_at' => 'datetime',
        'received_at' => 'datetime',
        'subtotal' => 'decimal:2',
        'vat_amount' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'grand_total' => 'decimal:2',
    ];

    public function lines()
    {
        return $this->hasMany(ProcurementDocumentIntakeLine::class, 'intake_id')->orderBy('line_no');
    }

    public function vendor()
    {
        return $this->belongsTo(Vendor::class);
    }

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function procurementRequest()
    {
        return $this->belongsTo(ProcurementRequest::class);
    }

    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function project()
    {
        return $this->belongsTo(ProcurementProject::class, 'procurement_project_id');
    }

    public function duplicateOf()
    {
        return $this->belongsTo(self::class, 'duplicate_of_id');
    }

    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable')->latest();
    }

    public function effectiveExtraction(): array
    {
        return $this->corrected_extraction ?: ($this->raw_extraction ?: []);
    }
}
