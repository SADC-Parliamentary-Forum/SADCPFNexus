<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use RuntimeException;

class RiskHistory extends Model
{
    public const UPDATED_AT = null; // immutable — no updated_at column

    protected $table = 'risk_history';

    protected $fillable = [
        'tenant_id', 'risk_id', 'actor_id',
        'change_type', 'from_status', 'to_status',
        'old_values', 'new_values', 'hash', 'notes',
    ];

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
        'created_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::updating(function (): never {
            throw new RuntimeException('RiskHistory records are immutable and cannot be updated.');
        });

        static::deleting(function (): never {
            throw new RuntimeException('RiskHistory records are immutable and cannot be deleted.');
        });
    }

    // ── Relationships ─────────────────────────────────────────────────────────

    public function risk()  { return $this->belongsTo(Risk::class); }
    public function actor() { return $this->belongsTo(User::class, 'actor_id'); }
}
