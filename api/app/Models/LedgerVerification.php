<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LedgerVerification extends Model
{
    protected $fillable = [
        'tenant_id',
        'initiated_by',
        'type',
        'status',
        'manifest_hash',
        'entries_checked',
        'notes',
        'verified_at',
    ];

    protected $casts = [
        'verified_at' => 'datetime',
    ];

    public function initiator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'initiated_by');
    }
}
