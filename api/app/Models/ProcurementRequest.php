<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProcurementRequest extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id', 'requester_id', 'approved_by', 'reference_number',
        'title', 'description', 'category', 'estimated_value', 'currency',
        'procurement_method', 'status', 'budget_line', 'justification',
        'rejection_reason', 'required_by_date', 'submitted_at', 'approved_at',
    ];

    protected $casts = [
        'required_by_date' => 'date',
        'submitted_at'     => 'datetime',
        'approved_at'      => 'datetime',
    ];

    public function requester() { return $this->belongsTo(User::class, 'requester_id'); }
    public function approver()  { return $this->belongsTo(User::class, 'approved_by'); }
    public function items()     { return $this->hasMany(ProcurementItem::class); }
    public function quotes()    { return $this->hasMany(ProcurementQuote::class); }

    public function isDraft(): bool     { return $this->status === 'draft'; }
    public function isSubmitted(): bool { return $this->status === 'submitted'; }
}
