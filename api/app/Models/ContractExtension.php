<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContractExtension extends Model
{
    protected $fillable = [
        'tenant_id', 'contract_id', 'current_end_date', 'proposed_end_date', 'reason',
        'impact', 'financial_impact', 'status', 'approved_by', 'approved_at', 'created_by',
    ];

    protected $casts = [
        'current_end_date' => 'date',
        'proposed_end_date' => 'date',
        'financial_impact' => 'decimal:2',
        'approved_at' => 'datetime',
    ];

    public function contract()
    {
        return $this->belongsTo(Contract::class);
    }
}
