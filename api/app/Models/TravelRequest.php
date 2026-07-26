<?php
namespace App\Models;

use App\Models\Concerns\PreparedOnBehalf;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class TravelRequest extends Model
{
    use HasFactory, SoftDeletes, PreparedOnBehalf;

    protected $fillable = [
        'tenant_id', 'requester_id', 'approved_by', 'reference_number',
        'purpose', 'status', 'departure_date', 'return_date',
        'destination_country', 'destination_city', 'estimated_dsa',
        'actual_dsa', 'currency', 'justification', 'rejection_reason',
        'workplan_event_id', 'submitted_at', 'approved_at',
        'prepared_by', 'prepared_on_behalf_of', 'delegated_authority_id',
        'budget_line_id', 'programme_id', 'mission_id', 'host_organization',
        'cabin_class', 'route_is_most_economical', 'route_justification',
        'personal_incremental_cost', 'personal_cost_acknowledged_at',
        'vehicle_type', 'driver_required', 'driver_name',
        'finance_status', 'director_finance_confirmed_at', 'director_finance_confirmed_by',
        'director_finance_remarks', 'booking_committed_at',
        'is_emergency', 'emergency_reason', 'emergency_authorised_by',
        'returned_at', 'retirement_status', 'retirement_due_at',
        'official_personal_days', 'finance_dsa_total', 'meal_deduction_total',
        'terminal_comms_total', 'amendment_of_id', 'original_snapshot',
        'visa_required', 'visa_status', 'visa_expiry_date', 'visa_appointment_date',
        'visa_notes', 'visa_last_reminded_at',
        'itinerary_version', 'itinerary_raw_source',
        'health_vaccination_required', 'health_vaccination_status',
        'health_prophylaxis_required', 'health_prophylaxis_status',
        'health_estimated_cost', 'health_notes', 'health_cleared_at',
        'procurement_request_id', 'procurement_link_reason', 'procurement_link_required',
    ];

    protected $casts = [
        'departure_date'                 => 'date',
        'return_date'                    => 'date',
        'submitted_at'                   => 'datetime',
        'approved_at'                    => 'datetime',
        'personal_cost_acknowledged_at'  => 'datetime',
        'director_finance_confirmed_at'  => 'datetime',
        'booking_committed_at'           => 'datetime',
        'returned_at'                    => 'datetime',
        'retirement_due_at'              => 'date',
        'visa_expiry_date'               => 'date',
        'visa_appointment_date'          => 'date',
        'visa_last_reminded_at'          => 'datetime',
        'route_is_most_economical'       => 'boolean',
        'driver_required'                => 'boolean',
        'is_emergency'                   => 'boolean',
        'visa_required'                  => 'boolean',
        'health_vaccination_required'    => 'boolean',
        'health_prophylaxis_required'    => 'boolean',
        'procurement_link_required'      => 'boolean',
        'health_cleared_at'              => 'datetime',
        'health_estimated_cost'          => 'decimal:2',
        'official_personal_days'         => 'array',
        'original_snapshot'              => 'array',
        'personal_incremental_cost'      => 'decimal:2',
        'finance_dsa_total'              => 'decimal:2',
        'meal_deduction_total'           => 'decimal:2',
        'terminal_comms_total'           => 'decimal:2',
        'estimated_dsa'                  => 'decimal:2',
        'actual_dsa'                     => 'decimal:2',
    ];

    public function requester()
    {
        return $this->belongsTo(User::class, 'requester_id');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function itineraries()
    {
        return $this->hasMany(TravelItinerary::class);
    }

    public function fundingLines()
    {
        return $this->hasMany(TravelFundingLine::class)->orderBy('sort_order');
    }

    public function dsaLines()
    {
        return $this->hasMany(TravelDsaLine::class)->orderBy('date');
    }

    public function toilCandidates()
    {
        return $this->hasMany(TravelToilCandidate::class);
    }

    public function amendments()
    {
        return $this->hasMany(TravelAmendment::class);
    }

    public function programme()
    {
        return $this->belongsTo(Programme::class);
    }

    public function mission()
    {
        return $this->belongsTo(TravelMission::class, 'mission_id');
    }

    public function directorFinanceConfirmer()
    {
        return $this->belongsTo(User::class, 'director_finance_confirmed_by');
    }

    public function emergencyAuthoriser()
    {
        return $this->belongsTo(User::class, 'emergency_authorised_by');
    }

    public function imprestRequests()
    {
        return $this->hasMany(ImprestRequest::class);
    }

    public function procurementRequest()
    {
        return $this->belongsTo(ProcurementRequest::class, 'procurement_request_id');
    }

    /** Meeting (workplan event) this travel is for — used for LIL “meetings attended”. */
    public function workplanEvent()
    {
        return $this->belongsTo(WorkplanEvent::class, 'workplan_event_id');
    }

    public function approvalRequest()
    {
        return $this->morphOne(ApprovalRequest::class, 'approvable');
    }

    public function onWorkflowApproved(User $approver): void
    {
        app(\App\Modules\Travel\Services\TravelService::class)->onWorkflowApproved($this, $approver);
    }

    public function onWorkflowRejected(User $approver, ?string $reason = null): void
    {
        app(\App\Modules\Travel\Services\TravelService::class)->onWorkflowRejected($this, $approver, $reason);
    }

    public function onWorkflowReturned(User $approver, ?string $comment = null): void
    {
        $this->update(['status' => 'returned_for_correction']);
    }

    public function onWorkflowWithdrawn(): void
    {
        $this->update(['status' => 'withdrawn']);
    }

    public function onWorkflowResubmitted(): void
    {
        $this->update(['status' => 'resubmitted']);
    }

    public function attachments(): \Illuminate\Database\Eloquent\Relations\MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable')->latest();
    }

    public function isDraft(): bool { return $this->status === 'draft'; }
    public function isSubmitted(): bool { return in_array($this->status, ['submitted', 'resubmitted'], true); }
    public function isApproved(): bool { return $this->status === 'approved'; }

    public function isRetirementOverdue(): bool
    {
        if (! $this->retirement_due_at || in_array($this->retirement_status, ['completed', 'retired'], true)) {
            return false;
        }

        return $this->retirement_due_at->lt(now()->startOfDay());
    }

    /** @return list<string> personal day Y-m-d strings */
    public function personalDayDates(): array
    {
        $days = $this->official_personal_days ?? [];
        $out = [];
        foreach ($days as $day) {
            if (is_array($day) && ($day['type'] ?? '') !== 'official') {
                $out[] = $day['date'] ?? null;
            } elseif (is_string($day)) {
                // legacy
            }
        }

        return array_values(array_filter($out));
    }
}
