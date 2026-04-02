<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class PurchaseOrder extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'tenant_id', 'procurement_request_id', 'vendor_id', 'reference_number',
        'title', 'description', 'delivery_address', 'payment_terms',
        'total_amount', 'currency', 'status',
        'issued_at', 'expected_delivery_date', 'cancellation_reason',
        'created_by', 'issued_by',
    ];

    protected $casts = [
        'total_amount'           => 'float',
        'issued_at'              => 'datetime',
        'expected_delivery_date' => 'date',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $po): void {
            if (empty($po->reference_number)) {
                $po->reference_number = 'PO-' . strtoupper(Str::random(8));
            }
        });
    }

    public function procurementRequest() { return $this->belongsTo(ProcurementRequest::class); }
    public function vendor()             { return $this->belongsTo(Vendor::class); }
    public function items()              { return $this->hasMany(PurchaseOrderItem::class); }
    public function goodsReceiptNotes()  { return $this->hasMany(GoodsReceiptNote::class); }
    public function createdBy()          { return $this->belongsTo(User::class, 'created_by'); }
    public function issuedBy()           { return $this->belongsTo(User::class, 'issued_by'); }

    public function isDraft(): bool    { return $this->status === 'draft'; }
    public function isIssued(): bool   { return in_array($this->status, ['issued', 'partially_received']); }
    public function isReceived(): bool { return $this->status === 'received'; }
    public function isClosed(): bool   { return $this->status === 'closed'; }

    public function canBeIssued(): bool   { return $this->isDraft(); }
    public function canReceiveGoods(): bool { return in_array($this->status, ['issued', 'partially_received']); }

    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable')->latest();
    }
}
