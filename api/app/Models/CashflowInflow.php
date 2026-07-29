<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CashflowInflow extends Model
{
    public const SOURCE_TYPES = ['membership', 'donor', 'other'];

    public const STATUSES = ['planned', 'confirmed', 'received', 'cancelled'];

    protected $fillable = [
        'tenant_id',
        'financial_year_id',
        'source_type',
        'label',
        'counterparty_name',
        'period',
        'amount',
        'currency',
        'status',
        'funding_source_id',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'amount' => 'float',
    ];

    public function financialYear(): BelongsTo
    {
        return $this->belongsTo(FinancialYear::class);
    }

    public function fundingSource(): BelongsTo
    {
        return $this->belongsTo(FundingSource::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isActiveForForecast(): bool
    {
        return in_array($this->status, ['planned', 'confirmed', 'received'], true);
    }
}
