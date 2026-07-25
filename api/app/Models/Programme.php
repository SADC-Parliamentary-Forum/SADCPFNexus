<?php
namespace App\Models;

use App\Models\Concerns\PreparedOnBehalf;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Programme extends Model
{
    use HasFactory, SoftDeletes, PreparedOnBehalf;

    protected $fillable = [
        'tenant_id', 'created_by', 'approved_by', 'reference_number', 'title', 'status',
        'prepared_by', 'prepared_on_behalf_of', 'delegated_authority_id',
        'strategic_alignment', 'strategic_pillar', 'strategic_pillars', 'implementing_department',
        'implementing_departments', 'supporting_departments',
        'background', 'overall_objective', 'specific_objectives', 'expected_outputs',
        'target_beneficiaries', 'gender_considerations',
        'primary_currency', 'base_currency', 'exchange_rate', 'contingency_pct', 'total_budget',
        'funding_source', 'funding_sources', 'responsible_officer', 'responsible_officer_id',
        'responsible_officer_ids', 'start_date', 'end_date',
        'travel_required', 'delegates_count', 'member_states', 'travel_services',
        'procurement_required', 'media_options',
        'submitted_at', 'approved_at', 'rejection_reason',
        // Venue
        'venue_country', 'venue_city', 'venue_proposed_hotel',
        'venue_accommodation_required', 'venue_accommodation_count',
        'venue_conferencing_required', 'venue_conferencing_participants',
        'venue_quotation_attached', 'venue_hotel_quotation_attached',
        'venue_accessibility_requirements', 'venue_security_considerations', 'venue_comments',
        // Budget / participant provisions
        'proposed_dsa_rate', 'original_budget_rate', 'dsa_variance_reason',
        'proposed_participants', 'budgeted_participants', 'participants_variance_reason',
        'proposed_funding_difference', 'estimated_activity_amount',
        // budget_availability_status and finance_comments are intentionally NOT
        // fillable here — they are only writable via ProgrammeController::updateFinanceReview()
        // Consultants
        'secretariat_staff_required', 'secretariat_staff_count',
        'consultants_required', 'consultants_count', 'consultants_rate',
        'resource_persons_required', 'resource_persons_count', 'resource_persons_rate',
        'rapporteurs_required', 'rapporteurs_count', 'rapporteurs_rate',
        'media_liaison_required', 'media_liaison_count',
        'local_support_required', 'local_support_count', 'local_support_rate',
        'personnel_comments',
        // Interpretation
        'interpretation_required',
        'en_fr_required', 'en_fr_interpreters_count',
        'en_pt_required', 'en_pt_interpreters_count',
        'fr_pt_required', 'fr_pt_interpreters_count',
        'interpreter_rate', 'interpreter_source', 'interpreter_source_other_note',
        'interpretation_equipment_required', 'translation_required',
        'languages_required', 'interpretation_comments',
        // Support services
        'support_services', 'support_services_other_note',
        // Conflict of interest (conflict_declared_by/at are set server-side only, still fillable
        // internally via ->update() calls made from the service, just excluded from controller validation)
        'conflict_declared', 'conflict_details', 'conflict_mitigation',
        'conflict_declared_by', 'conflict_declared_at',
        // Declaration
        'declaration_confirmed', 'declaration_confirmed_by',
        'declaration_confirmed_at', 'declaration_version',
        // Amendment tracking
        'amended_from_id', 'superseded_at',
    ];

    protected $casts = [
        'start_date'               => 'date',
        'end_date'                 => 'date',
        'submitted_at'             => 'datetime',
        'approved_at'              => 'datetime',
        'travel_required'          => 'boolean',
        'procurement_required'     => 'boolean',
        'exchange_rate'            => 'decimal:4',
        'contingency_pct'          => 'decimal:2',
        'total_budget'             => 'decimal:2',
        'strategic_alignment'      => 'array',
        'strategic_pillars'        => 'array',
        'implementing_departments' => 'array',
        'responsible_officer_ids'  => 'array',
        'funding_sources'          => 'array',
        'supporting_departments'   => 'array',
        'specific_objectives'      => 'array',
        'expected_outputs'        => 'array',
        'target_beneficiaries'     => 'array',
        'member_states'            => 'array',
        'travel_services'          => 'array',
        'media_options'            => 'array',
        'venue_accommodation_required'  => 'boolean',
        'venue_conferencing_required'   => 'boolean',
        'venue_quotation_attached'      => 'boolean',
        'venue_hotel_quotation_attached'=> 'boolean',
        'proposed_dsa_rate'             => 'decimal:2',
        'original_budget_rate'          => 'decimal:2',
        'proposed_funding_difference'   => 'decimal:2',
        'estimated_activity_amount'     => 'decimal:2',
        'secretariat_staff_required'    => 'boolean',
        'consultants_required'          => 'boolean',
        'consultants_rate'              => 'decimal:2',
        'resource_persons_required'     => 'boolean',
        'resource_persons_rate'         => 'decimal:2',
        'rapporteurs_required'          => 'boolean',
        'rapporteurs_rate'              => 'decimal:2',
        'media_liaison_required'        => 'boolean',
        'local_support_required'        => 'boolean',
        'local_support_rate'            => 'decimal:2',
        'interpretation_required'       => 'boolean',
        'en_fr_required'                => 'boolean',
        'en_pt_required'                => 'boolean',
        'fr_pt_required'                => 'boolean',
        'interpreter_rate'              => 'decimal:2',
        'interpretation_equipment_required' => 'boolean',
        'translation_required'          => 'boolean',
        'languages_required'            => 'array',
        'support_services'              => 'array',
        'conflict_declared'             => 'boolean',
        'conflict_declared_at'          => 'datetime',
        'declaration_confirmed'         => 'boolean',
        'declaration_confirmed_at'      => 'datetime',
        'superseded_at'                 => 'datetime',
    ];

    protected $appends = ['me_status'];

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function responsibleOfficer()
    {
        return $this->belongsTo(User::class, 'responsible_officer_id');
    }

    /** @return \Illuminate\Database\Eloquent\Collection<int, User> */
    public function responsibleOfficers()
    {
        $ids = $this->responsible_officer_ids ?? [];
        if (empty($ids)) {
            return User::query()->whereRaw('1 = 0')->get();
        }
        return User::whereIn('id', $ids)->get()->sortBy(fn (User $u) => array_search($u->id, $ids));
    }

    public function activities()
    {
        return $this->hasMany(ProgrammeActivity::class);
    }

    public function milestones()
    {
        return $this->hasMany(ProgrammeMilestone::class);
    }

    public function deliverables()
    {
        return $this->hasMany(ProgrammeDeliverable::class);
    }

    public function budgetLines()
    {
        return $this->hasMany(ProgrammeBudgetLine::class);
    }

    public function procurementItems()
    {
        return $this->hasMany(ProgrammeProcurementItem::class);
    }

    public function attachments()
    {
        return $this->morphMany(Attachment::class, 'attachable');
    }

    public function approvalRequest()
    {
        return $this->morphOne(ApprovalRequest::class, 'approvable');
    }

    public function conflictDeclaredBy()
    {
        return $this->belongsTo(User::class, 'conflict_declared_by');
    }

    public function declarationConfirmedBy()
    {
        return $this->belongsTo(User::class, 'declaration_confirmed_by');
    }

    public function documents()
    {
        return $this->hasMany(ProgrammeDocument::class);
    }

    public function arrivalDepartures()
    {
        return $this->hasMany(ProgrammeArrivalDeparture::class);
    }

    public function meActivityReport()
    {
        return $this->hasOne(MeActivityReport::class, 'programme_id');
    }

    /**
     * Soft-deleted MeActivityReport for this programme, if any. Eager-loaded
     * alongside meActivityReport() in ProgrammeService::list() so that
     * getMeStatusAttribute() never has to issue a per-row onlyTrashed()->exists()
     * query when serializing a list of programmes.
     */
    public function trashedMeActivityReport()
    {
        return $this->hasOne(MeActivityReport::class, 'programme_id')->onlyTrashed();
    }

    public function amendedFrom()
    {
        return $this->belongsTo(Programme::class, 'amended_from_id');
    }

    public function amendments()
    {
        return $this->hasMany(Programme::class, 'amended_from_id');
    }

    public function getMeStatusAttribute(): string
    {
        $report = $this->meActivityReport;

        if ($report) {
            if ($report->closure_status === 'closed' || $report->review_status === MeActivityReport::STATUS_CLOSED) {
                return 'closed';
            }
            return match ($report->review_status) {
                MeActivityReport::STATUS_NOT_SUBMITTED => $report->intake_confirmed_at
                    ? 'report_pending'
                    : 'intake_pending',
                MeActivityReport::STATUS_SUBMITTED     => 'report_submitted',
                MeActivityReport::STATUS_RETURNED      => 'returned_for_correction',
                MeActivityReport::STATUS_REVIEWED      => 'me_reviewed',
                MeActivityReport::STATUS_ACCEPTED      => 'accepted',
                MeActivityReport::STATUS_NOT_REPORTABLE => 'not_reportable',
                MeActivityReport::STATUS_CANCELLED      => 'cancelled_activity',
                default => 'link_unavailable',
            };
        }

        $wasLinked = $this->relationLoaded('trashedMeActivityReport')
            ? $this->trashedMeActivityReport !== null
            : MeActivityReport::onlyTrashed()->where('programme_id', $this->id)->exists();

        return $wasLinked ? 'linked_record_archived' : 'not_yet_linked';
    }

    public function isDraft(): bool { return $this->status === 'draft'; }
    public function isSubmitted(): bool { return $this->status === 'submitted'; }
    public function isApproved(): bool { return $this->status === 'approved'; }

    /**
     * An amended PIF (status = 'amended') is the current, approved version of
     * its activity after an amendment cycle completed. It should support the
     * same downstream actions as a normally-approved PIF (further amendment,
     * sending items to procurement). isApproved() intentionally still checks
     * only the literal 'approved' status for callers where that distinction
     * matters (e.g. surfacing whether this exact record is pending its first
     * approval) — use this helper wherever "approved" is meant to include
     * "approved via an amendment".
     */
    public function isApprovedOrAmended(): bool { return in_array($this->status, ['approved', 'amended'], true); }
}
