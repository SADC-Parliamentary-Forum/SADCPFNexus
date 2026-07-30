<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;

class PeoplePersonSkill extends Model
{
    protected $table = 'people_person_skills';

    protected $fillable = [
        'tenant_id',
        'person_id',
        'skill_id',
        'level',
        'assessed_on',
        'evidence_notes',
        'recorded_by',
    ];

    protected $casts = [
        'assessed_on' => 'date',
    ];
}
