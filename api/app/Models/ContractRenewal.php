<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContractRenewal extends Model
{
    protected $fillable = [
        'tenant_id', 'contract_id', 'renewal_number', 'new_start_date', 'new_end_date', 'reason',
        'procurement_validated', 'budget_confirmed', 'status', 'approved_by', 'approved_at', 'created_by',
    ];

    protected $casts = [
        'new_start_date' => 'date',
        'new_end_date' => 'date',
        'procurement_validated' => 'boolean',
        'budget_confirmed' => 'boolean',
        'approved_at' => 'datetime',
        'renewal_number' => 'integer',
    ];

    public function contract()
    {
        return $this->belongsTo(Contract::class);
    }
}
