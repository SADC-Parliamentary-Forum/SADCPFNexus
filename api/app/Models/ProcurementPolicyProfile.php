<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProcurementPolicyProfile extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'key',
        'name',
        'description',
        'donor_codes',
        'direct_purchase_limit',
        'quotation_limit',
        'tender_threshold',
        'minimum_quotes_required',
        'split_lookback_days',
        'split_enforcement',
        'is_active',
        'is_default',
        'created_by',
    ];

    protected $casts = [
        'donor_codes'             => 'array',
        'direct_purchase_limit'   => 'float',
        'quotation_limit'         => 'float',
        'tender_threshold'        => 'float',
        'minimum_quotes_required' => 'integer',
        'split_lookback_days'     => 'integer',
        'is_active'               => 'boolean',
        'is_default'              => 'boolean',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function toThresholdArray(): array
    {
        return [
            'direct_purchase_limit'   => (float) $this->direct_purchase_limit,
            'quotation_limit'         => (float) $this->quotation_limit,
            'tender_threshold'        => (float) $this->tender_threshold,
            'minimum_quotes_required' => (int) $this->minimum_quotes_required,
            'split_lookback_days'     => (int) $this->split_lookback_days,
            'split_enforcement'       => (string) $this->split_enforcement,
            'policy_profile_key'      => $this->key,
            'donor_codes'             => $this->donor_codes ?? [],
        ];
    }
}
