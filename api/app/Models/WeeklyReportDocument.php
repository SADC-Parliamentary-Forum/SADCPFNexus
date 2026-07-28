<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WeeklyReportDocument extends Model
{
    protected $fillable = [
        'weekly_report_id', 'disk', 'path', 'original_name', 'mime_type', 'size', 'uploaded_by',
    ];

    public function report(): BelongsTo
    {
        return $this->belongsTo(WeeklyReport::class, 'weekly_report_id');
    }
}
