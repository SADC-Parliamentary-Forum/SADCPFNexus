<?php

namespace App\Models;

use App\Models\WorkflowEngine\WorkflowDefinitionVersion;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ApprovalWorkflow extends Model
{
    use SoftDeletes;

    public const SELF_APPROVAL_DENIED = 'denied';
    public const SELF_APPROVAL_ALLOW_WITH_CONTROLS = 'allow_with_controls';
    public const SELF_APPROVAL_REQUIRE_EXTERNAL_APPROVER = 'require_external_approver';

    protected $fillable = [
        'tenant_id', 'name', 'module_type', 'record_type', 'is_active',
        'definition_status', 'business_owner_id', 'current_version',
        'policy_reference', 'target_type', 'target_id', 'self_approval_policy',
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
