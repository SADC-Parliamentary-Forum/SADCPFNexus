<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PayrollImportBatch extends Model
{
    protected $fillable = [
        'tenant_id',
        'reference',
        'driver',
        'status',
        'period',
        'line_count',
        'source_meta',
        'created_by',
        'staged_at',
    ];

    protected function casts(): array
    {
        return [
            'source_meta' => 'array',
            'staged_at' => 'datetime',
        ];
    }

    public function lines(): HasMany
    {
        return $this->hasMany(PayrollImportLine::class, 'batch_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
