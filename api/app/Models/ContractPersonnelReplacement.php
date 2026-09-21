<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContractPersonnelReplacement extends Model
{
    protected $fillable = [
        'tenant_id', 'contract_id', 'personnel_id', 'proposed_name', 'proposed_role',
        'proposed_email', 'proposed_cv_reference', 'reason', 'status',
        'requested_by', 'decided_by', 'decided_at', 'decision_note',
    ];

    protected $casts = [
        'decided_at' => 'datetime',
    ];

    public function personnel(): BelongsTo
    {
        return $this->belongsTo(ContractKeyPersonnel::class, 'personnel_id');
    }

    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class);
    }
}
