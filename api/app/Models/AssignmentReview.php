<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssignmentReview extends Model
{
    protected $fillable = [
        'tenant_id',
        'assignment_id',
        'submission_version',
        'reviewer_id',
        'decision',
        'comments',
        'acceptance_criteria_results',
        'follow_up_required',
        'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'acceptance_criteria_results' => 'array',
            'follow_up_required' => 'boolean',
            'reviewed_at' => 'datetime',
        ];
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }
}
