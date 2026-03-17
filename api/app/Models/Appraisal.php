<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class Appraisal extends Model
{
    protected $fillable = [
        'tenant_id', 'cycle_id', 'employee_id', 'supervisor_id', 'hod_id',
        'status', 'self_assessment', 'self_overall_rating',
        'supervisor_comments', 'supervisor_rating', 'supervisor_reviewed_at',
        'hod_comments', 'hod_rating', 'hod_reviewed_at',
        'hr_comments', 'overall_rating', 'overall_rating_label',
        'probation_recommendation', 'probation_outcome', 'promotion_recommendation',
        'development_plan', 'evidence_links', 'sg_decision',
        'employee_acknowledged', 'employee_acknowledged_at',
        'submitted_at', 'finalized_at',
    ];

    protected function casts(): array
    {
        return [
            'probation_recommendation' => 'boolean',
            'promotion_recommendation' => 'boolean',
            'employee_acknowledged' => 'boolean',
            'employee_acknowledged_at' => 'datetime',
            'supervisor_reviewed_at' => 'datetime',
            'hod_reviewed_at' => 'datetime',
            'submitted_at' => 'datetime',
            'finalized_at' => 'datetime',
            'evidence_links' => 'array',
        ];
    }

    public function cycle(): BelongsTo
    {
        return $this->belongsTo(AppraisalCycle::class, 'cycle_id');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'employee_id');
    }

    public function supervisor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'supervisor_id');
    }

    public function hod(): BelongsTo
    {
        return $this->belongsTo(User::class, 'hod_id');
    }

    public function kras(): HasMany
    {
        return $this->hasMany(AppraisalKra::class, 'appraisal_id');
    }

    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable');
    }
}
