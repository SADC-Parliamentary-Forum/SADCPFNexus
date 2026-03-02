<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ImprestRequest extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id', 'requester_id', 'approved_by', 'reference_number',
        'budget_line', 'amount_requested', 'amount_approved', 'amount_liquidated',
        'currency', 'expected_liquidation_date', 'purpose', 'justification',
        'status', 'rejection_reason', 'submitted_at', 'approved_at', 'liquidated_at',
    ];

    protected $casts = [
        'expected_liquidation_date' => 'date',
        'submitted_at'  => 'datetime',
        'approved_at'   => 'datetime',
        'liquidated_at' => 'datetime',
    ];

    public function requester()
    {
        return $this->belongsTo(User::class, 'requester_id');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function isDraft(): bool { return $this->status === 'draft'; }
    public function isSubmitted(): bool { return $this->status === 'submitted'; }
    public function isApproved(): bool { return $this->status === 'approved'; }
}
