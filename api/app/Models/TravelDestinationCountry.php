<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TravelDestinationCountry extends Model
{
    protected $fillable = [
        'tenant_id', 'name', 'is_sadc', 'created_by',
    ];

    protected $casts = [
        'is_sadc' => 'boolean',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function cities(): HasMany
    {
        return $this->hasMany(TravelDestinationCity::class, 'country_id');
    }
}
