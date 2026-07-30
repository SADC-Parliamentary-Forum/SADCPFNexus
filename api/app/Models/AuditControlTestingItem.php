<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditControlTestingItem extends Model
{
    protected $fillable = [
        'tenant_id', 'campaign_id', 'finding_id', 'control_ref', 'control_title',
        'status', 'due_date', 'result_notes', 'tested_by', 'tested_at',
    ];

    protected $casts = [
        'due_date' => 'date',
        'tested_at' => 'datetime',
    ];
}
