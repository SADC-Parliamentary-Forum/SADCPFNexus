<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class AuditUniverseEntity extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'tenant_id', 'name', 'entity_type', 'department_id', 'owner_name', 'owner_user_id',
        'description', 'risk_profile', 'inherent_risk_score', 'last_audited_at', 'status',
        'confidentiality_level', 'metadata', 'created_by',
    ];

    protected $casts = [
        'metadata' => 'array',
        'last_audited_at' => 'date',
    ];
}
