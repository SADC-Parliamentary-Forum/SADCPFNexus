<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContractDispute extends Model
{
    protected $fillable = [
        'tenant_id', 'contract_id', 'type', 'description', 'date_raised', 'counterparty_claim',
        'internal_owner_id', 'legal_involved', 'amount_at_risk', 'status', 'resolution', 'resolved_at', 'created_by',
    ];

    protected $casts = [
        'date_raised' => 'date',
        'resolved_at' => 'date',
        'legal_involved' => 'boolean',
        'amount_at_risk' => 'decimal:2',
    ];

    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class);
    }

    public function internalOwner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'internal_owner_id');
    }
}
