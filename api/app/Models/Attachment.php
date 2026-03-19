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
