<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BalanceTransaction extends Model
{
    protected $fillable = [
        'register_id', 'type', 'amount',
        'previous_balance', 'new_balance',
        'reference_doc', 'notes', 'supporting_document_path',
        'created_by', 'verification_status',
    ];

    protected $casts = [
        'amount'           => 'decimal:2',
        'previous_balance' => 'decimal:2',
        'new_balance'      => 'decimal:2',
    ];

    public function register()
    {
        return $this->belongsTo(BalanceRegister::class, 'register_id');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function verification()
    {
        return $this->hasOne(BalanceVerification::class, 'transaction_id');
    }

    public function acknowledgement()
    {
        return $this->hasOne(BalanceAcknowledgement::class, 'transaction_id');
    }

    public function isPending(): bool  { return $this->verification_status === 'pending'; }
    public function isApproved(): bool { return $this->verification_status === 'approved'; }
    public function isRejected(): bool { return $this->verification_status === 'rejected'; }
}
