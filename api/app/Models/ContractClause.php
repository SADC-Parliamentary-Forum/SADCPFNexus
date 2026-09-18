<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContractClause extends Model
{
    protected $fillable = [
        'tenant_id', 'key', 'title', 'category', 'clause_type', 'donor', 'condition_note',
        'is_active', 'current_version_id', 'sort_order', 'created_by',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function versions()
    {
        return $this->hasMany(ContractClauseVersion::class, 'clause_id')->orderByDesc('id');
    }

    public function currentVersion()
    {
        return $this->belongsTo(ContractClauseVersion::class, 'current_version_id');
    }

    public function isLocked(): bool
    {
        return $this->clause_type === 'mandatory_locked';
    }

    public function isMandatory(): bool
    {
        return in_array($this->clause_type, ['mandatory_locked', 'mandatory_editable'], true);
    }
}
