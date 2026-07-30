<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;

class PeopleSuccessionCandidate extends Model
{
    protected $table = 'people_succession_candidates';

    protected $fillable = [
        'tenant_id',
        'succession_plan_id',
        'person_id',
        'readiness',
        'rank',
        'notes',
    ];
}
