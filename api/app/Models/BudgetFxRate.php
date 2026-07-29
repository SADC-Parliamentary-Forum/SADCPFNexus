<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BudgetFxRate extends Model
{
    protected $fillable = [
        'tenant_id',
        'base_currency',
        'quote_currency',
        'rate',
        'effective_date',
        'source',
        'notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'rate' => 'float',
            'effective_date' => 'date',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
