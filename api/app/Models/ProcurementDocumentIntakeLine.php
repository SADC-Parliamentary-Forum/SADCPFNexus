<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProcurementDocumentIntakeLine extends Model
{
    protected $fillable = [
        'intake_id', 'line_no', 'source_description', 'lpo_description',
        'quantity', 'unit', 'unit_price', 'discount', 'vat', 'line_total',
        'confidence_score', 'user_corrected', 'original_extracted',
    ];

    protected $casts = [
        'quantity' => 'decimal:3',
        'unit_price' => 'decimal:2',
        'discount' => 'decimal:2',
        'vat' => 'decimal:2',
        'line_total' => 'decimal:2',
        'user_corrected' => 'boolean',
        'original_extracted' => 'array',
    ];

    public function intake()
    {
        return $this->belongsTo(ProcurementDocumentIntake::class, 'intake_id');
    }
}
