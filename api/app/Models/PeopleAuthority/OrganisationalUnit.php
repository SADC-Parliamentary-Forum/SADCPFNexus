<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class OrganisationalUnit extends Model
{
    use SoftDeletes;

    protected $table = 'organisational_units';

    protected $fillable = [
        'tenant_id',
        'code',
        'name',
        'unit_type',
        'parent_id',
        'department_id',
        'status',
        'effective_from',
        'effective_to',
        'created_by',
    ];

    protected $casts = [
        'effective_from' => 'date',
        'effective_to' => 'date',
    ];
}
