<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InventoryRegisterEntry extends Model
{
    protected $fillable = [
        'tenant_id', 'goods_receipt_note_id', 'goods_receipt_item_id',
        'asset_id', 'stock_item_id', 'source', 'label',
    ];
}
