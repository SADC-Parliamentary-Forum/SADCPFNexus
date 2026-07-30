<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;

class PeopleSkill extends Model
{
    protected $table = 'people_skills';

    protected $fillable = [
        'tenant_id',
        'code',
        'name',
        'category',
        'description',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];
}
