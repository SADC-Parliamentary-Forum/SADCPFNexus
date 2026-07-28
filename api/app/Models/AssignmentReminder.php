<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssignmentReminder extends Model
{
    protected $fillable = [
        'tenant_id',
        'assignment_id',
        'reminder_type',
        'scheduled_for',
        'sent_at',
        'status',
        'escalation_level',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_for' => 'datetime',
            'sent_at' => 'datetime',
        ];
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class);
    }
}
