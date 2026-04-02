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

    protected static function booted(): void
    {
        static::creating(function (self $model) {
            if (empty($model->reference_number)) {
                $model->reference_number = 'ASN-' . strtoupper(Str::random(8));
            }
        });
    }

    protected $fillable = [
        'tenant_id',
        'reference_number',
        'title',
        'description',
        'objective',
        'expected_output',
        'type',
        'priority',
        'status',
        'created_by',
        'assigned_to',
        'department_id',
        'due_date',
        'start_date',
        'checkin_frequency',
        'linked_programme_id',
        'linked_event_id',
        'meeting_minutes_id',
        'is_confidential',
        'progress_percent',
        'acceptance_decision',
        'acceptance_notes',
        'proposed_deadline',
        'accepted_at',
        'blocker_type',
        'blocker_details',
        'closure_notes',
        'rejection_reason',
        'issued_at',
        'closed_at',
        'has_performance_note',
        'completion_rating',
    ];

    protected function casts(): array
    {
        return [
            'due_date'           => 'date',
            'start_date'         => 'date',
            'proposed_deadline'  => 'date',
            'accepted_at'        => 'datetime',
            'issued_at'          => 'datetime',
            'closed_at'          => 'datetime',
            'is_confidential'    => 'boolean',
            'has_performance_note' => 'boolean',
            'progress_percent'   => 'integer',
            'completion_rating'  => 'integer',
        ];
    }

    // ── Relationships ──────────────────────────────────────────────────────────

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function updates(): HasMany
    {
        return $this->hasMany(AssignmentUpdate::class)->orderByDesc('created_at');
    }

    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable');
    }

    // ── Status helpers ─────────────────────────────────────────────────────────

    public function isDraft(): bool           { return $this->status === 'draft'; }
    public function isIssued(): bool          { return $this->status === 'issued'; }
    public function isAwaitingAcceptance(): bool { return $this->status === 'awaiting_acceptance'; }
    public function isAccepted(): bool        { return $this->status === 'accepted'; }
    public function isActive(): bool          { return \in_array($this->status, ['active', 'at_risk', 'blocked', 'delayed'], true); }
    public function isCompleted(): bool       { return $this->status === 'completed'; }
    public function isClosed(): bool          { return $this->status === 'closed'; }
    public function isCancelled(): bool       { return $this->status === 'cancelled'; }

    public function isOverdue(): bool
    {
        return !$this->isClosed() && !$this->isCancelled() && $this->due_date && $this->due_date->isPast();
    }
}
