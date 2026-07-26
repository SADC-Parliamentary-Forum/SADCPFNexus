<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BudgetActualTransaction extends Model
{
    protected $fillable = [
        'tenant_id',
        'budget_line_id',
        'financial_year_id',
        'accounting_reference',
        'transaction_date',
        'posting_date',
        'amount',
        'currency',
        'base_currency_amount',
        'fx_rate',
        'vendor_payee',
        'description',
        'source_module',
        'source_id',
        'import_batch',
        'reconciliation_status',
        'posted_by',
    ];

    protected $casts = [
        'transaction_date' => 'date',
        'posting_date' => 'date',
        'amount' => 'float',
        'base_currency_amount' => 'float',
        'fx_rate' => 'float',
    ];

    public function budgetLine(): BelongsTo
    {
        return $this->belongsTo(BudgetLine::class);
    }

    public function financialYear(): BelongsTo
    {
        return $this->belongsTo(FinancialYear::class);
    }

    public function postedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'posted_by');
    }
}
