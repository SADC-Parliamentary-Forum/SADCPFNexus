<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContractComplianceDocument extends Model
{
    protected $fillable = [
        'tenant_id', 'contract_id', 'requirement_type', 'name', 'attachment_id',
        'issue_date', 'expiry_date', 'status',
    ];

    protected $casts = [
        'issue_date' => 'date',
        'expiry_date' => 'date',
    ];

    public function contract()
    {
        return $this->belongsTo(Contract::class);
    }

    public function isExpired(): bool
    {
        return $this->expiry_date !== null && $this->expiry_date->isPast();
    }
}
