<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;

class OffboardingCase extends Model
{
    protected $table = 'offboarding_cases';

    protected $fillable = [
        'tenant_id',
        'person_id',
        'reference',
        'status',
        'checklist',
        'access_actions_confirmed',
        'last_working_day',
        'created_by',
        'completed_at',
    ];

    protected $casts = [
        'checklist' => 'array',
        'access_actions_confirmed' => 'boolean',
        'last_working_day' => 'date',
        'completed_at' => 'datetime',
    ];
}
