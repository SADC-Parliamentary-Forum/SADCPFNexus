<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProgrammeProcurementItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'programme_id', 'description', 'estimated_cost', 'method',
        'vendor', 'delivery_date', 'status',
        'procurement_request_id', 'currency', 'rfq_required',
    ];

    protected $casts = [
        'estimated_cost' => 'decimal:2',
        'delivery_date'  => 'date',
        'rfq_required'   => 'boolean',
    ];

    public function programme()
    {
        return $this->belongsTo(Programme::class);
    }

    public function procurementRequest()
    {
        return $this->belongsTo(ProcurementRequest::class);
    }
}
