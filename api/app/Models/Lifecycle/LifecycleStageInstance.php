<?php

namespace App\Models\Lifecycle;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LifecycleStageInstance extends Model
{
    protected $fillable = [
        'tenant_id',
        'case_id',
        'stage_key',
        'name',
        'sort_order',
        'parallel_group',
        'status',
        'started_at',
        'completed_at',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function lifecycleCase(): BelongsTo
    {
        return $this->belongsTo(LifecycleCase::class, 'case_id');
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(LifecycleTaskInstance::class, 'stage_instance_id');
    }
}
