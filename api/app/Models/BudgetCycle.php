<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class BudgetCycle extends Model
{
    public const STATUS_NOT_OPEN = 'not_open';

    public const STATUS_PLANNING = 'planning';

    public const STATUS_DEPARTMENT_PREPARATION = 'department_preparation';

    public const STATUS_SUBMITTED_TO_FINANCE = 'submitted_to_finance';

    public const STATUS_FINANCE_REVIEW = 'finance_review';

    public const STATUS_MANAGEMENT_REVIEW = 'management_review';

    public const STATUS_SG_APPROVED = 'sg_approved';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_CLOSED = 'closed';

    public const ADVANCE_MAP = [
        self::STATUS_NOT_OPEN => self::STATUS_PLANNING,
        self::STATUS_PLANNING => self::STATUS_DEPARTMENT_PREPARATION,
        self::STATUS_DEPARTMENT_PREPARATION => self::STATUS_SUBMITTED_TO_FINANCE,
        self::STATUS_SUBMITTED_TO_FINANCE => self::STATUS_FINANCE_REVIEW,
        self::STATUS_FINANCE_REVIEW => self::STATUS_MANAGEMENT_REVIEW,
        self::STATUS_MANAGEMENT_REVIEW => self::STATUS_SG_APPROVED,
    ];

    protected $fillable = [
        'tenant_id',
        'financial_year_id',
        'status',
        'opened_by',
        'opened_at',
        'locked_by',
        'locked_at',
        'sg_approved_by',
        'sg_approved_at',
        'approved_total',
        'notes',
    ];

    protected $casts = [
        'opened_at' => 'datetime',
        'locked_at' => 'datetime',
        'sg_approved_at' => 'datetime',
        'approved_total' => 'float',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function financialYear(): BelongsTo
    {
        return $this->belongsTo(FinancialYear::class);
    }

    public function guideline(): HasOne
    {
        return $this->hasOne(BudgetGuideline::class);
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(BudgetSubmission::class);
    }

    public function approvals(): HasMany
    {
        return $this->hasMany(BudgetCycleApproval::class);
    }

    public function openedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'opened_by');
    }

    public function lockedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'locked_by');
    }

    public function isLocked(): bool
    {
        return $this->status === self::STATUS_ACTIVE || $this->locked_at !== null;
    }

    public function allowsDepartmentEdits(): bool
    {
        return in_array($this->status, [
            self::STATUS_PLANNING,
            self::STATUS_DEPARTMENT_PREPARATION,
        ], true);
    }
}
