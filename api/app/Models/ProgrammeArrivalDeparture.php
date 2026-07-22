<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProgrammeArrivalDeparture extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'programme_id', 'category', 'arrival_date', 'departure_date',
        'airport', 'flight_details', 'transport_required', 'accommodation_required', 'comments',
    ];

    protected $casts = [
        'arrival_date'            => 'date',
        'departure_date'          => 'date',
        'transport_required'      => 'boolean',
        'accommodation_required'  => 'boolean',
    ];

    public function programme()
    {
        return $this->belongsTo(Programme::class);
    }
}
