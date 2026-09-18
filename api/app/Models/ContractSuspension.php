<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContractSuspension extends Model
{
    protected $fillable = [
        'tenant_id', 'contract_id', 'effective_date', 'reason', 'approving_authority_id',
        'affected_obligations', 'payment_impact', 'restart_conditions', 'resumption_date',
        'status', 'lifted_by', 'lifted_at', 'created_by',
    ];

    protected $casts = [
        'effective_date' => 'date',
        'resumption_date' => 'date',
        'lifted_at' => 'datetime',
    ];

    public function contract()
    {
        return $this->belongsTo(Contract::class);
    }
}
