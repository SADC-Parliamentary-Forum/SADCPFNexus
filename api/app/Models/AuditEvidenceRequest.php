<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AuditEvidenceRequest extends Model
{
    protected $fillable = [
        'tenant_id', 'engagement_id', 'title', 'description', 'due_date', 'status',
        'requested_from_user_id', 'requested_by', 'confidentiality_level',
    ];

    protected $casts = ['due_date' => 'date'];

    public function responses(): HasMany
    {
        return $this->hasMany(AuditEvidenceResponse::class, 'evidence_request_id');
    }
}
