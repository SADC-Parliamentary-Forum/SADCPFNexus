<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TravelToilCandidate extends Model
{
    public const STATUS_CANDIDATE = 'candidate';
    public const STATUS_OT_AUTHORISED = 'ot_authorised';
    public const STATUS_DUTY_CONFIRMED = 'duty_confirmed';
    public const STATUS_HR_VALIDATED = 'hr_validated';
    public const STATUS_CREDITED = 'credited';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_LAPSED = 'lapsed';

    protected $fillable = [
        'tenant_id', 'travel_request_id', 'user_id', 'candidate_date', 'hours',
        'reason', 'status', 'ot_authorised_at', 'ot_authorised_by',
        'duty_confirmed_at', 'duty_confirmed_by', 'hr_validated_at', 'hr_validated_by',
        'credited_at', 'overtime_accrual_id', 'expires_at', 'sg_extended_at',
        'sg_extended_by', 'rejection_reason',
    ];

    protected $casts = [
        'candidate_date'    => 'date',
        'expires_at'        => 'date',
        'hours'             => 'decimal:1',
        'ot_authorised_at'  => 'datetime',
        'duty_confirmed_at' => 'datetime',
        'hr_validated_at'   => 'datetime',
        'credited_at'       => 'datetime',
        'sg_extended_at'    => 'datetime',
    ];

    public function travelRequest(): BelongsTo
    {
        return $this->belongsTo(TravelRequest::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function overtimeAccrual(): BelongsTo
    {
        return $this->belongsTo(OvertimeAccrual::class);
    }
}
