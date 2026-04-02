<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Facades\Storage;

class Attachment extends Model
{
    public const DOCUMENT_TYPE_CONCEPT_NOTE = 'concept_note';
    public const DOCUMENT_TYPE_MEMO = 'memo';
    public const DOCUMENT_TYPE_HOTEL_QUOTE = 'hotel_quote';
    public const DOCUMENT_TYPE_TRANSPORT_QUOTE = 'transport_quote';
    public const DOCUMENT_TYPE_OTHER = 'other';
    public const DOCUMENT_TYPE_WORKPLAN = 'workplan_document';
    public const DOCUMENT_TYPE_APPRAISAL_EVIDENCE = 'appraisal_evidence';

    // Profile / HR document types
    public const DOCUMENT_TYPE_CV = 'cv';
    public const DOCUMENT_TYPE_QUALIFICATION = 'qualification';
    public const DOCUMENT_TYPE_ID_DOCUMENT = 'id_document';
    public const DOCUMENT_TYPE_EMPLOYMENT_CONTRACT = 'employment_contract';
    public const DOCUMENT_TYPE_TRAINING_CERTIFICATE = 'training_certificate';
    public const DOCUMENT_TYPE_PERFORMANCE_REVIEW = 'performance_review';
    public const DOCUMENT_TYPE_RECOMMENDATION = 'recommendation';
    public const DOCUMENT_TYPE_PHOTO = 'photo';

    // Risk document types
    public const DOCUMENT_TYPE_RISK_POLICY          = 'risk_policy';
    public const DOCUMENT_TYPE_RISK_ASSESSMENT      = 'risk_assessment';
    public const DOCUMENT_TYPE_RISK_EVIDENCE        = 'risk_evidence';
    public const DOCUMENT_TYPE_RISK_MITIGATION_PLAN = 'risk_mitigation_plan';
    public const DOCUMENT_TYPE_CLOSURE_EVIDENCE     = 'closure_evidence';

    public const DOCUMENT_TYPES = [
        self::DOCUMENT_TYPE_CONCEPT_NOTE,
        self::DOCUMENT_TYPE_MEMO,
        self::DOCUMENT_TYPE_HOTEL_QUOTE,
        self::DOCUMENT_TYPE_TRANSPORT_QUOTE,
        self::DOCUMENT_TYPE_OTHER,
        self::DOCUMENT_TYPE_WORKPLAN,
        self::DOCUMENT_TYPE_APPRAISAL_EVIDENCE,
        self::DOCUMENT_TYPE_CV,
        self::DOCUMENT_TYPE_QUALIFICATION,
        self::DOCUMENT_TYPE_ID_DOCUMENT,
        self::DOCUMENT_TYPE_EMPLOYMENT_CONTRACT,
        self::DOCUMENT_TYPE_TRAINING_CERTIFICATE,
        self::DOCUMENT_TYPE_PERFORMANCE_REVIEW,
        self::DOCUMENT_TYPE_RECOMMENDATION,
        self::DOCUMENT_TYPE_PHOTO,
        self::DOCUMENT_TYPE_RISK_POLICY,
        self::DOCUMENT_TYPE_RISK_ASSESSMENT,
        self::DOCUMENT_TYPE_RISK_EVIDENCE,
        self::DOCUMENT_TYPE_RISK_MITIGATION_PLAN,
        self::DOCUMENT_TYPE_CLOSURE_EVIDENCE,
        // Procurement
        self::DOCUMENT_TYPE_RFQ_DOCUMENT,
        self::DOCUMENT_TYPE_QUOTE_RECEIVED,
        self::DOCUMENT_TYPE_BID_DOCUMENT,
        self::DOCUMENT_TYPE_EVALUATION_REPORT,
        self::DOCUMENT_TYPE_AWARD_LETTER,
        self::DOCUMENT_TYPE_SIGNED_PO,
        self::DOCUMENT_TYPE_VENDOR_ACKNOWLEDGEMENT,
        self::DOCUMENT_TYPE_DELIVERY_SCHEDULE,
        self::DOCUMENT_TYPE_PO_AMENDMENT,
        self::DOCUMENT_TYPE_TAX_INVOICE,
        self::DOCUMENT_TYPE_CREDIT_NOTE,
        self::DOCUMENT_TYPE_REMITTANCE_ADVICE,
        self::DOCUMENT_TYPE_INVOICE_SUPPORTING,
        self::DOCUMENT_TYPE_SIGNED_CONTRACT,
        self::DOCUMENT_TYPE_CONTRACT_AMENDMENT,
        self::DOCUMENT_TYPE_CONTRACT_ADDENDUM,
        self::DOCUMENT_TYPE_TERMINATION_NOTICE,
        self::DOCUMENT_TYPE_DELIVERY_NOTE,
        self::DOCUMENT_TYPE_INSPECTION_REPORT,
        self::DOCUMENT_TYPE_PACKING_LIST,
        self::DOCUMENT_TYPE_REGISTRATION_CERT,
        self::DOCUMENT_TYPE_TAX_CLEARANCE,
        self::DOCUMENT_TYPE_COMPANY_PROFILE,
        self::DOCUMENT_TYPE_BANK_DETAILS,
    ];

