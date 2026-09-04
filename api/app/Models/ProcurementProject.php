<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProcurementProject extends Model
{
    protected $fillable = [
        'tenant_id', 'code', 'name', 'funding_source', 'donor_id',
        'programme_id', 'policy_profile_id', 'account_code', 'cost_centre',
        'allows_no_po_payment', 'is_active',
    ];

    protected $casts = [
        'allows_no_po_payment' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function programme()
    {
        return $this->belongsTo(Programme::class);
    }

    public function policyProfile()
    {
        return $this->belongsTo(ProcurementPolicyProfile::class, 'policy_profile_id');
    }
}
