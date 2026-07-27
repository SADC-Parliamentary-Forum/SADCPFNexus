<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BudgetCycleDecision extends Model
{
    public const BODY_FSC = 'fsc';

    public const BODY_EXCO = 'exco';

    public const BODY_PLENARY = 'plenary';

    public const BODIES = [self::BODY_FSC, self::BODY_EXCO, self::BODY_PLENARY];

    public const DECISION_APPROVED = 'approved';

    public const DECISION_APPROVED_WITH_AMENDMENTS = 'approved_with_amendments';

    public const DECISION_DEFERRED = 'deferred';

    public const DECISION_REJECTED = 'rejected';

    public const DECISIONS = [
        self::DECISION_APPROVED,
        self::DECISION_APPROVED_WITH_AMENDMENTS,
        self::DECISION_DEFERRED,
        self::DECISION_REJECTED,
    ];

    protected $fillable = [
        'budget_cycle_id',
        'body',
        'meeting_on',
        'decision',
        'minute_reference',
        'comments',
        'attachment_path',
        'recorded_by',
        'recorded_at',
    ];

    protected $casts = [
        'meeting_on' => 'date',
        'recorded_at' => 'datetime',
    ];

    public function cycle(): BelongsTo
    {
        return $this->belongsTo(BudgetCycle::class, 'budget_cycle_id');
    }

    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function isApproved(): bool
    {
        return $this->decision === self::DECISION_APPROVED;
    }
}
