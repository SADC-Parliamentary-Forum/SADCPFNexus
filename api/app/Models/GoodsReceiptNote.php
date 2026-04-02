<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class GoodsReceiptNote extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'tenant_id', 'purchase_order_id', 'reference_number',
        'received_by', 'received_date', 'delivery_note_number',
        'notes', 'status',
    ];

    protected $casts = ['received_date' => 'date'];

    protected static function booted(): void
    {
        static::creating(function (self $grn): void {
            if (empty($grn->reference_number)) {
                $grn->reference_number = 'GRN-' . strtoupper(Str::random(8));
            }
        });
    }

    public function purchaseOrder() { return $this->belongsTo(PurchaseOrder::class); }
    public function receivedBy()    { return $this->belongsTo(User::class, 'received_by'); }
    public function items()         { return $this->hasMany(GoodsReceiptItem::class); }

    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable')->latest();
    }

    public function isAccepted(): bool { return $this->status === 'accepted'; }
    public function isRejected(): bool { return $this->status === 'rejected'; }
}
