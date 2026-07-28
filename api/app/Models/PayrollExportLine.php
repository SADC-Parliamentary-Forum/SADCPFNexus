<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PayrollExportLine extends Model
{
    protected $fillable = [
        'batch_id', 'overtime_settlement_id', 'user_id',
        'hours', 'payable_hours', 'day_type',
    ];

    protected $casts = [
        'hours' => 'decimal:2',
        'payable_hours' => 'decimal:2',
    ];

    public function batch(): BelongsTo
    {
        return $this->belongsTo(PayrollExportBatch::class, 'batch_id');
    }

    public function settlement(): BelongsTo
    {
        return $this->belongsTo(OvertimeSettlement::class, 'overtime_settlement_id');
    }
}
