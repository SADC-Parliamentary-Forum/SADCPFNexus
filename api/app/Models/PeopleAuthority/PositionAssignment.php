<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;

class PositionAssignment extends Model
{
    protected $table = 'position_assignments';

    protected $fillable = [
        'tenant_id',
        'position_id',
        'person_id',
        'assignment_type',
        'is_substantive',
        'start_at',
        'end_at',
        'appointment_document_id',
        'approved_by',
        'status',
        'reason',
        'created_by',
    ];

    protected $casts = [
        'is_substantive' => 'boolean',
        'start_at' => 'date',
        'end_at' => 'date',
    ];
}
