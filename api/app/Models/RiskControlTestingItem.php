<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RiskControlTestingItem extends Model
{
    public const STATUSES = ['pending', 'in_progress', 'passed', 'failed', 'waived', 'overdue'];

    public const RESULTS = ['pass', 'fail', 'waive'];

    protected $fillable = [
        'tenant_id', 'campaign_id', 'control_id', 'risk_id', 'status',
        'due_at', 'completed_at', 'result', 'checklist_notes', 'evidence_notes',
        'evidence_path', 'tested_by',
    ];

    protected function casts(): array
    {
        return [
            'due_at' => 'date',
            'completed_at' => 'datetime',
        ];
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(RiskControlTestingCampaign::class, 'campaign_id');
    }

    public function control(): BelongsTo
    {
        return $this->belongsTo(RiskControl::class, 'control_id');
    }

    public function risk(): BelongsTo
    {
        return $this->belongsTo(Risk::class);
    }

    public function tester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'tested_by');
    }

    public function isOpen(): bool
    {
        return in_array($this->status, ['pending', 'in_progress', 'overdue'], true);
    }
}
