<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ApprovalWorkflow extends Model
{
    use SoftDeletes;

    protected $fillable = ['tenant_id', 'name', 'module_type', 'is_active'];

    public function steps(): HasMany
    {
        return $this->hasMany(ApprovalStep::class, 'workflow_id')->orderBy('step_order');
    }
}
