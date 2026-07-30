<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;

class IdentityDelegation extends Model
{
    protected $table = 'identity_delegations';

    protected $fillable = [
        'tenant_id',
        'reference',
        'principal_person_id',
        'delegate_person_id',
        'principal_user_id',
        'delegate_user_id',
        'delegation_type',
        'start_at',
        'end_at',
        'reason',
        'authority_source',
        'allows_transitive',
        'allows_contract_signing',
        'creates_acting_allowance',
        'status',
        'approved_by',
        'approved_at',
        'activated_at',
        'revoked_at',
        'revoked_by',
        'revocation_reason',
        'created_by',
        'legacy_delegated_authority_id',
    ];

    protected $casts = [
        'start_at' => 'datetime',
        'end_at' => 'datetime',
        'allows_transitive' => 'boolean',
        'allows_contract_signing' => 'boolean',
        'creates_acting_allowance' => 'boolean',
        'approved_at' => 'datetime',
        'activated_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];
}
