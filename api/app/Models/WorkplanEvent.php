<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class WorkplanEvent extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id', 'created_by', 'title', 'type', 'meeting_type_id', 'date', 'end_date',
        'description', 'responsible', 'linked_module', 'linked_id',
    ];

    protected $casts = [
        'date'     => 'date',
        'end_date' => 'date',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function meetingType(): BelongsTo
    {
        return $this->belongsTo(MeetingType::class, 'meeting_type_id');
    }

    public function responsibleUsers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'workplan_event_responsible', 'workplan_event_id', 'user_id');
    }

    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable');
    }
}
