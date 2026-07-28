<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class RiskIncident extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'tenant_id', 'incident_code', 'title', 'description', 'risk_id',
        'severity', 'status', 'occurred_at', 'reported_by', 'department_id',
        'is_confidential',
    ];

    protected $casts = [
        'occurred_at' => 'datetime',
        'is_confidential' => 'boolean',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $incident): void {
            if (empty($incident->incident_code)) {
                $incident->incident_code = 'INC-'.strtoupper(Str::random(8));
            }
        });
    }

    public function risk(): BelongsTo
    {
        return $this->belongsTo(Risk::class);
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reported_by');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }
}
