<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Validation\ValidationException;

class AuditFinding extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'tenant_id', 'engagement_id', 'observation_id', 'reference_number', 'title',
        'criterion', 'condition_text', 'cause', 'effect', 'recommendation', 'rating',
        'root_cause_category', 'status', 'is_final', 'issued_by', 'issued_at',
        'repeat_of_finding_id', 'linked_risk_id', 'risk_acceptance_status',
        'created_by', 'confidentiality_level',
    ];

    protected $casts = [
        'is_final' => 'boolean',
        'issued_at' => 'datetime',
    ];

    public function managementResponses(): HasMany
    {
        return $this->hasMany(AuditManagementResponse::class, 'finding_id');
    }

    public function recommendations(): HasMany
    {
        return $this->hasMany(AuditRecommendation::class, 'finding_id');
    }

    public function correctiveActions(): HasMany
    {
        return $this->hasMany(AuditCorrectiveAction::class, 'finding_id');
    }

    public function assertFindingTextEditable(): void
    {
        if ($this->is_final || in_array($this->status, ['issued', 'closed', 'management_response', 'corrective_in_progress', 'due_for_verification', 'risk_accepted'], true)) {
            throw ValidationException::withMessages([
                'finding' => 'Final/issued finding text cannot be edited. Management may only add responses.',
            ]);
        }
    }
}
