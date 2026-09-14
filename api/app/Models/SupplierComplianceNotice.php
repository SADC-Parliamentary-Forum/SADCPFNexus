<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SupplierComplianceNotice extends Model
{
    protected $fillable = [
        'tenant_id',
        'vendor_id',
        'supplier_document_id',
        'window',
        'notice_date',
    ];

    protected $casts = [
        'notice_date' => 'date',
    ];

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(SupplierDocument::class, 'supplier_document_id');
    }
}
