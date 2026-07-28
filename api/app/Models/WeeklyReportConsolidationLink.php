<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WeeklyReportConsolidationLink extends Model
{
    protected $fillable = [
        'destination_report_id', 'destination_item_id', 'source_entity_type', 'source_entity_id',
        'source_report_id', 'source_employee_id', 'edited_narrative', 'selected_by', 'selected_at',
    ];

    protected function casts(): array
    {
        return ['selected_at' => 'datetime'];
    }

    public function destinationReport(): BelongsTo
    {
        return $this->belongsTo(WeeklyReport::class, 'destination_report_id');
    }

    public function sourceReport(): BelongsTo
    {
        return $this->belongsTo(WeeklyReport::class, 'source_report_id');
    }
}
