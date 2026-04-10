<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WeeklySummaryPreference extends Model
{
    protected $primaryKey  = 'user_id';
    public    $incrementing = false;

    protected $fillable = [
        'user_id',
        'enabled',
        'detail_mode',
    ];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
