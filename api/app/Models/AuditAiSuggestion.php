<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditAiSuggestion extends Model
{
    protected $fillable = [
        'tenant_id', 'engagement_id', 'kind', 'provider', 'status', 'auto_applied',
        'input_context', 'suggestion', 'applied_action', 'application_note',
        'created_by', 'confirmed_by', 'confirmed_at',
    ];

    protected $casts = [
        'input_context' => 'array',
        'suggestion' => 'array',
        'auto_applied' => 'boolean',
        'confirmed_at' => 'datetime',
    ];
}
