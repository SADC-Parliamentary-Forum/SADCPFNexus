<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class HrLeaveProfile extends Model
{
    use SoftDeletes;

    protected $table = 'hr_leave_profiles';

    protected $fillable = [
        'tenant_id',
        'profile_code',
        'profile_name',
        'annual_leave_days',
        'sick_leave_days',
        'lil_days',
        'special_leave_days',
        'maternity_days',
        'paternity_days',
        'is_active',
    ];

    protected $casts = [
        'annual_leave_days'  => 'decimal:1',
        'sick_leave_days'    => 'decimal:1',
        'lil_days'           => 'decimal:1',
        'special_leave_days' => 'decimal:1',
        'maternity_days'     => 'integer',
        'paternity_days'     => 'integer',
        'is_active'          => 'boolean',
    ];

    public function gradeBands(): HasMany
    {
        return $this->hasMany(HrGradeBand::class, 'leave_profile_id');
    }
}
