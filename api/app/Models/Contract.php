<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Contract extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'tenant_id', 'procurement_request_id', 'vendor_id', 'purchase_order_id',
        'reference_number', 'title', 'description',
        'start_date', 'end_date', 'value', 'currency',
        'status', 'signed_at', 'terminated_at', 'termination_reason',
        'created_by',
    ];

    protected $casts = [
        'start_date'    => 'date',
        'end_date'      => 'date',
        'signed_at'     => 'datetime',
        'terminated_at' => 'datetime',
        'value'         => 'decimal:2',
    ];

    protected $appends = ['is_expired', 'is_expiring_soon'];

    protected static function booted(): void
    {
        static::creating(function (self $c): void {
            if (empty($c->reference_number)) {
                $c->reference_number = 'CTR-' . strtoupper(Str::random(8));
            }
        });
    }

    // ── Relations ─────────────────────────────────────────────────────────────

    public function procurementRequest() { return $this->belongsTo(ProcurementRequest::class); }
    public function vendor()             { return $this->belongsTo(Vendor::class); }
    public function purchaseOrder()      { return $this->belongsTo(PurchaseOrder::class); }
    public function createdBy()          { return $this->belongsTo(User::class, 'created_by'); }

    // ── Accessors ─────────────────────────────────────────────────────────────

    public function getIsExpiredAttribute(): bool
    {
        return $this->end_date && $this->end_date->isPast();
    }

    public function getIsExpiringSoonAttribute(): bool
    {
        return $this->end_date
            && ! $this->end_date->isPast()
            && $this->end_date->diffInDays(now()) <= 30;
    }

    // ── Methods ───────────────────────────────────────────────────────────────

    public function isActive(): bool      { return $this->status === 'active'; }
    public function isExpired(): bool     { return $this->is_expired; }
}
