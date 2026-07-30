<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;

class AuthorityDefinition extends Model
{
    protected $table = 'authority_definitions';

    protected $fillable = [
        'tenant_id',
        'code',
        'name',
        'module',
        'action',
        'description',
        'is_signing',
        'is_contract_signing',
        'allows_acting',
        'allows_delegation',
        'is_active',
    ];

    protected $casts = [
        'is_signing' => 'boolean',
        'is_contract_signing' => 'boolean',
        'allows_acting' => 'boolean',
        'allows_delegation' => 'boolean',
        'is_active' => 'boolean',
    ];
}
