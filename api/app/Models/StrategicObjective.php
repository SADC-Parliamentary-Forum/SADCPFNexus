<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class StrategicObjective extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id', 'strategic_goal_id', 'code', 'title', 'description', 'sort_order',
    ];

    protected $casts = [
        'sort_order' => 'integer',
    ];

    public function goal(): BelongsTo
    {
        return $this->belongsTo(StrategicGoal::class, 'strategic_goal_id');
    }

    public function outcomes(): HasMany
    {
        return $this->hasMany(StrategicOutcome::class)->orderBy('sort_order');
    }
}
