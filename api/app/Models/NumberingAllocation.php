<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class NumberingAllocation extends Model
{
    protected $fillable = [
        'tenant_id', 'numbering_scheme_id', 'document_type',
        'subject_type', 'subject_id', 'sequence_number',
        'display_reference', 'normalised_reference', 'allocation_type',
        'reason', 'continue_sequence', 'allocated_by', 'allocated_at',
    ];

    protected $casts = [
        'continue_sequence' => 'boolean',
        'allocated_at' => 'datetime',
    ];

    public function subject(): MorphTo
    {
        return $this->morphTo();
    }

    public function allocatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'allocated_by');
    }
}
