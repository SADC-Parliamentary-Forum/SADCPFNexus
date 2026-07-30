<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;

class EmploymentRecord extends Model
{
    protected $table = 'employment_records';

    protected $fillable = [
        'tenant_id',
        'person_id',
        'employee_number',
        'contract_type',
        'grade',
        'hire_date',
        'probation_end',
        'termination_date',
        'status',
        'meta',
    ];

    protected $casts = [
        'hire_date' => 'date',
        'probation_end' => 'date',
        'termination_date' => 'date',
        'meta' => 'array',
    ];
}
