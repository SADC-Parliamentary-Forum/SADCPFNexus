<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class AuditExternalEngagement extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'tenant_id', 'title', 'auditor_firm', 'status', 'access_starts_at', 'access_ends_at',
        'access_active', 'notes', 'coordinator_id', 'confidentiality_level', 'created_by',
    ];

    protected $casts = [
        'access_starts_at' => 'date',
        'access_ends_at' => 'date',
        'access_active' => 'boolean',
    ];

    public function requests(): HasMany
    {
        return $this->hasMany(AuditExternalRequest::class, 'external_engagement_id');
    }

    public function findings(): HasMany
    {
        return $this->hasMany(AuditExternalFinding::class, 'external_engagement_id');
    }

    public function isAccessWindowOpen(): bool
    {
        if (! $this->access_active) {
            return false;
        }
        $today = now()->toDateString();
        if ($this->access_starts_at && $today < $this->access_starts_at->toDateString()) {
            return false;
        }
        if ($this->access_ends_at && $today > $this->access_ends_at->toDateString()) {
            return false;
        }

        return true;
    }
}
