<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TravelFundingLine extends Model
{
    protected $fillable = [
        'travel_request_id', 'item', 'forum_amount', 'host_amount',
        'funding_agency', 'project', 'budget_line', 'sort_order',
    ];

    protected $casts = [
        'forum_amount' => 'decimal:2',
        'host_amount'  => 'decimal:2',
    ];

    public function travelRequest(): BelongsTo
    {
        return $this->belongsTo(TravelRequest::class);
    }
}
