<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class StrategicGoal extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id', 'strategic_plan_id', 'code', 'title', 'description', 'sort_order',
    ];

    protected $casts = [
        'sort_order' => 'integer',
    ];

    public function plan(): BelongsTo
    {
        return $this->belongsTo(StrategicPlan::class, 'strategic_plan_id');
    }

    public function objectives(): HasMany
    {
        return $this->hasMany(StrategicObjective::class)->orderBy('sort_order');
    }
}
