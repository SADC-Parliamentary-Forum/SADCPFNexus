<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Assignment extends Model
{
    use HasFactory, SoftDeletes;

    public const SOURCE_ALLOW_LIST = [
        'manual',
        'correspondence',
        'pif',
        'meeting_minutes',
        'meeting_action_item',
        'meeting_decision',
        'meeting_decision_action',
        'programme',
        'me_recommendation',
        'procurement',
        'travel',
        'risk',
        'audit_finding',
        'weekly_summary',
        'management_instruction',
        'lifecycle',
    ];

    public const BLOCKER_TYPES = [
        'awaiting_approval',
        'awaiting_funds',
        'awaiting_information',
        'external_dependency',
        'waiting_for_approval',
        'waiting_for_information',
        'waiting_for_external_party',
        'resource_constraint',
        'budget',
        'procurement',
        'travel',
        'technical',
        'legal',
        'management_decision',
        'staff_availability',
        'other',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $model) {
            if (empty($model->reference_number)) {
                $model->reference_number = 'ASN/' . now()->format('Y') . '/' . str_pad((string) random_int(1, 99999), 5, '0', STR_PAD_LEFT);
            }
            if (empty($model->source_type)) {
                $model->source_type = 'manual';
            }
        });
    }

    protected $fillable = [
        'tenant_id',
        'parent_id',
        'reference_number',
        'title',
        'description',
        'objective',
        'expected_output',
        'acceptance_criteria',
        'evidence_required',
        'completion_instructions',
        'type',
        'is_template',
        'template_id',
        'recurrence_rule',
        'recurrence_next_run_at',
        'priority',
        'status',
        'created_by',
        'assigned_to',
        'department_id',
        'department_claim_due_at',
        'claimed_at',
        'due_date',
        'estimated_hours',
        'start_date',
        'checkin_frequency',
        'linked_programme_id',
        'linked_event_id',
        'meeting_minutes_id',
        'source_type',
        'source_id',
        'source_reference',
        'google_calendar_event_id',
        'google_calendar_etag',
        'google_calendar_synced_at',
        'source_title',
        'source_purpose',
        'is_confidential',
        'review_required',
        'reviewer_id',
        'review_status',
        'verified_at',
        'verified_by',
        'verification_notes',
        'progress_percent',
        'escalation_level',
        'last_reminded_at',
        'last_escalated_at',
        'acted_via_delegation_id',
        'acceptance_decision',
        'acceptance_notes',
        'proposed_deadline',
        'accepted_at',
        'blocker_type',
        'blocker_details',
        'blocker_owner_id',
        'blocker_expected_resolution_at',
        'closure_notes',
        'rejection_reason',
        'issued_at',
        'closed_at',
        'has_performance_note',
        'completion_rating',
    ];

    protected $appends = ['deadline_state', 'is_overdue_flag'];

    protected function casts(): array
    {
        return [
            'due_date' => 'date',
            'start_date' => 'date',
            'proposed_deadline' => 'date',
            'accepted_at' => 'datetime',
            'issued_at' => 'datetime',
            'closed_at' => 'datetime',
            'verified_at' => 'datetime',
            'department_claim_due_at' => 'datetime',
            'claimed_at' => 'datetime',
            'blocker_expected_resolution_at' => 'datetime',
            'recurrence_next_run_at' => 'datetime',
            'last_reminded_at' => 'datetime',
            'last_escalated_at' => 'datetime',
            'google_calendar_synced_at' => 'datetime',
            'is_confidential' => 'boolean',
            'review_required' => 'boolean',
            'evidence_required' => 'boolean',
            'is_template' => 'boolean',
            'has_performance_note' => 'boolean',
            'progress_percent' => 'integer',
            'completion_rating' => 'integer',
            'escalation_level' => 'integer',
            'recurrence_rule' => 'array',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    /** Alias: Primary Assignee === assigned_to */
    public function primaryAssignee(): BelongsTo
    {
        return $this->assignee();
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }

    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function blockerOwner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'blocker_owner_id');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(self::class, 'template_id');
    }

    public function subtasks(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    public function instances(): HasMany
    {
        return $this->hasMany(self::class, 'template_id');
    }

    public function updates(): HasMany
    {
        return $this->hasMany(AssignmentUpdate::class)->orderByDesc('created_at');
    }

    public function participants(): HasMany
    {
        return $this->hasMany(AssignmentParticipant::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(AssignmentEvent::class)->orderByDesc('created_at');
    }

    public function checklistItems(): HasMany
    {
        return $this->hasMany(AssignmentChecklistItem::class)->orderBy('sequence');
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(AssignmentReview::class)->orderByDesc('reviewed_at');
    }

    public function reminders(): HasMany
    {
        return $this->hasMany(AssignmentReminder::class);
    }

    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable');
    }

    public function isDraft(): bool
    {
        return $this->status === 'draft';
    }

    public function isIssued(): bool
    {
        return $this->status === 'issued';
    }

    public function isAwaitingAcceptance(): bool
    {
        return $this->status === 'awaiting_acceptance';
    }

    public function isAccepted(): bool
    {
        return $this->status === 'accepted';
    }

    public function isActive(): bool
    {
        return in_array($this->status, ['active', 'at_risk', 'blocked', 'delayed', 'returned'], true);
    }

    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }

    public function isClosed(): bool
    {
        return $this->status === 'closed';
    }

    public function isCancelled(): bool
    {
        return $this->status === 'cancelled';
    }

    public function isVerified(): bool
    {
        return $this->verified_at !== null || ($this->isClosed() && $this->review_status === 'accepted');
    }

    public function isOverdue(): bool
    {
        return ! $this->isClosed()
            && ! $this->isCancelled()
            && ! $this->isCompleted()
            && $this->due_date
            && $this->due_date->isPast();
    }

    public function getIsOverdueFlagAttribute(): bool
    {
        return $this->isOverdue();
    }

    public function getDeadlineStateAttribute(): string
    {
        if (! $this->due_date) {
            return 'none';
        }

        if ($this->isCancelled()) {
            return 'cancelled_before_due';
        }

        if ($this->isClosed() || $this->isCompleted()) {
            $doneAt = $this->closed_at ?? $this->verified_at ?? now();

            return $doneAt->toDateString() <= $this->due_date->toDateString()
                ? 'completed_on_time'
                : 'completed_late';
        }

        $today = now()->startOfDay();
        $due = $this->due_date->copy()->startOfDay();

        if ($due->lt($today)) {
            return 'overdue';
        }
        if ($due->equalTo($today)) {
            return 'due_today';
        }
        if ($due->lte($today->copy()->addDays(3))) {
            return 'due_soon';
        }

        return 'future';
    }

    public function assertEditable(): void
    {
        if ($this->isVerified() || ($this->isClosed() && $this->review_required)) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'status' => 'Verified assignments must not be silently edited.',
            ]);
        }
    }
}
