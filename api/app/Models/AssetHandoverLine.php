<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetHandoverLine extends Model
{
    public const RESPONSES = [
        'received', 'not_received', 'incorrect_asset', 'condition_different', 'accessories_missing',
    ];

    public const EXCEPTION_RESPONSES = [
        'not_received', 'incorrect_asset', 'condition_different', 'accessories_missing',
    ];

    protected $fillable = [
        'tenant_id', 'handover_id', 'asset_id',
        'snapshot_tag', 'snapshot_name', 'snapshot_serial', 'condition_out',
        'accessories', 'photo_attachment_ids', 'notes',
        'line_status', 'recipient_response', 'dispute_notes', 'condition_in',
        'responded_at', 'responded_by',
    ];

    protected function casts(): array
    {
        return [
            'accessories' => 'array',
            'photo_attachment_ids' => 'array',
            'responded_at' => 'datetime',
        ];
    }

    public function handover(): BelongsTo
    {
        return $this->belongsTo(AssetHandover::class, 'handover_id');
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function isException(): bool
    {
        return in_array((string) $this->recipient_response, self::EXCEPTION_RESPONSES, true)
            || in_array((string) $this->line_status, ['not_received', 'incorrect_asset', 'condition_different', 'accessories_missing', 'disputed'], true);
    }
}
