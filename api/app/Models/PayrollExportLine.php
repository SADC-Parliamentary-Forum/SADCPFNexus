<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PayrollExportLine extends Model
{
    protected $fillable = [
        'batch_id', 'overtime_settlement_id', 'timesheet_id', 'user_id', 'employee_number',
        'hours', 'payable_hours', 'day_type', 'settlement_flag',
        'period_start', 'period_end',
    ];

    protected $casts = [
        'hours' => 'decimal:2',
        'payable_hours' => 'decimal:2',
        'period_start' => 'date',
        'period_end' => 'date',
    ];

    public function batch(): BelongsTo
    {
        return $this->belongsTo(PayrollExportBatch::class, 'batch_id');
    }

    public function settlement(): BelongsTo
    {
        return $this->belongsTo(OvertimeSettlement::class, 'overtime_settlement_id');
    }

    public function timesheet(): BelongsTo
    {
        return $this->belongsTo(Timesheet::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
