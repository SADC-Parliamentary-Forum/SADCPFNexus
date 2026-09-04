<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AssetLabelBatch extends Model
{
    protected $fillable = [
        'tenant_id', 'batch_number', 'template_id', 'number_of_labels',
        'printed_by', 'printed_at', 'is_reprint', 'reprint_reason',
        'source_import_batch_id',
    ];

    protected function casts(): array
    {
        return [
            'printed_at' => 'datetime',
            'is_reprint' => 'boolean',
        ];
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(AssetLabelTemplate::class, 'template_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(AssetLabelBatchItem::class, 'label_batch_id');
    }

    public function printer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'printed_by');
    }
}
