<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LeaveLilLinking extends Model
{
    protected $fillable = [
        'leave_request_id', 'accrual_code', 'accrual_description',
        'hours', 'accrual_date', 'approved_by_name', 'is_verified',
    ];

    protected $casts = [
        'accrual_date' => 'date',
        'is_verified'  => 'boolean',
    ];

    public function leaveRequest()
    {
        return $this->belongsTo(LeaveRequest::class);
    }
}
