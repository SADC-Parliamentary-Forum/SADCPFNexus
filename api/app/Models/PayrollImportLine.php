<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PayrollImportLine extends Model
{
    protected $fillable = [
        'batch_id',
        'employee_number',
        'period',
        'gross',
        'deductions',
        'net',
        'external_ref',
        'raw',
    ];

    protected function casts(): array
    {
        return [
            'gross' => 'float',
            'deductions' => 'float',
            'net' => 'float',
            'raw' => 'array',
        ];
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(PayrollImportBatch::class, 'batch_id');
    }
}
