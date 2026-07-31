<?php

namespace App\Models\PlatformAudit;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SecurityMonitoringRule extends Model
{
    protected $table = 'security_monitoring_rules';

    protected $fillable = [
        'tenant_id', 'rule_key', 'version', 'name', 'description',
        'event_key_pattern', 'severity', 'threshold_count', 'window_minutes',
        'enabled', 'status', 'meta', 'published_by', 'published_at',
    ];

    protected $casts = [
        'enabled' => 'boolean',
        'meta' => 'array',
        'published_at' => 'datetime',
    ];

    public function alerts(): HasMany
    {
        return $this->hasMany(AuditEventAlert::class, 'rule_id');
    }
}
