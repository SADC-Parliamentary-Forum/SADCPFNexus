<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Invoice extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'tenant_id', 'purchase_order_id', 'goods_receipt_note_id', 'vendor_id',
        'reference_number', 'vendor_invoice_number',
        'invoice_date', 'due_date', 'amount', 'currency',
        'status', 'match_status', 'match_notes', 'rejection_reason',
        'reviewed_by', 'reviewed_at',
    ];

    protected $casts = [
        'invoice_date' => 'date',
        'due_date'     => 'date',
        'reviewed_at'  => 'datetime',
        'amount'       => 'decimal:2',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $inv): void {
            if (empty($inv->reference_number)) {
                $inv->reference_number = 'INV-' . strtoupper(Str::random(8));
            }
        });
    }

    // ── Relations ─────────────────────────────────────────────────────────────

    public function purchaseOrder()    { return $this->belongsTo(PurchaseOrder::class); }
    public function goodsReceiptNote() { return $this->belongsTo(GoodsReceiptNote::class); }
    public function vendor()           { return $this->belongsTo(Vendor::class); }
    public function reviewedBy()       { return $this->belongsTo(User::class, 'reviewed_by'); }

    // ── Methods ───────────────────────────────────────────────────────────────

    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable')->latest();
    }

    public function isMatched(): bool  { return $this->match_status === 'matched'; }
    public function isApproved(): bool { return $this->status === 'approved'; }
    public function isRejected(): bool { return $this->status === 'rejected'; }

    /**
     * Run 3-way match: compare PO total amount ↔ Invoice amount.
     * If a GRN is linked, also verify the GRN is accepted.
     *
     * Returns ['match_status' => 'matched'|'variance', 'match_notes' => string].
     */
    public function performThreeWayMatch(): array
    {
        $po     = $this->purchaseOrder;
        $grn    = $this->goodsReceiptNote;
        $notes  = [];
        $status = 'matched';

        // Check invoice amount vs PO total
        if ((float) $this->amount > (float) $po->total_amount) {
            $notes[]  = "Invoice amount ({$this->currency} {$this->amount}) exceeds PO total ({$po->currency} {$po->total_amount}).";
            $status   = 'variance';
        } elseif (abs((float) $this->amount - (float) $po->total_amount) > 0.01) {
            $notes[]  = "Invoice amount ({$this->currency} {$this->amount}) differs from PO total ({$po->currency} {$po->total_amount}).";
            $status   = 'variance';
        }

        // Check GRN acceptance status
        if ($grn && ! $grn->isAccepted()) {
            $notes[] = "Linked GRN ({$grn->reference_number}) has not been accepted (status: {$grn->status}).";
            $status  = 'variance';
        }

        return [
            'match_status' => $status,
            'match_notes'  => implode(' ', $notes),
        ];
    }
}
