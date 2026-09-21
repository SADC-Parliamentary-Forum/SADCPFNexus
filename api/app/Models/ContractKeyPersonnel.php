<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ContractKeyPersonnel extends Model
{
    protected $table = 'contract_key_personnel';

    protected $fillable = [
        'tenant_id', 'contract_id', 'name', 'role', 'email', 'cv_reference',
        'is_key', 'status', 'replaced_by_id', 'created_by',
    ];

    protected $casts = [
        'is_key' => 'boolean',
    ];

    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class);
    }

    public function replacements(): HasMany
    {
        return $this->hasMany(ContractPersonnelReplacement::class, 'personnel_id');
    }
}
