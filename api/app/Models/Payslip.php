<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Payslip for a user. Supports staff types: local (tax-applicable), regional, researcher.
 * When present, details holds full template: header, earnings[], deductions[], company_contributions[], ytd_totals[], leave_balances[].
 */
class Payslip extends Model
{
    public const EMPLOYMENT_TYPE_LOCAL = 'local';
    public const EMPLOYMENT_TYPE_REGIONAL = 'regional';
    public const EMPLOYMENT_TYPE_RESEARCHER = 'researcher';

    protected $fillable = [
        'tenant_id',
        'user_id',
        'period_month',
        'period_year',
        'gross_amount',
        'net_amount',
        'currency',
        'employment_type',
        'period_end_date',
        'total_deductions',
        'total_company_contributions',
        'details',
        'file_path',
        'issued_at',
    ];

    protected function casts(): array
    {
        return [
            'gross_amount'                => 'decimal:2',
            'net_amount'                  => 'decimal:2',
            'total_deductions'            => 'decimal:2',
            'total_company_contributions' => 'decimal:2',
            'period_end_date'             => 'date',
            'details'                     => 'array',
            'issued_at'                   => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function getPeriodLabelAttribute(): string
    {
        $months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return ($months[$this->period_month] ?? $this->period_month) . ' ' . $this->period_year;
    }
}
