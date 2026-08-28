<?php

namespace App\Models\AccessControl;

use Illuminate\Database\Eloquent\Model;

class AccessRoleSyncRequest extends Model
{
    protected $fillable = [
        'tenant_id', 'user_id', 'roles', 'requested_by', 'approved_by', 'status', 'reason',
    ];

    protected function casts(): array
    {
        return ['roles' => 'array'];
    }
}
