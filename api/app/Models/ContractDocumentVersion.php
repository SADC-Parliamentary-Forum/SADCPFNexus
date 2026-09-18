<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContractDocumentVersion extends Model
{
    protected $fillable = [
        'tenant_id', 'contract_id', 'version', 'kind', 'managed_document_id', 'storage_path',
        'hash', 'hash_algorithm', 'generated_at', 'generated_by', 'signer_sequence', 'is_locked',
    ];

    protected $casts = [
        'generated_at' => 'datetime',
        'signer_sequence' => 'array',
        'is_locked' => 'boolean',
        'version' => 'integer',
    ];

    public function contract()
    {
        return $this->belongsTo(Contract::class);
    }
}
