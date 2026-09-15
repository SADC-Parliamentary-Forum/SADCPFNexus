<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TimesheetImportTemplate extends Model
{
    protected $fillable = [
        'tenant_id', 'version', 'filename', 'storage_path', 'file_hash', 'is_current', 'uploaded_by',
    ];

    protected function casts(): array
    {
        return [
            'is_current' => 'bool',
        ];
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
