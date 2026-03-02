<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProcurementQuote extends Model
{
    protected $fillable = ['procurement_request_id', 'vendor_id', 'vendor_name', 'quoted_amount', 'currency', 'is_recommended', 'notes', 'quote_date'];
    protected $casts = ['quote_date' => 'date', 'is_recommended' => 'boolean'];

    public function procurementRequest() { return $this->belongsTo(ProcurementRequest::class); }
    public function vendor()             { return $this->belongsTo(Vendor::class); }
}
