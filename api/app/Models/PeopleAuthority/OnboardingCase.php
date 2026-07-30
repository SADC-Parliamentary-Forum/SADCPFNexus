<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;

class OnboardingCase extends Model
{
    protected $table = 'onboarding_cases';

    protected $fillable = [
        'tenant_id',
        'person_id',
        'reference',
        'status',
        'checklist',
        'target_position_id',
        'target_unit_id',
        'created_by',
        'completed_at',
    ];

    protected $casts = [
        'checklist' => 'array',
        'completed_at' => 'datetime',
    ];
}
