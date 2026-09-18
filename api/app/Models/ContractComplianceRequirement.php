<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContractComplianceRequirement extends Model
{
    protected $fillable = [
        'tenant_id', 'code', 'name', 'description', 'contract_type_id',
        'requires_expiry', 'blocks_activation', 'blocks_payment', 'is_active', 'sort_order', 'created_by',
    ];

    protected $casts = [
        'requires_expiry' => 'boolean',
        'blocks_activation' => 'boolean',
        'blocks_payment' => 'boolean',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function contractType(): BelongsTo
    {
        return $this->belongsTo(ContractType::class, 'contract_type_id');
    }
}