    /** Document types for user profile documents */
    public const PROFILE_DOCUMENT_TYPES = [
        self::DOCUMENT_TYPE_CV,
        self::DOCUMENT_TYPE_QUALIFICATION,
        self::DOCUMENT_TYPE_ID_DOCUMENT,
        self::DOCUMENT_TYPE_EMPLOYMENT_CONTRACT,
        self::DOCUMENT_TYPE_TRAINING_CERTIFICATE,
        self::DOCUMENT_TYPE_PERFORMANCE_REVIEW,
        self::DOCUMENT_TYPE_RECOMMENDATION,
        self::DOCUMENT_TYPE_PHOTO,
        self::DOCUMENT_TYPE_OTHER,
    ];

    /** Document types valid for appraisal evidence attachments */
    public const APPRAISAL_DOCUMENT_TYPES = [
        self::DOCUMENT_TYPE_APPRAISAL_EVIDENCE,
        self::DOCUMENT_TYPE_OTHER,
    ];

    /** Document types valid for workplan event attachments */
    public const WORKPLAN_DOCUMENT_TYPES = [
        self::DOCUMENT_TYPE_WORKPLAN,
        self::DOCUMENT_TYPE_OTHER,
    ];

    /** Document types that can be marked as chosen quote with a reason */
    public const QUOTE_DOCUMENT_TYPES = [
        self::DOCUMENT_TYPE_HOTEL_QUOTE,
        self::DOCUMENT_TYPE_TRANSPORT_QUOTE,
        self::DOCUMENT_TYPE_OTHER,
    ];

    // ── Procurement document types ──────────────────────────────────────────
    public const DOCUMENT_TYPE_RFQ_DOCUMENT        = 'rfq_document';
    public const DOCUMENT_TYPE_QUOTE_RECEIVED      = 'quote_received';
    public const DOCUMENT_TYPE_BID_DOCUMENT        = 'bid_document';
    public const DOCUMENT_TYPE_EVALUATION_REPORT   = 'evaluation_report';
    public const DOCUMENT_TYPE_AWARD_LETTER        = 'award_letter';
    public const DOCUMENT_TYPE_SIGNED_PO           = 'signed_po';
    public const DOCUMENT_TYPE_VENDOR_ACKNOWLEDGEMENT = 'vendor_acknowledgement';
    public const DOCUMENT_TYPE_DELIVERY_SCHEDULE   = 'delivery_schedule';
    public const DOCUMENT_TYPE_PO_AMENDMENT        = 'po_amendment';
    public const DOCUMENT_TYPE_TAX_INVOICE         = 'tax_invoice';
    public const DOCUMENT_TYPE_CREDIT_NOTE         = 'credit_note';
    public const DOCUMENT_TYPE_REMITTANCE_ADVICE   = 'remittance_advice';
    public const DOCUMENT_TYPE_INVOICE_SUPPORTING  = 'invoice_supporting';
    public const DOCUMENT_TYPE_SIGNED_CONTRACT     = 'signed_contract';
    public const DOCUMENT_TYPE_CONTRACT_AMENDMENT  = 'contract_amendment';
    public const DOCUMENT_TYPE_CONTRACT_ADDENDUM   = 'contract_addendum';
    public const DOCUMENT_TYPE_TERMINATION_NOTICE  = 'termination_notice';
    public const DOCUMENT_TYPE_DELIVERY_NOTE       = 'delivery_note';
    public const DOCUMENT_TYPE_INSPECTION_REPORT   = 'inspection_report';
    public const DOCUMENT_TYPE_PACKING_LIST        = 'packing_list';
    public const DOCUMENT_TYPE_REGISTRATION_CERT   = 'registration_certificate';
    public const DOCUMENT_TYPE_TAX_CLEARANCE       = 'tax_clearance';
    public const DOCUMENT_TYPE_COMPANY_PROFILE     = 'company_profile';
    public const DOCUMENT_TYPE_BANK_DETAILS        = 'bank_details';

