<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use RuntimeException;

class MeetingDecisionHistory extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'meeting_decision_history';

    protected $fillable = [
        'tenant_id',
        'meeting_decision_id',
        'actor_id',
        'change_type',
        'from_status',
        'to_status',
        'old_values',
        'new_values',
        'hash',
        'notes',
    ];

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
        'created_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::updating(function (): never {
            throw new RuntimeException('MeetingDecisionHistory records are immutable and cannot be updated.');
        });

        static::deleting(function (): never {
            throw new RuntimeException('MeetingDecisionHistory records are immutable and cannot be deleted.');
        });
    }

    public function decision(): BelongsTo
    {
        return $this->belongsTo(MeetingDecision::class, 'meeting_decision_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
