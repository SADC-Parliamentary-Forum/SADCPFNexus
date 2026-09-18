<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContractTermination extends Model
{
    protected $fillable = [
        'tenant_id', 'contract_id', 'type', 'reason', 'notice_reference', 'effective_date',
        'outstanding_obligations', 'final_amount', 'dispute_status', 'approved_by', 'created_by',
    ];

    protected $casts = [
        'effective_date' => 'date',
        'final_amount' => 'decimal:2',
    ];

    public function contract()
    {
        return $this->belongsTo(Contract::class);
    }
}
