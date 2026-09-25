<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HrVipImportFile extends Model
{
    protected $fillable = [
        'import_batch_id',
        'role',
        'original_filename',
        'storage_path',
        'mime',
        'size_bytes',
    ];

    public function batch(): BelongsTo
    {
        return $this->belongsTo(HrVipImportBatch::class, 'import_batch_id');
    }
}
