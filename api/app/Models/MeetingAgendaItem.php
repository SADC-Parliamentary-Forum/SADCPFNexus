<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class MeetingAgendaItem extends Model
{
    use SoftDeletes;

    public const STATUSES = ['open', 'discussed', 'deferred', 'closed'];

    protected $fillable = [
        'tenant_id', 'workplan_event_id', 'meeting_minutes_id', 'meeting_decision_id',
        'sequence', 'title', 'description', 'status', 'presenter_id', 'created_by',
    ];

    public function workplanEvent(): BelongsTo
    {
        return $this->belongsTo(WorkplanEvent::class, 'workplan_event_id');
    }

    public function minutes(): BelongsTo
    {
        return $this->belongsTo(MeetingMinutes::class, 'meeting_minutes_id');
    }

    public function decision(): BelongsTo
    {
        return $this->belongsTo(MeetingDecision::class, 'meeting_decision_id');
    }

    public function presenter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'presenter_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
