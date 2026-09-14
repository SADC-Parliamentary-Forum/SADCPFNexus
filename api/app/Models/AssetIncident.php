<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetIncident extends Model
{
    protected $fillable = [
        'tenant_id', 'asset_id', 'type', 'status', 'date_noticed', 'last_seen_date',
        'last_known_location', 'custodian_id', 'circumstances', 'reporter_name',
        'reporter_phone', 'reporter_email', 'message', 'found_location', 'public_report',
        'police_station', 'police_case_number', 'police_reported_on', 'insurer',
        'claim_reference', 'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'date_noticed' => 'date',
            'last_seen_date' => 'date',
            'police_reported_on' => 'date',
            'public_report' => 'boolean',
        ];
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }
}
