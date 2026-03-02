<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TravelItinerary extends Model
{
    protected $fillable = [
        'travel_request_id', 'from_location', 'to_location',
        'travel_date', 'transport_mode', 'dsa_rate', 'days_count', 'calculated_dsa',
    ];

    protected $casts = ['travel_date' => 'date'];

    public function travelRequest()
    {
        return $this->belongsTo(TravelRequest::class);
    }
}
