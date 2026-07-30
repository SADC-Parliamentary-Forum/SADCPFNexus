<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;

class PositionVersion extends Model
{
    protected $table = 'position_versions';

    protected $fillable = [
        'tenant_id',
        'position_id',
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
