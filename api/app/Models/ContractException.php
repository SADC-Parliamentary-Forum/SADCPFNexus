<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContractException extends Model
{
    protected $fillable = [
        'tenant_id', 'contract_id', 'type', 'severity', 'title', 'description', 'status',
        'authorised_by', 'authorised_at', 'resolution', 'raised_by',
    ];

    protected $casts = ['authorised_at' => 'datetime'];

    public function contract()
    {
        return $this->belongsTo(Contract::class);
    }
}
