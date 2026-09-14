<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SupplierDocument extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_VERIFIED = 'verified';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_EXPIRED = 'expired';

    protected $fillable = [
        'tenant_id',
        'vendor_id',
        'requirement_type_id',
        'type_code',
        'name',
        'document_number',
        'issuing_authority',
        'issue_date',
        'expiry_date',
        'attachment_id',
        'original_filename',
        'storage_path',
        'mime_type',
        'size_bytes',
        'version',
        'status',
        'verified_by',
        'verified_at',
        'remarks',
        'replaces_document_id',
        'is_current',
        'uploaded_by',
    ];

    protected $casts = [
        'issue_date' => 'date',
        'expiry_date' => 'date',
        'verified_at' => 'datetime',
        'is_current' => 'boolean',
    ];

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }

    public function requirementType(): BelongsTo
    {
        return $this->belongsTo(SupplierDocumentRequirementType::class, 'requirement_type_id');
    }

    public function attachment(): BelongsTo
    {
        return $this->belongsTo(Attachment::class);
    }

    public function verifiedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function replaces(): BelongsTo
    {
        return $this->belongsTo(self::class, 'replaces_document_id');
    }

    public function isExpired(?\DateTimeInterface $asOf = null): bool
    {
        if (! $this->expiry_date) {
            return false;
        }

        return $this->expiry_date->lt(($asOf ? \Illuminate\Support\Carbon::instance($asOf) : now())->startOfDay());
    }

    public function daysUntilExpiry(?\DateTimeInterface $asOf = null): ?int
    {
        if (! $this->expiry_date) {
            return null;
        }

        $asOfDay = ($asOf ? \Illuminate\Support\Carbon::instance($asOf) : now())->startOfDay();

        return $asOfDay->diffInDays($this->expiry_date, false);
    }
}
