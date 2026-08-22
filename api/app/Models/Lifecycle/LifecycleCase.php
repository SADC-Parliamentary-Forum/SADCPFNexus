<?php

namespace App\Models\Lifecycle;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LifecycleCase extends Model
{
    protected $table = 'lifecycle_cases';

    protected $fillable = [
        'tenant_id',
        'reference',
        'employee_id',
        'person_id',
        'hr_file_id',
        'lifecycle_type',
        'template_version_id',
        'status',
        'separation_reason',
        'start_date',
        'target_start_date',
        'last_working_day',
        'notice_end_date',
        'notice_snapshot',
        'readiness',
        'clearance_status',
        'terminal_payment_blocked',
        'terminal_payment_approved_at',
        'revision',
        'created_by',
        'completed_at',
    ];

    protected $casts = [
        'start_date' => 'date',
        'target_start_date' => 'date',
        'last_working_day' => 'date',
        'notice_end_date' => 'date',
        'notice_snapshot' => 'array',
        'readiness' => 'array',
        'terminal_payment_blocked' => 'boolean',
        'terminal_payment_approved_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'employee_id');
    }

    public function templateVersion(): BelongsTo
    {
        return $this->belongsTo(LifecycleJourneyTemplateVersion::class, 'template_version_id');
    }

    public function stages(): HasMany
    {
        return $this->hasMany(LifecycleStageInstance::class, 'case_id');
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(LifecycleTaskInstance::class, 'case_id');
    }

    public function events(): HasMany
    {
        return $this->hasMany(LifecycleEvent::class, 'case_id');
    }

    public function exceptions(): HasMany
    {
        return $this->hasMany(LifecycleException::class, 'case_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
