<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TravelToilCandidate extends Model
{
    /** Awaiting supervisor confirmation of actual duty performed. */
    public const STATUS_PENDING_SUPERVISOR = 'pending_supervisor';

    /** Supervisor confirmed; awaiting HR entitlement / OT validation. */
    public const STATUS_PENDING_HR = 'pending_hr';

    public const STATUS_CREDITED = 'credited';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_EXPIRED = 'expired';
    public const STATUS_EXTENDED = 'extended';

    /** @deprecated Use STATUS_PENDING_SUPERVISOR */
    public const STATUS_CANDIDATE = self::STATUS_PENDING_SUPERVISOR;

    /** @deprecated Intermediate OT stamp; treated as pending_supervisor */
    public const STATUS_OT_AUTHORISED = 'ot_authorised';

    /** @deprecated Use STATUS_PENDING_HR */
    public const STATUS_DUTY_CONFIRMED = self::STATUS_PENDING_HR;

    /** @deprecated Use STATUS_CREDITED */
    public const STATUS_HR_VALIDATED = self::STATUS_CREDITED;

    /** @deprecated Use STATUS_EXPIRED */
    public const STATUS_LAPSED = self::STATUS_EXPIRED;

    public const TERMINAL_STATUSES = [
        self::STATUS_CREDITED,
        self::STATUS_REJECTED,
        self::STATUS_EXPIRED,
        self::STATUS_EXTENDED,
    ];

    protected $fillable = [
        'tenant_id', 'travel_request_id', 'user_id', 'candidate_date', 'hours',
        'reason', 'status', 'ot_authorised_at', 'ot_authorised_by',
        'duty_confirmed_at', 'duty_confirmed_by', 'hr_validated_at', 'hr_validated_by',
        'credited_at', 'overtime_accrual_id', 'expires_at', 'sg_extended_at',
        'sg_extended_by', 'sg_extend_reason', 'rejection_reason',
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

    public function isOpen(): bool
    {
        return ! in_array($this->status, self::TERMINAL_STATUSES, true);
    }

    public function awaitsSupervisor(): bool
    {
        return in_array($this->status, [
            self::STATUS_PENDING_SUPERVISOR,
            self::STATUS_OT_AUTHORISED,
            'candidate',
        ], true);
    }

    public function awaitsHr(): bool
    {
        return in_array($this->status, [
            self::STATUS_PENDING_HR,
            'duty_confirmed',
        ], true);
    }
}
