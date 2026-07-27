<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ToilExtension extends Model
{
    protected $fillable = [
        'toil_credit_id',
        'original_expiry_date',
        'requested_expiry_date',
        'reason',
        'status',
        'approved_expiry_date',
        'decided_by',
        'decided_at',
        'comments',
    ];

    protected $casts = [
        'original_expiry_date' => 'date',
        'requested_expiry_date' => 'date',
        'approved_expiry_date' => 'date',
        'decided_at' => 'datetime',
    ];

    public function credit(): BelongsTo
    {
        return $this->belongsTo(ToilCredit::class, 'toil_credit_id');
    }
}
