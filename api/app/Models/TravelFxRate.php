<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TravelFxRate extends Model
{
    protected $fillable = [
        'tenant_id', 'from_currency', 'to_currency', 'rate',
        'effective_date', 'source', 'notes', 'created_by',
    ];

    protected $casts = [
        'rate' => 'decimal:8',
        'effective_date' => 'date',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
