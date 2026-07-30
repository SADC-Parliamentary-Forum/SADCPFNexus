<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;

class ActingAppointment extends Model
{
    protected $table = 'acting_appointments';

    protected $fillable = [
        'tenant_id',
        'reference',
        'position_id',
        'person_id',
        'substantive_person_id',
        'is_acting_sg',
        'grants_allowance',
        'start_at',
        'end_at',
        'status',
        'reason',
        'requested_by',
        'approved_by',
        'approved_at',
    ];

    protected $casts = [
        'is_acting_sg' => 'boolean',
        'grants_allowance' => 'boolean',
        'start_at' => 'date',
        'end_at' => 'date',
        'approved_at' => 'datetime',
    ];
}
