<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CalendarEntry extends Model
{
    public const TYPE_SADC_HOLIDAY = 'sadc_holiday';
    public const TYPE_UN_DAY = 'un_day';
    public const TYPE_SADC_CALENDAR = 'sadc_calendar';

    protected $fillable = [
        'tenant_id',
        'type',
        'country_code',
        'date',
        'title',
        'description',
        'is_alert',
    ];

    protected function casts(): array
    {
        return [
            'date'     => 'date',
            'is_alert' => 'boolean',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function isUnDay(): bool
    {
        return $this->type === self::TYPE_UN_DAY;
    }
}
