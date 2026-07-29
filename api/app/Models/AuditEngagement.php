<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class AuditEngagement extends Model
{
    use SoftDeletes;

    public const STATUSES = [
        'planned', 'notified', 'independence_pending', 'fieldwork',
        'reporting', 'issued', 'closed', 'cancelled',
    ];

    protected $fillable = [
        'tenant_id', 'audit_plan_id', 'universe_entity_id', 'reference_number', 'title',
        'audit_type', 'status', 'planned_start', 'planned_end', 'actual_start', 'actual_end',
        'lead_auditor_id', 'auditee_owner_id', 'department_id', 'objectives', 'scope',
        'notification_sent', 'notification_sent_at', 'confidentiality_level', 'created_by',
    ];

    protected $casts = [
        'planned_start' => 'date',
        'planned_end' => 'date',
        'actual_start' => 'date',
        'actual_end' => 'date',
        'notification_sent' => 'boolean',
        'notification_sent_at' => 'datetime',
    ];

    public function independenceDeclarations(): HasMany
    {
        return $this->hasMany(AuditIndependenceDeclaration::class, 'engagement_id');
    }

    public function findings(): HasMany
    {
        return $this->hasMany(AuditFinding::class, 'engagement_id');
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(AuditPlan::class, 'audit_plan_id');
    }
}
