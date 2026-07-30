<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;

class ReportingRelationship extends Model
{
    protected $table = 'reporting_relationships';

    protected $fillable = [
        'tenant_id',
        'subordinate_position_id',
        'supervisor_position_id',
        'relationship_type',
        'is_primary',
        'effective_from',
        'effective_to',
        'source',
        'approved_by',
        'status',
    ];

    protected $casts = [
        'is_primary' => 'boolean',
        'effective_from' => 'date',
        'effective_to' => 'date',
    ];
}
