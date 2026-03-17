<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssignmentUpdate extends Model
{
    protected $fillable = [
        'tenant_id',
        'assignment_id',
        'submitted_by',
        'type',
        'progress_percent',
        'notes',
        'blocker_type',
        'blocker_details',
    ];

    protected function casts(): array
    {
        return [
            'progress_percent' => 'integer',
        ];
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class);
    }

    public function submitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }
}
