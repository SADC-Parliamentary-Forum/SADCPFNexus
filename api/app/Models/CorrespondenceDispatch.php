<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CorrespondenceDispatch extends Model
{
    protected $table = 'correspondence_dispatches';

    protected $fillable = [
        'correspondence_id', 'dispatched_by', 'channel', 'dispatched_at',
        'tracking_reference', 'delivery_status', 'delivered_at',
        'recipient_name', 'evidence_notes', 'evidence_path',
        'courier_carrier', 'tracking_number', 'tracking_status',
        'tracking_checked_at', 'tracking_payload',
    ];

    protected $casts = [
        'dispatched_at' => 'datetime',
        'delivered_at' => 'datetime',
        'tracking_checked_at' => 'datetime',
        'tracking_payload' => 'array',
    ];

    public function correspondence(): BelongsTo
    {
        return $this->belongsTo(Correspondence::class);
    }

    public function dispatcher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dispatched_by');
    }
}
