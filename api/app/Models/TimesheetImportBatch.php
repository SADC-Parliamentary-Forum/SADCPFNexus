<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TimesheetImportBatch extends Model
{
    public const MODE_SELF = 'self';

    public const MODE_SINGLE = 'single';

    public const MODE_MULTI = 'multi';

    public const STATUS_UPLOADED = 'uploaded';

    public const STATUS_DETECTING = 'detecting';

    public const STATUS_MAPPING = 'mapping';

    public const STATUS_VALIDATING = 'validating';

    public const STATUS_PREVIEW_READY = 'preview_ready';

    public const STATUS_PROCESSING = 'processing';

    public const STATUS_IMPORTED = 'imported';

    public const STATUS_PARTIAL = 'partial';

    public const STATUS_VERIFIED = 'verified';

    public const STATUS_ROLLED_BACK = 'rolled_back';

    public const STATUS_REVERSED = 'reversed';

    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'tenant_id', 'reference', 'filename', 'file_hash', 'file_storage_key', 'file_size_bytes',
        'detected_mime', 'format', 'source_type', 'mode', 'target_user_id', 'status', 'progress_step',
        'total_rows', 'valid_rows', 'warning_rows', 'error_rows', 'duplicate_rows', 'excluded_rows',
        'imported_rows', 'column_map', 'detected_headers', 'idempotency_key', 'import_valid_only',
        'import_as_verified', 'verify_justification', 'failure_reason', 'uploaded_by', 'uploaded_at',
        'confirmed_by', 'confirmed_at', 'verified_by', 'verified_at', 'rollback_by', 'rollback_at',
        'rollback_reason', 'reversed_by', 'reversed_at', 'reverse_reason',
    ];

    protected function casts(): array
    {
        return [
            'column_map' => 'array',
            'detected_headers' => 'array',
            'import_valid_only' => 'bool',
            'import_as_verified' => 'bool',
            'uploaded_at' => 'datetime',
            'confirmed_at' => 'datetime',
            'verified_at' => 'datetime',
            'rollback_at' => 'datetime',
            'reversed_at' => 'datetime',
        ];
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function targetUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'target_user_id');
    }

    public function rows(): HasMany
    {
        return $this->hasMany(TimesheetImportRow::class, 'import_batch_id');
    }

    public function verifications(): HasMany
    {
        return $this->hasMany(TimesheetHistoricalVerification::class, 'import_batch_id');
    }

    public function isUnverified(): bool
    {
        return in_array($this->status, [self::STATUS_IMPORTED, self::STATUS_PARTIAL], true);
    }

    public function canRollback(): bool
    {
        return in_array($this->status, [self::STATUS_IMPORTED, self::STATUS_PARTIAL, self::STATUS_PREVIEW_READY], true);
    }
}
