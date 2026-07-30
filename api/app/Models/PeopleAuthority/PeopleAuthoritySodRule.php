<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;

class PeopleAuthoritySodRule extends Model
{
    protected $table = 'people_authority_sod_rules';

    protected $fillable = [
        'tenant_id',
        'code',
        'left_role_or_perm',
        'right_role_or_perm',
        'rule_type',
        'is_active',
        'description',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];
}
