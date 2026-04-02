<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PurchaseOrderItem extends Model
{
    protected $fillable = [
        'purchase_order_id', 'procurement_item_id',
        'description', 'quantity', 'unit', 'unit_price', 'total_price',
    ];

    protected $casts = ['unit_price' => 'float', 'total_price' => 'float'];

    public function purchaseOrder()    { return $this->belongsTo(PurchaseOrder::class); }
    public function procurementItem()  { return $this->belongsTo(ProcurementItem::class); }
    public function receiptItems()     { return $this->hasMany(GoodsReceiptItem::class); }

    /** Total quantity already received across all GRNs */
    public function totalReceived(): int
    {
        return $this->receiptItems()->sum('quantity_accepted');
    }

    /** Remaining quantity to be received */
    public function outstanding(): int
    {
        return max(0, $this->quantity - $this->totalReceived());
    }
}
