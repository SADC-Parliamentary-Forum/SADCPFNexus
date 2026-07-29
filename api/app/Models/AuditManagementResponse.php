<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditManagementResponse extends Model
{
    protected $fillable = [
        'tenant_id', 'finding_id', 'version', 'response_text', 'agrees',
        'disagreement_notes', 'responded_by', 'responded_at',
    ];

    protected $casts = [
        'agrees' => 'boolean',
        'responded_at' => 'datetime',
    ];
}
