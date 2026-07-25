<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AnnualProcurementPlanItem extends Model
{
    protected $fillable = [
        'annual_procurement_plan_id', 'description', 'category', 'estimated_value',
        'currency', 'suggested_method', 'quarter', 'status', 'procurement_request_id', 'notes',
    ];

    protected $casts = [
        'estimated_value' => 'float',
        'quarter'         => 'integer',
    ];

    public function plan()
    {
        return $this->belongsTo(AnnualProcurementPlan::class, 'annual_procurement_plan_id');
    }

    public function procurementRequest()
    {
        return $this->belongsTo(ProcurementRequest::class);
    }
}
