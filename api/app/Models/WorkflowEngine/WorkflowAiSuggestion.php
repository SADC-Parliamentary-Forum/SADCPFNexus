<?php

namespace App\Models\WorkflowEngine;

use Illuminate\Database\Eloquent\Model;

class WorkflowAiSuggestion extends Model
{
    protected $table = 'workflow_ai_suggestions';

    protected $fillable = [
        'tenant_id', 'kind', 'provider', 'status', 'auto_applied',
        'input_context', 'suggestion', 'applied_action', 'apply_note',
        'definition_version_id', 'created_by', 'applied_by', 'applied_at',
    ];

    protected $casts = [
        'input_context' => 'array',
        'suggestion' => 'array',
        'auto_applied' => 'boolean',
        'applied_at' => 'datetime',
    ];
}
