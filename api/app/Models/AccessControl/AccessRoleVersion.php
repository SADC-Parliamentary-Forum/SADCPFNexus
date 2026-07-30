<?php

namespace App\Models\AccessControl;

use Illuminate\Database\Eloquent\Model;

class AccessRoleVersion extends Model
{
    protected $table = 'access_role_versions';

    protected $fillable = [
        'role_catalogue_id',
        'version',
        'status',
        'permissions',
        'changelog',
        'published_by',
        'published_at',
        'approved_by',
        'approved_at',
    ];

    protected $casts = [
        'permissions' => 'array',
        'published_at' => 'datetime',
        'approved_at' => 'datetime',
    ];

    public function catalogue()
    {
        return $this->belongsTo(AccessRoleCatalogue::class, 'role_catalogue_id');
    }
}
