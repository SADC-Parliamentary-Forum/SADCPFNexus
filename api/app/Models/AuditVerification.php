<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditVerification extends Model
{
    protected $fillable = [
        'tenant_id', 'corrective_action_id', 'finding_id', 'outcome', 'notes',
        'verified_by', 'verified_at',
    ];

    protected $casts = ['verified_at' => 'datetime'];
}
