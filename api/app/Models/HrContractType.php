<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class HrContractType extends Model
{
    use SoftDeletes;

    protected $table = 'hr_contract_types';

    protected $fillable = [
        'tenant_id',
        'code',
        'name',
        'description',
        'is_permanent',
        'has_probation',
        'probation_months',
        'notice_period_days',
        'is_renewable',
        'is_active',
    ];

    protected $casts = [
        'is_permanent'     => 'boolean',
        'has_probation'    => 'boolean',
        'is_renewable'     => 'boolean',
        'is_active'        => 'boolean',
        'probation_months' => 'integer',
        'notice_period_days' => 'integer',
    ];

    public function gradeBands(): HasMany
    {
        return $this->hasMany(HrGradeBand::class, 'contract_type_id');
    }
}
