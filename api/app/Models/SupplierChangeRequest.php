<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SupplierChangeRequest extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';

    public const GROUP_LEGAL_NAME = 'legal_name';
    public const GROUP_REGISTRATION = 'registration_number';
    public const GROUP_TAX = 'tax_number';
    public const GROUP_OWNERSHIP = 'ownership';
    public const GROUP_BANKING = 'banking';
    public const GROUP_CATEGORIES = 'categories';

    public const CRITICAL_GROUPS = [
        self::GROUP_LEGAL_NAME,
        self::GROUP_REGISTRATION,
        self::GROUP_TAX,
        self::GROUP_OWNERSHIP,
        self::GROUP_BANKING,
        self::GROUP_CATEGORIES,
    ];

    protected $fillable = [
        'tenant_id',
        'vendor_id',
        'field_group',
        'payload',
        'previous_payload',
        'status',
        'reason',
        'review_remarks',
        'requested_by',
        'reviewed_by',
        'reviewed_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'previous_payload' => 'array',
        'reviewed_at' => 'datetime',
    ];

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
