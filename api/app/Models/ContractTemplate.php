<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContractTemplate extends Model
{
    protected $fillable = [
        'tenant_id', 'contract_type_id', 'name', 'counterparty_type', 'description',
        'status', 'current_version_id', 'created_by',
    ];

    public function versions()
    {
        return $this->hasMany(ContractTemplateVersion::class, 'template_id')->orderByDesc('id');
    }

    public function currentVersion()
    {
        return $this->belongsTo(ContractTemplateVersion::class, 'current_version_id');
    }

    public function contractType()
    {
        return $this->belongsTo(ContractType::class, 'contract_type_id');
    }
}
