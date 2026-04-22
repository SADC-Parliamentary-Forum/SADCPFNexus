<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PayslipLineConfig extends Model
{
    protected $fillable = [
        'tenant_id',
        'user_id',
        'component_key',
        'label',
        'component_type',
        'source',
        'fixed_amount',
        'is_visible',
        'sort_order',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'fixed_amount' => 'decimal:2',
            'is_visible'   => 'boolean',
            'sort_order'   => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
