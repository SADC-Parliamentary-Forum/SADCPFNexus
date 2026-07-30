<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;

class JobDescriptionVersion extends Model
{
    protected $table = 'job_description_versions';

    protected $fillable = [
        'tenant_id',
        'job_description_id',
        'version',
        'content',
        'duties',
        'requirements',
        'published_by',
        'published_at',
        'sg_acknowledged_by',
        'sg_acknowledged_at',
        'employee_acknowledged_by',
        'employee_acknowledged_at',
    ];

    protected $casts = [
        'duties' => 'array',
        'requirements' => 'array',
        'published_at' => 'datetime',
        'sg_acknowledged_at' => 'datetime',
        'employee_acknowledged_at' => 'datetime',
    ];
}
