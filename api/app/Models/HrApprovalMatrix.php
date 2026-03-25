<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HrApprovalMatrix extends Model
{
    protected $table = 'hr_approval_matrix';

    protected $fillable = [
        'tenant_id',
        'module',
        'action_name',
        'step_number',
        'role_id',
        'approver_user_id',
        'is_mandatory',
        'notes',
        'is_active',
    ];

    protected $casts = [
        'step_number'  => 'integer',
        'is_mandatory' => 'boolean',
        'is_active'    => 'boolean',
    ];

    public function role(): BelongsTo
    {
        return $this->belongsTo(\Spatie\Permission\Models\Role::class, 'role_id');
    }

    public function approverUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approver_user_id');
    }
}
