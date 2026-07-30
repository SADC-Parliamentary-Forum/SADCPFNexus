<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;

class IdentityDelegationScope extends Model
{
    protected $table = 'identity_delegation_scopes';

    protected $fillable = [
        'tenant_id',
        'identity_delegation_id',
        'module',
        'action',
        'authority_definition_id',
        'value_limit',
        'currency',
        'constraints',
    ];

    protected $casts = [
        'value_limit' => 'decimal:2',
        'constraints' => 'array',
    ];
}
