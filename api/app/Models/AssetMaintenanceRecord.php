<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetMaintenanceRecord extends Model
{
    protected $fillable = [
        'tenant_id', 'asset_id', 'maintenance_type', 'status', 'title',
        'description', 'scheduled_on', 'completed_on', 'cost', 'vendor',
        'under_warranty', 'recorded_by',
        'severity', 'quotation_amount', 'parts', 'warranty_claim', 'outcome', 'sent_on', 'returned_on',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_on' => 'date',
            'completed_on' => 'date',
            'sent_on' => 'date',
            'returned_on' => 'date',
            'cost' => 'decimal:2',
            'quotation_amount' => 'decimal:2',
            'under_warranty' => 'boolean',
            'warranty_claim' => 'boolean',
        ];
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }
}
