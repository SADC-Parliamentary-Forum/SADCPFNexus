<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CashflowScenario extends Model
{
    public const KINDS = ['base', 'optimistic', 'pessimistic', 'custom'];

    public const STATUSES = ['draft', 'active', 'archived'];

    protected $fillable = [
        'tenant_id',
        'financial_year_id',
        'name',
        'kind',
        'opening_balance',
        'currency',
        'status',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'opening_balance' => 'float',
    ];

    public function financialYear(): BelongsTo
    {
        return $this->belongsTo(FinancialYear::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function adjustments(): HasMany
    {
        return $this->hasMany(CashflowScenarioAdjustment::class);
    }
}
