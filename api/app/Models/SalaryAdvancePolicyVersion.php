<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalaryAdvancePolicyVersion extends Model
{
    protected $fillable = [
        'tenant_id',
        'version',
        'effective_from',
        'effective_to',
        'max_salary_percentage',
        'salary_basis',
        'max_concurrent_advances',
        'full_repayment_required',
        'recovery_rule',
        'final_approver_role',
        'finance_certification_required',
        'admin_review_required',
        'configuration',
        'approved_by',
        'active',
    ];

    protected function casts(): array
    {
        return [
            'effective_from'                 => 'date',
            'effective_to'                   => 'date',
            'max_salary_percentage'          => 'float',
            'full_repayment_required'        => 'boolean',
            'finance_certification_required' => 'boolean',
            'admin_review_required'          => 'boolean',
            'active'                         => 'boolean',
            'configuration'                  => 'array',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function approvedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public static function activeFor(?int $tenantId = null): ?self
    {
        return static::query()
            ->where('active', true)
            ->where(function ($q) use ($tenantId) {
                $q->whereNull('tenant_id');
                if ($tenantId) {
                    $q->orWhere('tenant_id', $tenantId);
                }
            })
            ->orderByRaw('tenant_id IS NULL ASC')
            ->first();
    }
}
