<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VendorPerformanceEvaluation extends Model
{
    protected $fillable = [
        'tenant_id', 'vendor_id', 'contract_id', 'evaluated_by',
        'delivery_score', 'quality_score', 'price_score', 'compliance_score', 'communication_score',
        'notes',
    ];

    protected $casts = [
        'delivery_score'     => 'integer',
        'quality_score'      => 'integer',
        'price_score'        => 'integer',
        'compliance_score'   => 'integer',
        'communication_score'=> 'integer',
    ];

    protected $appends = ['overall_score'];

    public function getOverallScoreAttribute(): float
    {
        return round(
            ($this->delivery_score * 0.30)
            + ($this->quality_score * 0.25)
            + ($this->price_score * 0.15)
            + ($this->compliance_score * 0.15)
            + ($this->communication_score * 0.15),
            2
        );
    }

    public function vendor()   { return $this->belongsTo(Vendor::class); }
    public function evaluator(){ return $this->belongsTo(User::class, 'evaluated_by'); }
    public function contract() { return $this->belongsTo(Contract::class); }
}
