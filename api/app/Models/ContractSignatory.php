<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContractSignatory extends Model
{
    protected $fillable = [
        'tenant_id', 'contract_id', 'party', 'sign_order', 'method', 'signer_user_id',
        'signer_name', 'signer_email', 'status', 'signature_event_id', 'document_version_id',
        'signed_at', 'decline_reason', 'token', 'token_expires_at',
    ];

    protected $casts = [
        'signed_at' => 'datetime',
        'token_expires_at' => 'datetime',
        'sign_order' => 'integer',
    ];

    public function contract()
    {
        return $this->belongsTo(Contract::class);
    }

    public function signer()
    {
        return $this->belongsTo(User::class, 'signer_user_id');
    }
}
