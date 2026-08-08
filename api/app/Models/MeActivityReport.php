<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class MeActivityReport extends Model
{
    use HasFactory, SoftDeletes;

    public const STATUS_NOT_SUBMITTED = 'not_submitted';
    public const STATUS_SUBMITTED     = 'submitted';
    public const STATUS_RETURNED      = 'returned';
    public const STATUS_REVIEWED      = 'reviewed';
    public const STATUS_ACCEPTED      = 'accepted';
    public const STATUS_CLOSED        = 'closed';
    public const STATUS_NOT_REPORTABLE = 'not_reportable';
    public const STATUS_CANCELLED      = 'cancelled';

    public const STATUSES = [
        self::STATUS_NOT_SUBMITTED,
        self::STATUS_SUBMITTED,
        self::STATUS_RETURNED,
        self::STATUS_REVIEWED,
        self::STATUS_ACCEPTED,
        self::STATUS_CLOSED,
        self::STATUS_NOT_REPORTABLE,
        self::STATUS_CANCELLED,
    ];

    protected $fillable = [
        'tenant_id', 'programme_id', 'non_pif_reason', 'reference_number', 'activity_title',
        'responsible_officer_id', 'thematic_area_id', 'strategic_goal_id',
        'start_date', 'end_date',
        'planned_output', 'actual_output', 'planned_participants', 'actual_participants',
        'narrative', 'challenges', 'lessons_learned', 'recommendations', 'follow_up_actions',
        'review_status', 'closure_status', 'review_notes',
        'return_section', 'return_required_action', 'correction_due_at',
        'not_reportable_reason', 'not_reportable_by', 'not_reportable_at',
        'cancelled_reason', 'archived_at', 'intake_confirmed_at', 'report_due_at',
        'programme_review_status', 'programme_reviewed_by', 'programme_reviewed_at', 'programme_review_notes',
        'created_by', 'submitted_by', 'submitted_at',
        'reviewed_by', 'reviewed_at', 'accepted_by', 'accepted_at',
        'closed_by', 'closed_at',
    ];

    protected $casts = [
        'start_date'           => 'date',
        'end_date'             => 'date',
        'submitted_at'         => 'datetime',
        'reviewed_at'          => 'datetime',
        'accepted_at'          => 'datetime',
        'closed_at'            => 'datetime',
        'correction_due_at'    => 'datetime',
        'not_reportable_at'    => 'datetime',
        'archived_at'          => 'datetime',
        'intake_confirmed_at'  => 'datetime',
        'report_due_at'        => 'datetime',
        'programme_reviewed_at'=> 'datetime',
        'planned_participants' => 'integer',
        'actual_participants'  => 'integer',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $report): void {
            if (empty($report->reference_number)) {
                $report->reference_number = 'MEAR-' . strtoupper(Str::random(8));
            }
        });
    }

    // ── Relationships ──────────────────────────────────────────────────────────

    public function programme(): BelongsTo
    {
        return $this->belongsTo(Programme::class, 'programme_id');
    }

    public function thematicArea(): BelongsTo
    {
        return $this->belongsTo(MeThematicArea::class, 'thematic_area_id');
    }

    public function strategicGoal(): BelongsTo
    {
        return $this->belongsTo(StrategicGoal::class, 'strategic_goal_id');
    }

    public function responsibleOfficer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responsible_officer_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function approvalRequest()
    {
        return $this->morphOne(\App\Models\ApprovalRequest::class, 'approvable');
    }

    public function onWorkflowApproved(User $approver): void
    {
        app(\App\Modules\MAndE\Services\MeReviewService::class)->accept($this, [], $approver);
    }

    public function onWorkflowReturned(User $approver, ?string $comment = null): void
    {
        app(\App\Modules\MAndE\Services\MeReviewService::class)
            ->requestCorrection($this, ['review_notes' => $comment ?: 'Returned for correction.'], $approver);
    }

    public function indicators(): BelongsToMany
    {
        return $this->belongsToMany(Indicator::class, 'me_activity_report_indicator')
            ->withPivot(['id', 'planned_value', 'actual_value', 'notes', 'tenant_id'])
            ->withTimestamps();
    }

    public function evidence(): HasMany
    {
        return $this->hasMany(MeEvidence::class, 'me_activity_report_id');
    }

    public function history(): HasMany
    {
        return $this->hasMany(MeReviewHistory::class, 'me_activity_report_id');
    }

    public function followUps(): HasMany
    {
        return $this->hasMany(MeFollowUpAction::class, 'me_activity_report_id');
    }

    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable');
    }

    // ── Status helpers ──────────────────────────────────────────────────────────

    public function isEditable(): bool
    {
        return in_array($this->review_status, [self::STATUS_NOT_SUBMITTED, self::STATUS_RETURNED], true);
    }

    public function isClosed(): bool
    {
        return $this->review_status === self::STATUS_CLOSED || $this->closure_status === 'closed';
    }
}
