<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TimesheetImportRow extends Model
{
    public const STATUS_VALID = 'valid';

    public const STATUS_WARNING = 'warning';

    public const STATUS_ERROR = 'error';

    public const STATUS_DUPLICATE = 'duplicate';

    public const STATUS_EXCLUDED = 'excluded';

    protected $fillable = [
        'tenant_id', 'import_batch_id', 'source_row_number', 'split_index', 'split_group',
        'raw', 'normalised', 'row_status', 'messages', 'row_fingerprint', 'mapped_user_id',
        'source_employee_email', 'source_employee_name', 'timesheet_id', 'timesheet_entry_id',
    ];

    protected function casts(): array
    {
        return [
            'raw' => 'array',
            'normalised' => 'array',
            'messages' => 'array',
        ];
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(TimesheetImportBatch::class, 'import_batch_id');
    }

    public function mappedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'mapped_user_id');
    }

    public function isImportable(): bool
    {
        return in_array($this->row_status, [self::STATUS_VALID, self::STATUS_WARNING], true);
    }
}
