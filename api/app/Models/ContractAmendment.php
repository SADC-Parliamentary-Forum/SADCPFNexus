<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContractAmendment extends Model
{
    protected $fillable = [
        'tenant_id', 'contract_id', 'reference_number', 'sequence', 'type', 'reason',
        'description', 'changes', 'value_delta', 'revised_value', 'new_end_date',
        'is_material', 'status', 'approval_request_id', 'created_by', 'approved_by', 'approved_at',
    ];

    protected $casts = [
        'changes' => 'array',
        'value_delta' => 'decimal:2',
        'revised_value' => 'decimal:2',
        'new_end_date' => 'date',
        'is_material' => 'boolean',
        'sequence' => 'integer',
        'approved_at' => 'datetime',
    ];

    public function contract()
    {
        return $this->belongsTo(Contract::class);
    }

    public function approvalRequest()
    {
        return $this->morphOne(ApprovalRequest::class, 'approvable');
    }
}
