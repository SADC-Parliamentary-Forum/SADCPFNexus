<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuthorityAssignment extends Model
{
    protected $table = 'authority_assignments';

    protected $fillable = [
        'tenant_id',
        'authority_definition_id',
        'assignee_type',
        'assignee_id',
        'scope',
        'value_limit',
        'currency',
        'effective_from',
        'effective_to',
        'source_policy_id',
        'approved_by',
        'status',
    ];

    protected $casts = [
        'scope' => 'array',
        'value_limit' => 'decimal:2',
        'effective_from' => 'date',
        'effective_to' => 'date',
    ];

    public function definition(): BelongsTo
    {
        return $this->belongsTo(AuthorityDefinition::class, 'authority_definition_id');
    }
}
