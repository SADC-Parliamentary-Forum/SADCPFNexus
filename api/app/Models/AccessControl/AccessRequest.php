<?php

namespace App\Models\AccessControl;

use Illuminate\Database\Eloquent\Model;

class AccessRequest extends Model
{
    protected $table = 'access_permission_requests';

    protected $fillable = [
        'tenant_id',
        'requester_id',
        'permission_key',
        'role_catalogue_key',
        'scope_type',
        'scope_reference',
        'business_reason',
        'sensitivity',
        'valid_from',
        'valid_until',
        'status',
        'supervisor_id',
        'supervisor_decision',
        'supervisor_decided_at',
        'approver_id',
        'approver_decision',
        'approver_decided_at',
        'sod_result',
    ];

    protected $casts = [
        'valid_from' => 'datetime',
        'valid_until' => 'datetime',
        'supervisor_decided_at' => 'datetime',
        'approver_decided_at' => 'datetime',
        'sod_result' => 'array',
    ];
}
