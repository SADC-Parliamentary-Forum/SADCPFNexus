<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProfileChangeRequest extends Model
{
    protected $fillable = [
        'tenant_id',
        'user_id',
        'requested_changes',
        'notes',
        'status',
        'reviewed_by',
        'reviewed_at',
        'review_notes',
    ];

    protected $casts = [
        'requested_changes' => 'array',
        'reviewed_at'       => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    /**
     * Fields permitted for self-service profile changes (must match ProfileController validation).
     */
    public static function allowedFields(): array
    {
        return [
            'phone', 'bio', 'nationality', 'gender', 'marital_status',
            'emergency_contact_name', 'emergency_contact_relationship', 'emergency_contact_phone',
            'address_line1', 'address_line2', 'city', 'country',
        ];
    }
}
