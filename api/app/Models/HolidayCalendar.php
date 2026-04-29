<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class HolidayCalendar extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'name',
        'country_code',
        'is_default',
    ];

    protected $casts = [
        'is_default' => 'bool',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function dates(): HasMany
    {
        return $this->hasMany(HolidayDate::class);
    }
}
