<?php

namespace App\Models\AccessControl;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccessRoleAssignment extends Model
{
    protected $table = 'access_role_assignments';

    protected $fillable = [
        'tenant_id',
        'user_id',
        'role_version_id',
        'assignment_type',
        'scope_type',
        'scope_reference',
        'valid_from',
        'valid_until',
        'status',
        'reason',
        'requested_by',
        'approved_by',
        'revoked_by',
        'revoked_at',
        'review_due_at',
    ];

    protected $casts = [
        'valid_from' => 'datetime',
        'valid_until' => 'datetime',
        'revoked_at' => 'datetime',
        'review_due_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function roleVersion(): BelongsTo
    {
        return $this->belongsTo(AccessRoleVersion::class, 'role_version_id');
    }
}
