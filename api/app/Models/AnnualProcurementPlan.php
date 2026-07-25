<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class AnnualProcurementPlan extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'tenant_id', 'plan_year', 'title', 'status', 'notes', 'created_by',
    ];

    protected $casts = [
        'plan_year' => 'integer',
    ];

    public function items()
    {
        return $this->hasMany(AnnualProcurementPlanItem::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
