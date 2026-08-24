<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StockEventPack extends Model
{
    protected $fillable = [
        'tenant_id', 'name', 'event_type', 'notes', 'created_by',
    ];

    public function lines(): HasMany
    {
        return $this->hasMany(StockEventPackLine::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
