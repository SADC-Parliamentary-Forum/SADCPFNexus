<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;

class OrganisationalUnitVersion extends Model
{
    protected $table = 'organisational_unit_versions';

    protected $fillable = [
        'tenant_id',
        'organisational_unit_id',
        'version',
        'snapshot',
        'effective_from',
        'effective_to',
        'created_by',
    ];

    protected $casts = [
        'snapshot' => 'array',
        'effective_from' => 'date',
        'effective_to' => 'date',
    ];
}
