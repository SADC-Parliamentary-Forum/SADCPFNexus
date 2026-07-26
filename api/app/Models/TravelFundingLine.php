<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TravelFundingLine extends Model
{
    protected $fillable = [
        'travel_request_id', 'item', 'forum_amount', 'host_amount',
        'funding_agency', 'project', 'budget_line', 'sort_order',
        'payor_sadc_pf', 'payor_host', 'payor_donor', 'payor_self',
        'donor_amount', 'self_amount',
    ];

    protected $casts = [
        'forum_amount' => 'decimal:2',
        'host_amount'  => 'decimal:2',
        'donor_amount' => 'decimal:2',
        'self_amount'  => 'decimal:2',
        'payor_sadc_pf' => 'boolean',
        'payor_host' => 'boolean',
        'payor_donor' => 'boolean',
        'payor_self' => 'boolean',
    ];

    public function travelRequest(): BelongsTo
    {
        return $this->belongsTo(TravelRequest::class);
    }
}
