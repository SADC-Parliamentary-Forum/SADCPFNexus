<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TimesheetTemplate extends Model
{
    protected $fillable = [
        'tenant_id',
        'name',
        'code',
        'donor_name',
        'description',
        'is_active',
        'sort_order',
        'defaults',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'sort_order' => 'integer',
            'defaults' => 'array',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
