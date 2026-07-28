<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PayrollExportBatch extends Model
{
    public const DRAFT = 'draft';
    public const EXPORTED = 'exported';
    public const RECONCILED = 'reconciled';
    public const CANCELLED = 'cancelled';

    protected $fillable = [
        'tenant_id', 'batch_reference', 'period_id', 'status',
        'exported_by', 'exported_at', 'reconciled_by', 'reconciled_at', 'idempotency_key',
    ];

    protected $casts = [
        'exported_at' => 'datetime',
        'reconciled_at' => 'datetime',
    ];

    public function lines(): HasMany
    {
        return $this->hasMany(PayrollExportLine::class, 'batch_id');
    }

    public function period(): BelongsTo
    {
        return $this->belongsTo(TimesheetPeriod::class, 'period_id');
    }
}
