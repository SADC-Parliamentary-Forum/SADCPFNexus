<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class PeopleOrgScenario extends Model
{
    use SoftDeletes;

    protected $table = 'people_org_scenarios';

    protected $fillable = [
        'tenant_id',
        'name',
        'status',
        'description',
        'structure',
        'based_on_snapshot_at',
        'created_by',
    ];

    protected $casts = [
        'structure' => 'array',
    ];
}
