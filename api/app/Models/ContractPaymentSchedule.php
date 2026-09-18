<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContractPaymentSchedule extends Model
{
    protected $fillable = [
        'tenant_id', 'contract_id', 'name', 'description', 'basis', 'amount', 'percentage',
        'currency', 'trigger_type', 'trigger_deliverable_id', 'status', 'due_date',
        'amount_paid', 'sort_order',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'percentage' => 'decimal:2',
        'amount_paid' => 'decimal:2',
        'due_date' => 'date',
        'sort_order' => 'integer',
    ];

    public function contract()
    {
        return $this->belongsTo(Contract::class);
    }

    public function triggerDeliverable()
    {
        return $this->belongsTo(ContractDeliverable::class, 'trigger_deliverable_id');
    }
}
