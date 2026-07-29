<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class AuditPlan extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'tenant_id', 'title', 'fiscal_year', 'version', 'status', 'summary',
        'amendment_reason', 'approved_by', 'approved_at', 'created_by', 'confidentiality_level',
    ];

    protected $casts = ['approved_at' => 'datetime'];

    public function versions(): HasMany
    {
        return $this->hasMany(AuditPlanVersion::class);
    }

    public function approvals(): HasMany
    {
        return $this->hasMany(AuditPlanApproval::class);
    }

    public function engagements(): HasMany
    {
        return $this->hasMany(AuditEngagement::class);
    }
}
