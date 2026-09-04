<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProcurementException extends Model
{
    public const TYPE_RETROSPECTIVE = 'retrospective_invoice';
    public const TYPE_SOLE_SOURCE = 'sole_source';
    public const TYPE_EMERGENCY = 'emergency';
    public const TYPE_INSUFFICIENT_QUOTATIONS = 'insufficient_quotations';
    public const TYPE_THRESHOLD = 'threshold';
    public const TYPE_BUDGET = 'budget';
    public const TYPE_SUPPLIER = 'supplier';
    public const TYPE_BANK_CHANGE = 'supplier_bank_change';
    public const TYPE_LPO_AMENDMENT = 'lpo_amendment';
    public const TYPE_VOID = 'void';
    public const TYPE_NO_PO_PAYMENT = 'no_po_payment';

    public const STATUS_REQUESTED = 'requested';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';

    protected $fillable = [
        'tenant_id', 'procurement_request_id', 'purchase_order_id', 'intake_id',
        'exception_type', 'reason', 'requested_by', 'approved_by', 'status',
        'payload', 'resolved_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'resolved_at' => 'datetime',
    ];

    public function request()
    {
        return $this->belongsTo(ProcurementRequest::class, 'procurement_request_id');
    }

    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function requestedBy()
    {
        return $this->belongsTo(User::class, 'requested_by');
    }
}
