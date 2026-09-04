<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PurchaseOrderRevision extends Model
{
    protected $fillable = [
        'purchase_order_id', 'revision', 'reason', 'changed_by', 'snapshot', 'changes',
    ];

    protected $casts = [
        'snapshot' => 'array',
        'changes' => 'array',
    ];

    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function changedBy()
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
