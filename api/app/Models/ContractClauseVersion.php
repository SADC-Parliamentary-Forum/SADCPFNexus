<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContractClauseVersion extends Model
{
    protected $fillable = [
        'tenant_id', 'clause_id', 'version', 'body', 'status', 'effective_date',
        'approved_by', 'approved_at', 'superseded_at', 'created_by',
    ];

    protected $casts = [
        'effective_date' => 'date',
        'approved_at' => 'datetime',
        'superseded_at' => 'datetime',
    ];

    public function clause()
    {
        return $this->belongsTo(ContractClause::class, 'clause_id');
    }
}
