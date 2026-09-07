<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ServiceConfirmation extends Model
{
    protected $fillable = [
        'tenant_id', 'purchase_order_id', 'confirmed_by',
        'delivered', 'satisfactory', 'comments', 'confirmed_at',
    ];

    protected $casts = [
        'satisfactory' => 'boolean',
        'confirmed_at' => 'datetime',
    ];

    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function confirmedBy()
    {
        return $this->belongsTo(User::class, 'confirmed_by');
    }

    public function isPositive(): bool
    {
        return in_array($this->delivered, ['yes', 'partially'], true) && $this->satisfactory === true;
    }
}
