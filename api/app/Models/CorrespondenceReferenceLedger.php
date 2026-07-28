<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CorrespondenceReferenceLedger extends Model
{
    protected $table = 'correspondence_reference_ledger';

    protected $fillable = [
        'tenant_id', 'direction', 'year', 'series', 'sequence', 'reference',
        'correspondence_id', 'status', 'void_reason', 'created_by',
    ];

    public function correspondence(): BelongsTo
    {
        return $this->belongsTo(Correspondence::class);
    }
}
