<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TimesheetHistoricalVerification extends Model
{
    public const SCOPE_BATCH = 'batch';

    public const SCOPE_EMPLOYEE_PERIOD = 'employee_period';

    protected $fillable = [
        'tenant_id', 'import_batch_id', 'user_id', 'period_start', 'period_end',
        'scope', 'justification', 'verified_by', 'verified_at',
    ];

    protected function casts(): array
    {
        return [
            'period_start' => 'date',
            'period_end' => 'date',
            'verified_at' => 'datetime',
        ];
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(TimesheetImportBatch::class, 'import_batch_id');
    }

    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }
}
