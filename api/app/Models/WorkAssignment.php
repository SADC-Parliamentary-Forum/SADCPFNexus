<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class WorkAssignment extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'tenant_id', 'assigned_to', 'assigned_by', 'department_id',
        'title', 'description', 'priority', 'status', 'due_date',
        'started_at', 'completed_at', 'timesheet_linked',
        'estimated_hours', 'actual_hours', 'linked_module', 'linked_id',
        'completion_notes',
    ];

    protected function casts(): array
    {
        return [
            'due_date' => 'date',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'timesheet_linked' => 'boolean',
        ];
    }

    public function assignedTo(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function assignedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function updates(): HasMany
    {
        return $this->hasMany(WorkAssignmentUpdate::class, 'assignment_id');
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function getIsOverdueAttribute(): bool
    {
        return $this->due_date
            && $this->due_date->isPast()
            && ! in_array($this->status, ['completed', 'cancelled']);
    }
}
