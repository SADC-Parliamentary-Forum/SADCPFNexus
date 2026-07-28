<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssignmentChecklistItem extends Model
{
    protected $fillable = [
        'tenant_id',
        'assignment_id',
        'title',
        'description',
        'sequence',
        'mandatory',
        'assignee_id',
        'due_at',
        'completed',
        'completed_by',
        'completed_at',
        'evidence_document_id',
    ];

    protected function casts(): array
    {
        return [
            'mandatory' => 'boolean',
            'completed' => 'boolean',
            'due_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_id');
    }
}
