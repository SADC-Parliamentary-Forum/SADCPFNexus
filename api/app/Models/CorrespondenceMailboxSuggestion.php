<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CorrespondenceMailboxSuggestion extends Model
{
    public const STATUSES = ['suggested', 'imported', 'dismissed'];

    protected $fillable = [
        'tenant_id',
        'message_id',
        'subject',
        'from_address',
        'from_name',
        'received_at',
        'body_preview',
        'raw_headers',
        'status',
        'correspondence_id',
        'imported_by',
        'imported_at',
    ];

    protected function casts(): array
    {
        return [
            'received_at' => 'datetime',
            'imported_at' => 'datetime',
        ];
    }

    public function correspondence(): BelongsTo
    {
        return $this->belongsTo(Correspondence::class);
    }

    public function importer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'imported_by');
    }
}
