<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BudgetChangeRequest extends Model
{
    public const TYPE_TRANSFER = 'transfer';

    public const TYPE_REVISION = 'revision';

    public const TYPE_SUPPLEMENTARY = 'supplementary';

    public const TYPE_CONTINGENCY = 'contingency';

    public const TYPES = [
        self::TYPE_TRANSFER,
        self::TYPE_REVISION,
        self::TYPE_SUPPLEMENTARY,
        self::TYPE_CONTINGENCY,
    ];

    public const STATUS_DRAFT = 'draft';

    public const STATUS_PENDING_FINANCE = 'pending_finance';

    public const STATUS_PENDING_SG = 'pending_sg';

    public const STATUS_APPROVED = 'approved';

    public const STATUS_APPLIED = 'applied';

    public const STATUS_RETURNED = 'returned';

    public const STATUS_REJECTED = 'rejected';

    protected $fillable = [
        'tenant_id',
        'financial_year_id',
        'budget_id',
        'type',
        'title',
        'status',
        'justification',
        'requires_sg',
        'prepared_by',
        'submitted_at',
        'finance_decided_by',
        'finance_decided_at',
        'finance_comments',
        'sg_decided_by',
        'sg_decided_at',
        'sg_comments',
        'applied_by',
        'applied_at',
        'rejected_reason',
    ];

    protected $casts = [
        'requires_sg' => 'boolean',
        'submitted_at' => 'datetime',
        'finance_decided_at' => 'datetime',
        'sg_decided_at' => 'datetime',
        'applied_at' => 'datetime',
    ];

    public function budget(): BelongsTo
    {
        return $this->belongsTo(Budget::class);
    }

    public function financialYear(): BelongsTo
    {
        return $this->belongsTo(FinancialYear::class);
    }

    public function preparer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'prepared_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(BudgetChangeItem::class)->orderBy('sort_order');
    }
}
