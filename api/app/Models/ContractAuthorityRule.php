<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContractAuthorityRule extends Model
{
    protected $fillable = [
        'tenant_id', 'name', 'action', 'contract_type_id', 'amount_floor', 'amount_ceiling',
        'currency', 'authorised_role', 'alternate_role', 'effective_from', 'effective_until',
        'policy_source', 'approval_reference', 'is_active', 'sort_order', 'created_by',
    ];

    protected $casts = [
        'amount_floor' => 'decimal:2',
        'amount_ceiling' => 'decimal:2',
        'effective_from' => 'date',
        'effective_until' => 'date',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function contractType(): BelongsTo
    {
        return $this->belongsTo(ContractType::class, 'contract_type_id');
    }

    /** Roles that satisfy this rule (authorised + optional alternate). */
    public function roles(): array
    {
        return array_values(array_filter([$this->authorised_role, $this->alternate_role]));
    }
}
