<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;

class PeoplePrivilegeAlert extends Model
{
    protected $table = 'people_privilege_alerts';

    protected $fillable = [
        'tenant_id',
        'person_id',
        'user_id',
        'alert_type',
        'severity',
        'status',
        'details',
        'detected_by',
        'detected_at',
        'acknowledged_by',
        'acknowledged_at',
    ];

    protected $casts = [
        'details' => 'array',
        'detected_at' => 'datetime',
        'acknowledged_at' => 'datetime',
    ];
}
