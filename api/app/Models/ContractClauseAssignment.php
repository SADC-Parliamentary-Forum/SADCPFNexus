<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContractClauseAssignment extends Model
{
    protected $fillable = [
        'tenant_id', 'contract_id', 'clause_id', 'clause_version_id', 'is_deviation',
        'deviation_text', 'deviation_reason', 'deviation_author', 'deviation_reviewer',
        'deviation_status', 'sort_order',
    ];

    protected $casts = [
        'is_deviation' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function contract()
    {
        return $this->belongsTo(Contract::class);
    }

    public function clause()
    {
        return $this->belongsTo(ContractClause::class, 'clause_id');
    }

    public function clauseVersion()
    {
        return $this->belongsTo(ContractClauseVersion::class, 'clause_version_id');
    }
}
