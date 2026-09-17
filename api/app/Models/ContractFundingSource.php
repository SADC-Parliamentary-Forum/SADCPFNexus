<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContractFundingSource extends Model
{
    protected $fillable = [
        'tenant_id', 'contract_id', 'funding_source_id', 'donor', 'project_id',
        'budget_line', 'amount', 'percentage', 'currency',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'percentage' => 'decimal:2',
    ];

    public function contract()
    {
        return $this->belongsTo(Contract::class);
    }
}
