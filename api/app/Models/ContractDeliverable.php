<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContractDeliverable extends Model
{
    protected $fillable = [
        'tenant_id', 'contract_id', 'number', 'name', 'description', 'acceptance_criteria',
        'responsible_party', 'internal_reviewer_id', 'due_date', 'payment_schedule_id',
        'required_evidence', 'status', 'accepted_by', 'accepted_at', 'review_comments', 'sort_order',
    ];

    protected $casts = [
        'due_date' => 'date',
        'accepted_at' => 'datetime',
        'number' => 'integer',
        'sort_order' => 'integer',
    ];

    public function contract()
    {
        return $this->belongsTo(Contract::class);
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'internal_reviewer_id');
    }

    public function isAccepted(): bool
    {
        return $this->status === 'accepted';
    }
}
