<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LeavePolicyVersion extends Model
{
    protected $fillable = [
        'tenant_id',
        'name',
        'version',
        'effective_from',
        'effective_to',
        'rules',
        'is_active',
        'approved_by',
    ];

    protected $casts = [
        'effective_from' => 'date',
        'effective_to' => 'date',
        'rules' => 'array',
        'is_active' => 'boolean',
    ];

    public function types(): HasMany
    {
        return $this->hasMany(LeaveType::class, 'policy_version_id');
    }
}
