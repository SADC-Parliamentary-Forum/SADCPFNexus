<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MeFollowUpAction extends Model
{
    public const STATUSES = ['open', 'in_progress', 'completed', 'cancelled'];

    public const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

    protected $fillable = [
        'tenant_id',
        'me_activity_report_id',
        'action',
        'assigned_to',
        'due_date',
        'priority',
        'status',
        'comments',
        'completed_at',
        'created_by',
    ];

    protected $casts = [
        'due_date'     => 'date',
        'completed_at' => 'datetime',
    ];

    public function report(): BelongsTo
    {
        return $this->belongsTo(MeActivityReport::class, 'me_activity_report_id');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