    public const PROCUREMENT_REQUEST_DOCUMENT_TYPES = [
        self::DOCUMENT_TYPE_RFQ_DOCUMENT,
        self::DOCUMENT_TYPE_QUOTE_RECEIVED,
        self::DOCUMENT_TYPE_BID_DOCUMENT,
        self::DOCUMENT_TYPE_EVALUATION_REPORT,
        self::DOCUMENT_TYPE_AWARD_LETTER,
        self::DOCUMENT_TYPE_OTHER,
    ];

    public const PURCHASE_ORDER_DOCUMENT_TYPES = [
        self::DOCUMENT_TYPE_SIGNED_PO,
        self::DOCUMENT_TYPE_VENDOR_ACKNOWLEDGEMENT,
        self::DOCUMENT_TYPE_DELIVERY_SCHEDULE,
        self::DOCUMENT_TYPE_PO_AMENDMENT,
        self::DOCUMENT_TYPE_OTHER,
    ];

    public const INVOICE_DOCUMENT_TYPES = [
        self::DOCUMENT_TYPE_TAX_INVOICE,
        self::DOCUMENT_TYPE_CREDIT_NOTE,
        self::DOCUMENT_TYPE_REMITTANCE_ADVICE,
        self::DOCUMENT_TYPE_INVOICE_SUPPORTING,
        self::DOCUMENT_TYPE_OTHER,
    ];

    public const CONTRACT_DOCUMENT_TYPES = [
        self::DOCUMENT_TYPE_SIGNED_CONTRACT,
        self::DOCUMENT_TYPE_CONTRACT_AMENDMENT,
        self::DOCUMENT_TYPE_CONTRACT_ADDENDUM,
        self::DOCUMENT_TYPE_TERMINATION_NOTICE,
        self::DOCUMENT_TYPE_OTHER,
    ];

    public const GOODS_RECEIPT_DOCUMENT_TYPES = [
        self::DOCUMENT_TYPE_DELIVERY_NOTE,
        self::DOCUMENT_TYPE_INSPECTION_REPORT,
        self::DOCUMENT_TYPE_PACKING_LIST,
        self::DOCUMENT_TYPE_OTHER,
    ];

    public const VENDOR_DOCUMENT_TYPES = [
        self::DOCUMENT_TYPE_REGISTRATION_CERT,
        self::DOCUMENT_TYPE_TAX_CLEARANCE,
        self::DOCUMENT_TYPE_COMPANY_PROFILE,
        self::DOCUMENT_TYPE_BANK_DETAILS,
        self::DOCUMENT_TYPE_OTHER,
    ];

    /** Document types valid for risk attachments */
    public const RISK_DOCUMENT_TYPES = [
        self::DOCUMENT_TYPE_RISK_POLICY,
        self::DOCUMENT_TYPE_RISK_ASSESSMENT,
        self::DOCUMENT_TYPE_RISK_EVIDENCE,
        self::DOCUMENT_TYPE_RISK_MITIGATION_PLAN,
        self::DOCUMENT_TYPE_CLOSURE_EVIDENCE,
        self::DOCUMENT_TYPE_OTHER,
    ];

    protected $fillable = [
        'tenant_id',
        'uploaded_by',
        'attachable_type',
        'attachable_id',
        'document_type',
        'language',
        'original_filename',
        'storage_path',
        'mime_type',
        'size_bytes',
        'is_chosen_quote',
        'selection_reason',
    ];

    protected function casts(): array
    {
        return [
            'size_bytes'       => 'integer',
            'is_chosen_quote'  => 'boolean',
        ];
    }

    public function isQuoteType(): bool
    {
        return \in_array($this->document_type, self::QUOTE_DOCUMENT_TYPES, true);
    }

    public function attachable(): MorphTo
    {
        return $this->morphTo();
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function getStorageDisk(): string
    {
        return 'local';
    }

    public function existsOnDisk(): bool
    {
        return $this->storage_path && Storage::disk($this->getStorageDisk())->exists($this->storage_path);
    }
}
