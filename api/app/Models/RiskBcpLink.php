<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RiskBcpLink extends Model
{
    public const TYPES = ['bcp_note', 'insurance_policy'];

    protected $fillable = [
        'tenant_id', 'risk_id', 'link_type', 'title', 'notes',
        'asset_insurance_policy_id', 'created_by',
    ];

    public function risk(): BelongsTo
    {
        return $this->belongsTo(Risk::class);
    }

    public function insurancePolicy(): BelongsTo
    {
        return $this->belongsTo(AssetInsurancePolicy::class, 'asset_insurance_policy_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
