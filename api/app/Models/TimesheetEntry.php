<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TimesheetEntry extends Model
{
    use HasFactory;

    public const WORK_BUCKETS = ['delivery', 'meeting', 'communication', 'administration', 'other'];

    protected $fillable = [
        'timesheet_id',
        'project_id',
        'work_bucket',
        'activity_type',
        'entry_category',
        'work_assignment_id',
        'assignment_id',
        'pif_id',
        'programme_id',
        'work_date',
        'start_time',
        'end_time',
        'hours',
        'overtime_hours',
        'overtime_requisition_id',
        'description',
        'source_type',
        'source_record_id',
        'is_locked',
        'import_batch_id',
        'source_row_id',
        'row_fingerprint',
        'original_project',
        'original_activity',
        'original_description',
        'original_start',
        'original_end',
        'original_duration',
        'original_created_date',
        'source_employee_name',
        'source_employee_email',
        'source_filename',
        'source_row_number',
        'external_reference',
        'clockify_metadata',
        'reversed_at',
    ];

    public const SOURCE_MANUAL = 'manual';

    public const SOURCE_NEXUS_TEMPLATE_IMPORT = 'nexus_template_import';

    public const SOURCE_CLOCKIFY_IMPORT = 'clockify_import';

    public const SOURCE_ADMIN_IMPORT = 'admin_import';

    public const SOURCE_LEGACY_IMPORT = 'legacy_import';

    protected $casts = [
        'work_date' => 'date',
        'is_locked' => 'bool',
        'clockify_metadata' => 'array',
        'reversed_at' => 'datetime',
    ];

    public function timesheet(): BelongsTo
    {
        return $this->belongsTo(Timesheet::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(TimesheetProject::class, 'project_id');
    }

    public function workAssignment(): BelongsTo
    {
        return $this->belongsTo(WorkAssignment::class, 'work_assignment_id');
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class, 'assignment_id');
    }

    public function importBatch(): BelongsTo
    {
        return $this->belongsTo(TimesheetImportBatch::class, 'import_batch_id');
    }

    public function isImported(): bool
    {
        return in_array($this->source_type, [
            self::SOURCE_NEXUS_TEMPLATE_IMPORT,
            self::SOURCE_CLOCKIFY_IMPORT,
            self::SOURCE_ADMIN_IMPORT,
            self::SOURCE_LEGACY_IMPORT,
        ], true);
    }
}
