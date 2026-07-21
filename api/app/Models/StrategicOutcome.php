<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class StrategicOutcome extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id', 'strategic_objective_id', 'code', 'title', 'description', 'sort_order',
    ];

    protected $casts = [
        'sort_order' => 'integer',
    ];

    public function objective(): BelongsTo
    {
        return $this->belongsTo(StrategicObjective::class, 'strategic_objective_id');
    }

    public function outputs(): HasMany
    {
        return $this->hasMany(StrategicOutput::class)->orderBy('sort_order');
    }
}
