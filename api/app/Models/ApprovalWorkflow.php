<?php

namespace App\Models;

use App\Models\WorkflowEngine\WorkflowDefinitionVersion;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ApprovalWorkflow extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'tenant_id', 'name', 'module_type', 'record_type', 'is_active',
        'definition_status', 'business_owner_id', 'current_version',
        'policy_reference', 'target_type', 'target_id',
    ];

    public function steps(): HasMany
    {
        return $this->hasMany(ApprovalStep::class, 'workflow_id')->orderBy('step_order');
    }

    public function versions(): HasMany
    {
        return $this->hasMany(WorkflowDefinitionVersion::class, 'workflow_definition_id');
    }
}
