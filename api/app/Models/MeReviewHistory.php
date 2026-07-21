<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MeReviewHistory extends Model
{
    public const UPDATED_AT = null; // immutable — no updated_at

    protected $table = 'me_review_history';

    protected $fillable = [
        'tenant_id', 'me_activity_report_id', 'actor_id', 'change_type',
        'from_status', 'to_status', 'old_values', 'new_values', 'hash', 'notes',
    ];

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
        'created_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::updating(fn () => false);
        static::deleting(fn () => false);
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(MeActivityReport::class, 'me_activity_report_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
