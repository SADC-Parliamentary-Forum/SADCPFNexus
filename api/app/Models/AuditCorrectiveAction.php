<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AuditCorrectiveAction extends Model
{
    protected $fillable = [
        'tenant_id', 'finding_id', 'recommendation_id', 'title', 'description',
        'owner_user_id', 'due_date', 'status', 'assignment_id', 'created_by',
        'implemented_by', 'completed_at', 'confidentiality_level',
    ];

    protected $casts = [
        'due_date' => 'date',
        'completed_at' => 'datetime',
    ];

    public function finding(): BelongsTo
    {
        return $this->belongsTo(AuditFinding::class, 'finding_id');
    }

    public function verifications(): HasMany
    {
        return $this->hasMany(AuditVerification::class, 'corrective_action_id');
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class, 'assignment_id');
    }
}
