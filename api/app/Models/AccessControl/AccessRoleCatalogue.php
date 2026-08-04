<?php

namespace App\Models\AccessControl;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccessRoleCatalogue extends Model
{
    protected $table = 'access_role_catalogues';

    protected $fillable = [
        'tenant_id',
        'key',
        'name',
        'purpose',
        'owner_user_id',
        'risk_level',
        'status',
        'default_scopes',
        'feature_only',
        'read_only',
        'no_business_approve',
        'review_due_at',
        'meta',
    ];

    protected $casts = [
        'default_scopes' => 'array',
        'feature_only' => 'boolean',
        'read_only' => 'boolean',
        'no_business_approve' => 'boolean',
        'review_due_at' => 'datetime',
        'meta' => 'array',
    ];

    public function versions()
    {
        return $this->hasMany(AccessRoleVersion::class, 'role_catalogue_id');
    }

    public function currentVersion()
    {
        return $this->hasOne(AccessRoleVersion::class, 'role_catalogue_id')
            ->where('status', 'active')
            ->orderByDesc('version');
    }

    public function latestVersion()
    {
        return $this->hasOne(AccessRoleVersion::class, 'role_catalogue_id')
            ->latestOfMany('version');
    }
}
