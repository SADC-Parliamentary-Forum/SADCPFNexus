<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetLabel extends Model
{
    protected $fillable = [
        'tenant_id', 'asset_id', 'template_id', 'label_version', 'qr_token_id',
        'recovery_contact_version', 'printed_custodian_id', 'printed_location_id',
        'printed_description', 'printed_phone', 'printed_email', 'printed_at',
        'printed_by', 'status', 'reprint_reason', 'replaced_by_label_id', 'label_batch_id',
    ];

    protected function casts(): array
    {
        return [
            'printed_at' => 'datetime',
            'label_version' => 'integer',
            'recovery_contact_version' => 'integer',
        ];
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }
}
