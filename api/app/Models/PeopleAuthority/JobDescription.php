<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class JobDescription extends Model
{
    use SoftDeletes;

    protected $table = 'job_descriptions';

    protected $fillable = [
        'tenant_id',
        'position_id',
        'title',
        'status',
        'current_version',
        'created_by',
    ];

}
