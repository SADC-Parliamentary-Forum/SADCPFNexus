<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class HrAllowanceProfile extends Model
{
    use SoftDeletes;

    protected $table = 'hr_allowance_profiles';

    protected $fillable = [
        'tenant_id',
        'profile_code',
        'profile_name',
        'currency',
        'transport_allowance',
        'housing_allowance',
        'communication_allowance',
        'medical_allowance',
        'subsistence_allowance',
        'notes',
        'is_active',
    ];

    protected $casts = [
        'transport_allowance'      => 'decimal:2',
        'housing_allowance'        => 'decimal:2',
        'communication_allowance'  => 'decimal:2',
        'medical_allowance'        => 'decimal:2',
        'subsistence_allowance'    => 'decimal:2',
        'is_active'                => 'boolean',
    ];

    public function gradeBands(): HasMany
    {
        return $this->hasMany(HrGradeBand::class, 'allowance_profile_id');
    }
}
