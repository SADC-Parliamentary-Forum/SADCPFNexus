<?php

namespace App\Models\AccessControl;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserPermissionGrant extends Model
{
    protected $table = 'user_permission_grants';

    protected $fillable = [
        'tenant_id',
        'user_id',
        'permission_key',
        'scope_type',
        'scope_reference',
        'valid_from',
        'valid_until',
        'status',
        'reason',
        'granted_by',
        'approved_by',
    ];

    protected $casts = [
        'valid_from' => 'datetime',
        'valid_until' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
