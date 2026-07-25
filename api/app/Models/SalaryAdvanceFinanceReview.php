<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalaryAdvanceFinanceReview extends Model
{
    protected $fillable = [
        'salary_advance_request_id',
        'reviewed_by',
        'outcome',
        'salary_basis',
        'confirmed_net_salary',
        'confirmed_gross_salary',
        'max_eligible_amount',
        'recommended_amount',
        'intended_recovery_payroll_date',
        'eligible',
        'comments',
        'return_reason',
        'not_eligible_reason',
        'worksheet',
    ];

    protected function casts(): array
    {
        return [
            'confirmed_net_salary'           => 'float',
            'confirmed_gross_salary'         => 'float',
            'max_eligible_amount'            => 'float',
            'recommended_amount'             => 'float',
            'intended_recovery_payroll_date' => 'date',
            'eligible'                       => 'boolean',
            'worksheet'                      => 'array',
        ];
    }

    public function advance(): BelongsTo
    {
        return $this->belongsTo(SalaryAdvanceRequest::class, 'salary_advance_request_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
