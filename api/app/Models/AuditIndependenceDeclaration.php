<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditIndependenceDeclaration extends Model
{
    protected $fillable = [
        'tenant_id', 'engagement_id', 'user_id', 'status', 'declaration_text',
        'conflict_notes', 'declared_at', 'reviewed_by', 'reviewed_at',
    ];

    protected $casts = [
        'declared_at' => 'datetime',
        'reviewed_at' => 'datetime',
    ];

    public function isClearedForFieldwork(): bool
    {
        return in_array($this->status, ['cleared', 'recused'], true);
    }
}
