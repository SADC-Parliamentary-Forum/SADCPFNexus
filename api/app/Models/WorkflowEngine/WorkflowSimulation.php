<?php

namespace App\Models\WorkflowEngine;

use Illuminate\Database\Eloquent\Model;

class WorkflowSimulation extends Model
{
    protected $table = 'workflow_simulations';

    protected $fillable = [
        'tenant_id', 'workflow_definition_id', 'definition_version_id',
        'test_context', 'result', 'created_production_approval',
        'simulated_by', 'simulated_at',
    ];

    protected $casts = [
        'test_context' => 'array',
        'result' => 'array',
        'created_production_approval' => 'boolean',
        'simulated_at' => 'datetime',
    ];
}
