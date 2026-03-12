<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class ConductRecord extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'tenant_id', 'employee_id', 'recorded_by', 'reviewed_by', 'hr_file_id',
        'record_type', 'status', 'title', 'description',
        'incident_date', 'issue_date', 'outcome', 'appeal_notes',
        'resolution_date', 'is_confidential',
    ];

    protected function casts(): array
    {
        return [
            'incident_date' => 'date',
            'issue_date' => 'date',
            'resolution_date' => 'date',
            'is_confidential' => 'boolean',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'employee_id');
    }

    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function hrFile(): BelongsTo
    {
        return $this->belongsTo(HrPersonalFile::class, 'hr_file_id');
    }

    public function getIsPositiveAttribute(): bool
    {
        return $this->record_type === 'commendation';
    }
}
