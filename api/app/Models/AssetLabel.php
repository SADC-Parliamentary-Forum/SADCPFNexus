<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetLabel extends Model
{
    /** Statuses of the label that is (or should be) on the device; 'replaced' is history. */
    public const LIVE_STATUSES = ['current', 'reprint_required'];

    protected $fillable = [
        'tenant_id', 'asset_id', 'template_id', 'label_version', 'qr_token_id',
        'recovery_contact_version', 'printed_custodian_id', 'printed_location_id',
        'printed_description', 'printed_phone', 'printed_email', 'printed_at',
        'printed_by', 'status', 'reprint_reason', 'replaced_by_label_id', 'label_batch_id',
        'applied_at', 'applied_by', 'applied_attachment_id', 'placement_note',
    ];

    protected function casts(): array
    {
        return [
            'printed_at' => 'datetime',
            'applied_at' => 'datetime',
            'label_version' => 'integer',
            'recovery_contact_version' => 'integer',
        ];
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function printedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'printed_by');
    }

    public function appliedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'applied_by');
    }

    /** Photo of the label stuck on the device. */
    public function appliedPhoto(): BelongsTo
    {
        return $this->belongsTo(Attachment::class, 'applied_attachment_id');
    }
}
