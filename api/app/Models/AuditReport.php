<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Validation\ValidationException;

class AuditReport extends Model
{
    protected $fillable = [
        'tenant_id', 'engagement_id', 'title', 'status', 'body', 'is_immutable',
        'issued_by', 'issued_at', 'confidentiality_level', 'created_by',
    ];

    protected $casts = [
        'is_immutable' => 'boolean',
        'issued_at' => 'datetime',
    ];

    public function distributions(): HasMany
    {
        return $this->hasMany(AuditReportDistribution::class, 'report_id');
    }

    public function assertEditable(): void
    {
        if ($this->is_immutable || $this->status === 'final') {
            throw ValidationException::withMessages([
                'report' => 'Final audit reports are immutable after issue.',
            ]);
        }
    }
}
