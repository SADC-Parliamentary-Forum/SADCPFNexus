<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;

class UserRoleAssignment extends Model
{
    protected $table = 'user_role_assignments';

    protected $fillable = [
        'tenant_id',
        'user_id',
        'person_id',
        'role_name',
        'scope_type',
        'scope_id',
        'is_privileged',
        'status',
        'effective_from',
        'effective_to',
        'requested_by',
        'approved_by',
        'approved_at',
        'revoked_by',
        'revoked_at',
        'reason',
    ];

    protected $casts = [
        'is_privileged' => 'boolean',
        'effective_from' => 'date',
        'effective_to' => 'date',
        'approved_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];
}
