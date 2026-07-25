<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContractMilestone extends Model
{
    protected $fillable = [
        'contract_id', 'tenant_id', 'title', 'description', 'due_date',
        'amount', 'currency', 'status', 'completed_at', 'completed_by', 'notes', 'sort_order',
    ];

    protected $casts = [
        'due_date'     => 'date',
        'completed_at' => 'datetime',
        'amount'       => 'decimal:2',
        'sort_order'   => 'integer',
    ];

    public function contract()
    {
        return $this->belongsTo(Contract::class);
    }

    public function completedBy()
    {
        return $this->belongsTo(User::class, 'completed_by');
    }
}
