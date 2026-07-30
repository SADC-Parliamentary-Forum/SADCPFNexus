<?php

namespace App\Models\WorkflowEngine;

use Illuminate\Database\Eloquent\Model;

class WorkflowIdempotencyKey extends Model
{
    protected $table = 'workflow_idempotency_keys';

    protected $fillable = [
        'tenant_id', 'scope', 'idempotency_key', 'result_type',
        'result_id', 'response_snapshot',
    ];

    protected $casts = [
        'response_snapshot' => 'array',
    ];
}
