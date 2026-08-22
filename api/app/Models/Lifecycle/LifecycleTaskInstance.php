<?php

namespace App\Models\Lifecycle;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LifecycleTaskInstance extends Model
{
    protected $fillable = [
        'tenant_id',
        'case_id',
        'stage_instance_id',
        'task_key',
        'title',
        'description',
        'assignee_role',
        'department_slug',
        'mandatory',
        'optional_group',
        'condition',
        'due_date',
        'due_offset_days',
        'due_anchor',
        'status',
        'clearance_status',
        'evidence_required',
        'assignment_id',
        'workflow_request_id',
        'revision',
        'completed_by',
        'completed_at',
    ];

    protected $casts = [
        'mandatory' => 'boolean',
        'evidence_required' => 'boolean',
        'condition' => 'array',
        'due_date' => 'date',
        'completed_at' => 'datetime',
    ];

    public function lifecycleCase(): BelongsTo
    {
        return $this->belongsTo(LifecycleCase::class, 'case_id');
    }

    public function stage(): BelongsTo
    {
        return $this->belongsTo(LifecycleStageInstance::class, 'stage_instance_id');
    }

    public function evidence(): HasMany
    {
        return $this->hasMany(LifecycleEvidence::class, 'task_instance_id');
    }

    public function completer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'completed_by');
    }
}
