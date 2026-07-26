<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TravelAmendment extends Model
{
    protected $fillable = [
        'travel_request_id', 'created_by', 'status', 'proposed_changes',
        'original_snapshot', 'reason',
    ];

    protected $casts = [
        'proposed_changes'  => 'array',
        'original_snapshot' => 'array',
    ];

    public function travelRequest(): BelongsTo
    {
        return $this->belongsTo(TravelRequest::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
