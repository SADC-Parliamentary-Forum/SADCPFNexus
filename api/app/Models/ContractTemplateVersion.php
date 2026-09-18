<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContractTemplateVersion extends Model
{
    protected $fillable = [
        'tenant_id', 'template_id', 'version', 'body', 'variables', 'status',
        'effective_date', 'approved_by', 'approved_at', 'superseded_at', 'created_by',
    ];

    protected $casts = [
        'variables' => 'array',
        'effective_date' => 'date',
        'approved_at' => 'datetime',
        'superseded_at' => 'datetime',
    ];

    public function template()
    {
        return $this->belongsTo(ContractTemplate::class, 'template_id');
    }

    public function isProducible(): bool
    {
        return in_array($this->status, ['APPROVED', 'ACTIVE'], true);
    }
}
