<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContractParty extends Model
{
    protected $fillable = [
        'tenant_id', 'contract_id', 'party_role', 'type', 'title', 'first_name', 'surname',
        'full_legal_name', 'email', 'phone', 'id_reference', 'nationality', 'address',
        'profession', 'organisation', 'registration_number', 'tax_reference', 'vendor_id',
    ];

    public function contract()
    {
        return $this->belongsTo(Contract::class);
    }
}
