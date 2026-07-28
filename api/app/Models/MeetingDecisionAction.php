<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MeetingDecisionAction extends Model
{
    public const PRIORITIES = ['low', 'medium', 'high', 'critical'];

    public const STATUSES = ['open', 'in_progress', 'completed', 'cancelled'];

    protected $fillable = [
        'tenant_id',
        'meeting_decision_id',
        'created_by',
        'owner_id',
        'description',
        'notes',
        'priority',
        'status',
        'due_date',
        'assignment_id',
        'completed_at',
    ];

    protected $casts = [
        'due_date' => 'date',
        'completed_at' => 'datetime',
    ];

    public function decision(): BelongsTo
    {
        return $this->belongsTo(MeetingDecision::class, 'meeting_decision_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class, 'assignment_id');
    }

    public function isOpenCritical(): bool
    {
        return $this->priority === 'critical'
            && in_array($this->status, ['open', 'in_progress'], true);
    }
}
