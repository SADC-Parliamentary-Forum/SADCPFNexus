<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetLabelTemplate extends Model
{
    protected $fillable = [
        'tenant_id', 'code', 'name', 'kind', 'page_size', 'page_width_mm',
        'page_height_mm', 'margin_top_mm', 'margin_left_mm', 'label_width_mm',
        'label_height_mm', 'h_gap_mm', 'v_gap_mm', 'rows', 'columns', 'font_pt',
        'qr_mm', 'is_default', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'page_width_mm' => 'decimal:2',
            'page_height_mm' => 'decimal:2',
            'margin_top_mm' => 'decimal:2',
            'margin_left_mm' => 'decimal:2',
            'label_width_mm' => 'decimal:2',
            'label_height_mm' => 'decimal:2',
            'h_gap_mm' => 'decimal:2',
            'v_gap_mm' => 'decimal:2',
            'is_default' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
