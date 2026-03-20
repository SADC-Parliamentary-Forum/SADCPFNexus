<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class MeetingMinutes extends Model
{
    protected $table = 'meeting_minutes';

    protected $fillable = [
        'tenant_id',
        'created_by',
        'workplan_event_id',
        'title',
        'meeting_date',
        'location',
        'meeting_type',
        'status',
        'chairperson',
        'attendees',
        'apologies',
        'notes',
    ];

    protected $casts = [
        'meeting_date' => 'date',
        'attendees'    => 'array',
        'apologies'    => 'array',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function actionItems(): HasMany
    {
        return $this->hasMany(MeetingActionItem::class, 'meeting_minutes_id');
    }

    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable');
    }
}
