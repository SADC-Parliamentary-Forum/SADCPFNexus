<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TravelAccommodation extends Model
{
    protected $fillable = [
        'travel_request_id', 'hotel_name', 'country', 'city',
        'check_in', 'check_out', 'room_type', 'rate', 'currency',
        'paid_by', 'confirmation_number', 'cancellation_deadline',
        'contact', 'attachment_id', 'notes',
    ];

    protected $casts = [
        'check_in' => 'date',
        'check_out' => 'date',
        'cancellation_deadline' => 'date',
        'rate' => 'decimal:2',
    ];

    public function travelRequest(): BelongsTo
    {
        return $this->belongsTo(TravelRequest::class);
    }

    public function attachment(): BelongsTo
    {
        return $this->belongsTo(Attachment::class);
    }
}
