<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TravelDestinationCity extends Model
{
    protected $fillable = [
        'tenant_id', 'country_id', 'name', 'created_by',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function country(): BelongsTo
    {
        return $this->belongsTo(TravelDestinationCountry::class, 'country_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
