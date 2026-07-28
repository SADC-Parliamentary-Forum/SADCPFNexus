<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CorrespondenceOwner extends Model
{
    protected $table = 'correspondence_owners';

    protected $fillable = [
        'correspondence_id', 'user_id', 'department_id', 'role',
        'action_required', 'instruction', 'due_date', 'ack_status', 'acknowledged_at',
    ];

    protected $casts = [
        'due_date' => 'date',
        'acknowledged_at' => 'datetime',
    ];

    public function correspondence(): BelongsTo
    {
        return $this->belongsTo(Correspondence::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }
}
