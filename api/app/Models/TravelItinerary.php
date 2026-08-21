<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TravelItinerary extends Model
{
    protected $fillable = [
        'travel_request_id', 'from_location', 'to_location',
        'travel_date', 'transport_mode', 'dsa_rate', 'days_count', 'calculated_dsa',
        'day_type',
        'flight_name', 'flight_number', 'carrier', 'departure_at', 'arrival_at',
        'parse_source', 'itinerary_version',
    ];

    protected $casts = [
        'travel_date' => 'date',
        'departure_at' => 'datetime',
        'arrival_at' => 'datetime',
    ];

    public function travelRequest()
    {
        return $this->belongsTo(TravelRequest::class);
    }
}
