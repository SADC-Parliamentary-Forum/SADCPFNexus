<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Risk extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id', 'risk_code', 'title', 'description', 'category',
        'department_id', 'risk_owner_id', 'action_owner_id', 'submitted_by',
        'likelihood', 'impact', 'inherent_score',
        'residual_likelihood', 'residual_impact', 'residual_score',
        'control_effectiveness', 'risk_level', 'status', 'escalation_level',
        'review_frequency', 'next_review_date', 'review_notes', 'closure_evidence',
        'reviewed_by', 'reviewed_at',
        'approved_by', 'approved_at',
        'closed_by', 'closed_at',
        'submitted_at',
    ];

    protected $casts = [
        'likelihood'           => 'integer',
        'impact'               => 'integer',
        'inherent_score'       => 'integer',
        'residual_likelihood'  => 'integer',
        'residual_impact'      => 'integer',
        'residual_score'       => 'integer',
        'reviewed_at'          => 'datetime',
        'approved_at'          => 'datetime',
        'closed_at'            => 'datetime',
        'submitted_at'         => 'datetime',
        'next_review_date'     => 'date',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $risk): void {
            if (empty($risk->risk_code)) {
                $risk->risk_code = 'RSK-' . strtoupper(Str::random(8));
            }
            $risk->inherent_score = $risk->likelihood * $risk->impact;
            $risk->risk_level     = static::computeRiskLevel($risk->inherent_score);
        });

        static::updating(function (self $risk): void {
            if ($risk->isDirty('likelihood') || $risk->isDirty('impact')) {
                $risk->inherent_score = $risk->likelihood * $risk->impact;
                $risk->risk_level     = static::computeRiskLevel($risk->inherent_score);
            }
        });
    }

    public static function computeRiskLevel(int $score): string
    {
        return match (true) {
            $score >= 16 => 'critical',
            $score >= 11 => 'high',
            $score >= 6  => 'medium',
            default      => 'low',
        };
    }

    // ── Relationships ─────────────────────────────────────────────────────────

    public function submitter()   { return $this->belongsTo(User::class, 'submitted_by'); }
    public function riskOwner()   { return $this->belongsTo(User::class, 'risk_owner_id'); }
    public function actionOwner() { return $this->belongsTo(User::class, 'action_owner_id'); }
    public function reviewer()    { return $this->belongsTo(User::class, 'reviewed_by'); }
    public function approver()    { return $this->belongsTo(User::class, 'approved_by'); }
    public function closer()      { return $this->belongsTo(User::class, 'closed_by'); }
    public function department()  { return $this->belongsTo(Department::class); }
    public function actions()     { return $this->hasMany(RiskAction::class); }
    public function history()     { return $this->hasMany(RiskHistory::class); }

    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable');
    }

    public function policies(): BelongsToMany
    {
        return $this->belongsToMany(Policy::class, 'risk_policy')
                    ->withPivot('notes', 'linked_by')
                    ->withTimestamps(false)
                    ->orderBy('policies.title');
    }

    // ── Status helpers ────────────────────────────────────────────────────────

    public function isDraft(): bool      { return $this->status === 'draft'; }
    public function isSubmitted(): bool  { return $this->status === 'submitted'; }
    public function isReviewed(): bool   { return $this->status === 'reviewed'; }
    public function isApproved(): bool   { return $this->status === 'approved'; }
    public function isMonitoring(): bool { return $this->status === 'monitoring'; }
    public function isEscalated(): bool  { return $this->status === 'escalated'; }
    public function isClosed(): bool     { return $this->status === 'closed'; }
    public function isArchived(): bool   { return $this->status === 'archived'; }

    public function isEditable(): bool
    {
        return $this->isDraft();
    }
}
