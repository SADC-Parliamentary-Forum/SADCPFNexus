<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MeetingActionItem extends Model
{
    protected $fillable = [
        'meeting_minutes_id',
        'description',
        'responsible_id',
        'responsible_name',
        'deadline',
        'assignment_id',
        'status',
        'notes',
    ];

    protected $casts = [
        'deadline' => 'date',
    ];

    public function meeting(): BelongsTo
    {
        return $this->belongsTo(MeetingMinutes::class, 'meeting_minutes_id');
    }

    public function responsible(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responsible_id');
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class);
    }
}
