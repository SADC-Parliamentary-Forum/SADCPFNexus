<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProcurementItem extends Model
{
    protected $fillable = ['procurement_request_id', 'description', 'quantity', 'unit', 'estimated_unit_price', 'total_price'];

    public function request() { return $this->belongsTo(ProcurementRequest::class, 'procurement_request_id'); }
}
