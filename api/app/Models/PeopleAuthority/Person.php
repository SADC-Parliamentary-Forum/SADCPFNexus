<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Person extends Model
{
    use SoftDeletes;

    protected $table = 'people';

    protected $fillable = [
        'tenant_id',
        'person_number',
        'title',
        'first_name',
        'middle_name',
        'last_name',
        'preferred_name',
        'display_name',
        'person_type',
        'employment_status',
        'work_email',
        'work_phone',
        'mobile_phone',
        'office_location',
        'primary_unit_id',
        'start_date',
        'end_date',
        'directory_visible',
        'photo_path',
        'directory_meta',
        'operational_meta',
        'created_by',
    ];

    protected $casts = [
        'directory_visible' => 'boolean',
        'start_date' => 'date',
        'end_date' => 'date',
        'directory_meta' => 'array',
        'operational_meta' => 'array',
    ];
}
