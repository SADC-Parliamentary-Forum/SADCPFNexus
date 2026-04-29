<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HolidayDate extends Model
{
    use HasFactory;

    protected $fillable = [
        'holiday_calendar_id',
        'holiday_name',
        'date',
        'is_paid_holiday',
    ];

    protected $casts = [
        'date'            => 'date',
        'is_paid_holiday' => 'bool',
    ];

    public function calendar(): BelongsTo
    {
        return $this->belongsTo(HolidayCalendar::class, 'holiday_calendar_id');
    }
}
