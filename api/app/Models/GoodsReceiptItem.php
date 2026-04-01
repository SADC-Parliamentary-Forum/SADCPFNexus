<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GoodsReceiptItem extends Model
{
    protected $fillable = [
        'goods_receipt_note_id', 'purchase_order_item_id',
        'quantity_ordered', 'quantity_received', 'quantity_accepted',
        'condition_notes',
    ];

    public function goodsReceiptNote()   { return $this->belongsTo(GoodsReceiptNote::class); }
    public function purchaseOrderItem()  { return $this->belongsTo(PurchaseOrderItem::class); }
}
