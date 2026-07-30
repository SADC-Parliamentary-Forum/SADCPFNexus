<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;

class PeopleSodConflictReport extends Model
{
    protected $table = 'people_sod_conflict_reports';

    protected $fillable = [
        'tenant_id',
        'title',
        'status',
        'conflict_count',
        'conflicts',
        'rule_snapshot',
        'generated_by',
        'generated_at',
        'acknowledged_by',
        'acknowledged_at',
    ];

    protected $casts = [
        'conflicts' => 'array',
        'rule_snapshot' => 'array',
        'generated_at' => 'datetime',
        'acknowledged_at' => 'datetime',
    ];
}
