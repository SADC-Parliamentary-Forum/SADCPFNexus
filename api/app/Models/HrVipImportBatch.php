<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class HrVipImportBatch extends Model
{
    public const STATUS_DRAFT = 'draft';

    public const STATUS_STAGED = 'staged';

    public const STATUS_COMMITTED = 'committed';

    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'tenant_id',
        'created_by',
        'batch_number',
        'status',
        'asset_count_before',
        'asset_count_after',
        'staged',
        'preview',
        'commit_summary',
        'last_error',
        'committed_at',
    ];

    protected function casts(): array
    {
        return [
            'staged' => 'array',
            'preview' => 'array',
            'commit_summary' => 'array',
            'committed_at' => 'datetime',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function files(): HasMany
    {
        return $this->hasMany(HrVipImportFile::class, 'import_batch_id');
    }
}
