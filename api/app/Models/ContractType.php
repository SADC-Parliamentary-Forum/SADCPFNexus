<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContractType extends Model
{
    protected $fillable = [
        'tenant_id', 'name', 'slug', 'counterparty_type', 'category',
        'description', 'requires_legal_review', 'is_active', 'sort_order',
    ];

    protected $casts = [
        'requires_legal_review' => 'boolean',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function contracts()
    {
        return $this->hasMany(Contract::class, 'type_id');
    }
}
