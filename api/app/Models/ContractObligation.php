<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContractObligation extends Model
{
    protected $fillable = [
        'tenant_id', 'contract_id', 'obligation', 'responsible_party', 'owner_id',
        'due_date', 'evidence', 'status',
    ];

    protected $casts = ['due_date' => 'date'];

    public function contract()
    {
        return $this->belongsTo(Contract::class);
    }
}
