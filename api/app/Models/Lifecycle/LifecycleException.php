<?php

namespace App\Models\Lifecycle;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LifecycleException extends Model
{
    protected $fillable = [
        'tenant_id',
        'case_id',
        'task_instance_id',
        'exception_type',
        'reason',
        'status',
        'authoriser_id',
        'authorised_at',
        'resolution_notes',
        'created_by',
    ];

    protected $casts = [
        'authorised_at' => 'datetime',
    ];

    public function lifecycleCase(): BelongsTo
    {
        return $this->belongsTo(LifecycleCase::class, 'case_id');
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(LifecycleTaskInstance::class, 'task_instance_id');
    }

    public function authoriser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'authoriser_id');
    }
}
