<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;

class AuthoritySnapshot extends Model
{
    protected $table = 'authority_snapshots';

    protected $fillable = [
        'tenant_id',
        'context_type',
        'context_id',
        'user_id',
        'person_id',
        'position_id',
        'authority_assignment_id',
        'delegation_id',
        'acting_appointment_id',
        'snapshot',
        'captured_at',
    ];

    protected $casts = [
        'snapshot' => 'array',
        'captured_at' => 'datetime',
    ];
}
