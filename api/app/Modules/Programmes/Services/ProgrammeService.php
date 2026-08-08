<?php
namespace App\Modules\Programmes\Services;

use App\Models\AuditLog;
use App\Models\Programme;
use App\Models\ProgrammeActivity;
use App\Models\ProgrammeArrivalDeparture;
use App\Models\ProgrammeBudgetLine;
use App\Models\ProgrammeDeliverable;
use App\Models\ProgrammeDocument;
use App\Models\ProgrammeMilestone;
use App\Models\ProgrammeProcurementItem;
use App\Models\ProcurementItem;
use App\Models\ProcurementRequest;
use App\Models\TravelMission;
use App\Models\TravelRequest;
use App\Models\User;
use Illuminate\Support\Str;
use App\Services\NotificationService;
use App\Services\WorkflowService;
use Barryvdh\DomPDF\Facade\Pdf;
use Endroid\QrCode\Builder\Builder;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

class ProgrammeService
{
    public function list(array $filters, User $user): LengthAwarePaginator
    {
        $query = Programme::with(['creator', 'approver', 'responsibleOfficer', 'budgetLines', 'meActivityReport', 'trashedMeActivityReport'])
            ->orderByDesc('created_at');

        // Deny-by-default list scope (PRD §23.4).
        app(\App\Modules\AccessControl\Services\AccessScopeResolver::class)
            ->constrainQuery($query, $user, 'created_by', ['module' => 'programme']);

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['search'])) {
            $query->where(function ($q) use ($filters) {
                $q->where('reference_number', 'ilike', "%{$filters['search']}%")
                  ->orWhere('title', 'ilike', "%{$filters['search']}%");
            });
        }

        return $query->paginate($filters['per_page'] ?? 20);
    }

    public function get(Programme $programme): Programme
    {
        return $programme->load([
            'creator', 'approver', 'responsibleOfficer',
            'activities', 'milestones', 'deliverables',
            'budgetLines', 'procurementItems',
            'documents', 'arrivalDepartures',
        ]);
    }

    public function create(array $data, User $user): Programme
    {
        $pillars = $this->normalizePillars($data);
        $departments = $this->normalizeDepartments($data);
        $officerIds = $this->normalizeResponsibleOfficerIds($data);
        $this->ensureResponsibleOfficersInTenant($officerIds, $user->tenant_id);
        $firstOfficerId = !empty($officerIds) ? (int) $officerIds[0] : null;

        $programme = Programme::create([
            'tenant_id'                => $user->tenant_id,
            'created_by'               => $user->id,
            'reference_number'         => Programme::generateReferenceNumber(),
            'status'                   => 'draft',
            'title'                    => $data['title'],
            'strategic_alignment'      => $data['strategic_alignment'] ?? null,
            'strategic_pillar'         => $pillars[0] ?? null,
            'strategic_pillars'        => $pillars,
            'implementing_department'  => $departments[0] ?? null,
            'implementing_departments' => $departments,
            'supporting_departments'   => $data['supporting_departments'] ?? null,
            'background'               => $data['background'] ?? null,
            'overall_objective'        => $data['overall_objective'] ?? null,
            'specific_objectives'      => $data['specific_objectives'] ?? null,
            'expected_outputs'        => $data['expected_outputs'] ?? null,
            'target_beneficiaries'     => $data['target_beneficiaries'] ?? null,
            'gender_considerations'   => $data['gender_considerations'] ?? null,
            'primary_currency'         => $data['primary_currency'] ?? 'USD',
            'base_currency'            => $data['base_currency'] ?? 'USD',
            'exchange_rate'            => $data['exchange_rate'] ?? 1,
            'contingency_pct'          => $data['contingency_pct'] ?? 10,
            'total_budget'             => $data['total_budget'] ?? 0,
            'funding_source'           => $data['funding_source'] ?? null,
            'funding_sources'          => $this->normalizeFundingSources($data),
            'responsible_officer_id'   => $firstOfficerId,
            'responsible_officer_ids'  => $officerIds,
            'start_date'               => $data['start_date'] ?? null,
            'end_date'                 => $data['end_date'] ?? null,
            'travel_required'          => $data['travel_required'] ?? false,
            'delegates_count'          => $data['delegates_count'] ?? null,
            'member_states'            => $data['member_states'] ?? null,
            'travel_services'          => $data['travel_services'] ?? null,
            'procurement_required'     => $data['procurement_required'] ?? false,
            'media_options'            => $data['media_options'] ?? null,
            // Venue
            'venue_country'                    => $data['venue_country'] ?? null,
            'venue_city'                        => $data['venue_city'] ?? null,
            'venue_proposed_hotel'              => $data['venue_proposed_hotel'] ?? null,
            'venue_accommodation_required'      => $data['venue_accommodation_required'] ?? false,
            'venue_accommodation_count'         => $data['venue_accommodation_count'] ?? null,
            'venue_conferencing_required'       => $data['venue_conferencing_required'] ?? false,
            'venue_conferencing_participants'   => $data['venue_conferencing_participants'] ?? null,
            'venue_quotation_attached'          => $data['venue_quotation_attached'] ?? false,
            'venue_hotel_quotation_attached'    => $data['venue_hotel_quotation_attached'] ?? false,
            'venue_accessibility_requirements'  => $data['venue_accessibility_requirements'] ?? null,
            'venue_security_considerations'     => $data['venue_security_considerations'] ?? null,
            'venue_comments'                     => $data['venue_comments'] ?? null,
            // Budget / participant provisions
            'proposed_dsa_rate'                  => $data['proposed_dsa_rate'] ?? null,
            'original_budget_rate'               => $data['original_budget_rate'] ?? null,
            'dsa_variance_reason'                => $data['dsa_variance_reason'] ?? null,
            'proposed_participants'              => $data['proposed_participants'] ?? null,
            'budgeted_participants'              => $data['budgeted_participants'] ?? null,
            'participants_variance_reason'       => $data['participants_variance_reason'] ?? null,
            'proposed_funding_difference'        => $data['proposed_funding_difference'] ?? null,
            'estimated_activity_amount'          => $data['estimated_activity_amount'] ?? null,
            // Consultants
            'secretariat_staff_required'         => $data['secretariat_staff_required'] ?? false,
            'secretariat_staff_count'            => $data['secretariat_staff_count'] ?? null,
            'consultants_required'               => $data['consultants_required'] ?? false,
            'consultants_count'                  => $data['consultants_count'] ?? null,
            'consultants_rate'                   => $data['consultants_rate'] ?? null,
            'resource_persons_required'          => $data['resource_persons_required'] ?? false,
            'resource_persons_count'             => $data['resource_persons_count'] ?? null,
            'resource_persons_rate'              => $data['resource_persons_rate'] ?? null,
            'rapporteurs_required'               => $data['rapporteurs_required'] ?? false,
            'rapporteurs_count'                  => $data['rapporteurs_count'] ?? null,
            'rapporteurs_rate'                   => $data['rapporteurs_rate'] ?? null,
            'media_liaison_required'             => $data['media_liaison_required'] ?? false,
            'media_liaison_count'                => $data['media_liaison_count'] ?? null,
            'local_support_required'             => $data['local_support_required'] ?? false,
            'local_support_count'                => $data['local_support_count'] ?? null,
            'local_support_rate'                 => $data['local_support_rate'] ?? null,
            'personnel_comments'                 => $data['personnel_comments'] ?? null,
            // Interpretation
            'interpretation_required'            => $data['interpretation_required'] ?? false,
            'en_fr_required'                     => $data['en_fr_required'] ?? false,
            'en_fr_interpreters_count'           => $data['en_fr_interpreters_count'] ?? null,
            'en_pt_required'                     => $data['en_pt_required'] ?? false,
            'en_pt_interpreters_count'           => $data['en_pt_interpreters_count'] ?? null,
            'fr_pt_required'                     => $data['fr_pt_required'] ?? false,
            'fr_pt_interpreters_count'           => $data['fr_pt_interpreters_count'] ?? null,
            'interpreter_rate'                   => $data['interpreter_rate'] ?? null,
            'interpreter_source'                 => $data['interpreter_source'] ?? null,
            'interpreter_source_other_note'      => $data['interpreter_source_other_note'] ?? null,
            'interpretation_equipment_required'  => $data['interpretation_equipment_required'] ?? false,
            'translation_required'               => $data['translation_required'] ?? false,
            'languages_required'                 => $data['languages_required'] ?? null,
            'interpretation_comments'            => $data['interpretation_comments'] ?? null,
            'support_services'                   => $data['support_services'] ?? null,
            'support_services_other_note'        => $data['support_services_other_note'] ?? null,
        ]);

        $this->syncSubRecords($programme, $data);

        $this->applyConflictDeclaration($programme, $data, $user);

        AuditLog::record('programme.created', [
            'auditable_type' => Programme::class,
            'auditable_id'   => $programme->id,
            'new_values'     => ['reference' => $programme->reference_number, 'title' => $programme->title],
            'tags'           => 'programme',
        ]);

        return $this->get($programme);
    }

    public function update(Programme $programme, array $data, User $user): Programme
    {
        // Amendment drafts ('amendment_draft') are edited through the same update()
        // flow as ordinary drafts — the amendment workflow (Task 16) reuses this
        // method so amendment content can be revised before submit-amendment/approve.
        if (!$programme->isDraft() && $programme->status !== 'amendment_draft') {
            throw ValidationException::withMessages(['status' => 'Only draft programmes can be edited.']);
        }

        $officerIds = (array_key_exists('responsible_officer_ids', $data) || array_key_exists('responsible_officer_id', $data))
            ? $this->normalizeResponsibleOfficerIds($data) : [];
        if (!empty($officerIds)) {
            $this->ensureResponsibleOfficersInTenant($officerIds, $user->tenant_id);
        }
        $firstOfficerId = !empty($officerIds) ? (int) $officerIds[0] : null;

        $updatePayload = array_filter([
            'title'                   => $data['title'] ?? null,
            'strategic_alignment'     => $data['strategic_alignment'] ?? null,
            'supporting_departments'  => $data['supporting_departments'] ?? null,
            'background'              => $data['background'] ?? null,
            'overall_objective'       => $data['overall_objective'] ?? null,
            'specific_objectives'     => $data['specific_objectives'] ?? null,
            'expected_outputs'        => $data['expected_outputs'] ?? null,
            'target_beneficiaries'    => $data['target_beneficiaries'] ?? null,
            'gender_considerations'   => $data['gender_considerations'] ?? null,
            'primary_currency'        => $data['primary_currency'] ?? null,
            'base_currency'           => $data['base_currency'] ?? null,
            'exchange_rate'           => $data['exchange_rate'] ?? null,
            'contingency_pct'          => $data['contingency_pct'] ?? null,
            'total_budget'            => $data['total_budget'] ?? null,
            'funding_source'          => $data['funding_source'] ?? null,
            'start_date'              => $data['start_date'] ?? null,
            'end_date'                => $data['end_date'] ?? null,
            'travel_required'         => $data['travel_required'] ?? null,
            'delegates_count'         => $data['delegates_count'] ?? null,
            'member_states'           => $data['member_states'] ?? null,
            'travel_services'         => $data['travel_services'] ?? null,
            'procurement_required'    => $data['procurement_required'] ?? null,
            'media_options'            => $data['media_options'] ?? null,
            // Venue
            'venue_country'                    => $data['venue_country'] ?? null,
            'venue_city'                        => $data['venue_city'] ?? null,
            'venue_proposed_hotel'              => $data['venue_proposed_hotel'] ?? null,
            'venue_accommodation_required'      => $data['venue_accommodation_required'] ?? null,
            'venue_accommodation_count'         => $data['venue_accommodation_count'] ?? null,
            'venue_conferencing_required'       => $data['venue_conferencing_required'] ?? null,
            'venue_conferencing_participants'   => $data['venue_conferencing_participants'] ?? null,
            'venue_quotation_attached'          => $data['venue_quotation_attached'] ?? null,
            'venue_hotel_quotation_attached'    => $data['venue_hotel_quotation_attached'] ?? null,
            'venue_accessibility_requirements'  => $data['venue_accessibility_requirements'] ?? null,
            'venue_security_considerations'     => $data['venue_security_considerations'] ?? null,
            'venue_comments'                     => $data['venue_comments'] ?? null,
            // Budget / participant provisions
            'proposed_dsa_rate'                  => $data['proposed_dsa_rate'] ?? null,
            'original_budget_rate'               => $data['original_budget_rate'] ?? null,
            'dsa_variance_reason'                => $data['dsa_variance_reason'] ?? null,
            'proposed_participants'              => $data['proposed_participants'] ?? null,
            'budgeted_participants'              => $data['budgeted_participants'] ?? null,
            'participants_variance_reason'       => $data['participants_variance_reason'] ?? null,
            'proposed_funding_difference'        => $data['proposed_funding_difference'] ?? null,
            'estimated_activity_amount'          => $data['estimated_activity_amount'] ?? null,
            // Consultants
            'secretariat_staff_required'         => $data['secretariat_staff_required'] ?? null,
            'secretariat_staff_count'            => $data['secretariat_staff_count'] ?? null,
            'consultants_required'               => $data['consultants_required'] ?? null,
            'consultants_count'                  => $data['consultants_count'] ?? null,
            'consultants_rate'                   => $data['consultants_rate'] ?? null,
            'resource_persons_required'          => $data['resource_persons_required'] ?? null,
            'resource_persons_count'             => $data['resource_persons_count'] ?? null,
            'resource_persons_rate'              => $data['resource_persons_rate'] ?? null,
            'rapporteurs_required'               => $data['rapporteurs_required'] ?? null,
            'rapporteurs_count'                  => $data['rapporteurs_count'] ?? null,
            'rapporteurs_rate'                   => $data['rapporteurs_rate'] ?? null,
            'media_liaison_required'             => $data['media_liaison_required'] ?? null,
            'media_liaison_count'                => $data['media_liaison_count'] ?? null,
            'local_support_required'             => $data['local_support_required'] ?? null,
            'local_support_count'                => $data['local_support_count'] ?? null,
            'local_support_rate'                 => $data['local_support_rate'] ?? null,
            'personnel_comments'                 => $data['personnel_comments'] ?? null,
            // Interpretation
            'interpretation_required'            => $data['interpretation_required'] ?? null,
            'en_fr_required'                     => $data['en_fr_required'] ?? null,
            'en_fr_interpreters_count'           => $data['en_fr_interpreters_count'] ?? null,
            'en_pt_required'                     => $data['en_pt_required'] ?? null,
            'en_pt_interpreters_count'           => $data['en_pt_interpreters_count'] ?? null,
            'fr_pt_required'                     => $data['fr_pt_required'] ?? null,
            'fr_pt_interpreters_count'           => $data['fr_pt_interpreters_count'] ?? null,
            'interpreter_rate'                   => $data['interpreter_rate'] ?? null,
            'interpreter_source'                 => $data['interpreter_source'] ?? null,
            'interpreter_source_other_note'      => $data['interpreter_source_other_note'] ?? null,
            'interpretation_equipment_required'  => $data['interpretation_equipment_required'] ?? null,
            'translation_required'               => $data['translation_required'] ?? null,
            'languages_required'                 => $data['languages_required'] ?? null,
            'interpretation_comments'            => $data['interpretation_comments'] ?? null,
            'support_services'                   => $data['support_services'] ?? null,
            'support_services_other_note'        => $data['support_services_other_note'] ?? null,
        ], fn ($v) => $v !== null);

        if (array_key_exists('strategic_pillars', $data)) {
            $pillars = $this->normalizePillars($data);
            $updatePayload['strategic_pillar'] = $pillars[0] ?? null;
            $updatePayload['strategic_pillars'] = $pillars;
        } elseif (array_key_exists('strategic_pillar', $data)) {
            $updatePayload['strategic_pillar'] = $data['strategic_pillar'];
        }
        if (array_key_exists('implementing_departments', $data)) {
            $depts = $this->normalizeDepartments($data);
            $updatePayload['implementing_department'] = $depts[0] ?? null;
            $updatePayload['implementing_departments'] = $depts;
        } elseif (array_key_exists('implementing_department', $data)) {
            $updatePayload['implementing_department'] = $data['implementing_department'];
        }
        if (array_key_exists('funding_sources', $data)) {
            $updatePayload['funding_sources'] = $this->normalizeFundingSources($data);
        }
        if (array_key_exists('responsible_officer_ids', $data) || array_key_exists('responsible_officer_id', $data)) {
            $updatePayload['responsible_officer_id'] = $firstOfficerId;
            $updatePayload['responsible_officer_ids'] = $officerIds;
        }

        $programme->update(array_filter($updatePayload, fn ($v) => $v !== null));

        $this->applyConflictDeclaration($programme, $data, $user);

        AuditLog::record('programme.updated', [
            'auditable_type' => Programme::class,
            'auditable_id'   => $programme->id,
            'tags'           => 'programme',
        ]);

        return $this->get($programme->fresh());
    }

    /**
     * Finance-only field update, restricted to programme.finance-review holders.
     *
     * finance_comments falls back to the Programme's existing value when the
     * request omits it, mirroring the DB-fallback pattern used for
     * conflict_details/conflict_mitigation (applyConflictDeclaration) and the
     * conditional companion fields in ProgrammeController::resulting(). This
     * is a single-purpose endpoint: Finance is expected to set
     * budget_availability_status repeatedly (e.g. moving from
     * 'partially_available' to 'available' as a budget line clears) without
     * necessarily resending the same comment each time. Unconditionally
     * nulling finance_comments whenever it's absent from the request would
     * silently wipe a previously-recorded comment on every status-only
     * update, which is surprising and destructive for a field that reads as
     * a running annotation rather than a value replaced wholesale each call.
     */
    public function updateFinanceReview(Programme $programme, array $data): Programme
    {
        // budget_availability_status and finance_comments are deliberately
        // excluded from Programme::$fillable (see the comment there) — this
        // is the only writer for them, so forceFill() bypasses the mass-
        // assignment guard intentionally, rather than widening $fillable.
        $status = $data['budget_availability_status'];

        $programme->forceFill([
            'budget_availability_status' => $status,
            'finance_comments'           => array_key_exists('finance_comments', $data)
                ? $data['finance_comments']
                : $programme->finance_comments,
        ])->save();

        $this->syncPifBudgetCommitment($programme, $status, $data);

        AuditLog::record('programme.finance_review_updated', [
            'auditable_type' => Programme::class,
            'auditable_id'   => $programme->id,
            'new_values'     => ['budget_availability_status' => $status],
            'tags'           => 'programme,budget',
        ]);

        return $programme->fresh();
    }

    /**
     * Finance certification creates/confirms a PIF commitment; insufficient /
     * unavailable statuses release any open PIF commitment.
     */
    private function syncPifBudgetCommitment(Programme $programme, string $status, array $data): void
    {
        $actor = auth()->user();
        if (! $actor) {
            return;
        }

        $commitments = app(\App\Modules\Budget\Services\BudgetCommitmentService::class);
        $sourceKey = 'PIF:'.$programme->id;
        $existing = $commitments->findBySourceKey((int) $programme->tenant_id, $sourceKey);

        $certified = in_array($status, ['available', 'confirmed_with_conditions'], true);
        if (! $certified) {
            if ($existing) {
                $commitments->release($existing, $actor, 'PIF finance status: '.$status);
            }

            return;
        }

        $programme->loadMissing('budgetLines');
        $lineId = $data['budget_line_id']
            ?? $programme->budgetLines->first(fn ($l) => $l->org_budget_line_id)?->org_budget_line_id
            ?? null;

        if (! $lineId) {
            // Certification without an institutional line remains a status-only review.
            return;
        }

        $amount = isset($data['commitment_amount'])
            ? (float) $data['commitment_amount']
            : (float) ($programme->total_budget ?: $programme->budgetLines->sum('amount'));

        if ($amount <= 0) {
            return;
        }

        if ($existing) {
            if ((int) $existing->budget_line_id !== (int) $lineId) {
                $commitments->release($existing, $actor, 'PIF budget line changed');
                $existing = null;
            } else {
                $commitments->adjust($existing, $amount, $actor, 'PIF finance re-certification');
                $commitments->confirm($existing->fresh(), $actor);

                return;
            }
        }

        $commitments->reserve([
            'tenant_id' => $programme->tenant_id,
            'budget_line_id' => (int) $lineId,
            'amount' => $amount,
            'source_type' => 'pif',
            'source_id' => $programme->id,
            'source_key' => $sourceKey,
            'currency' => 'NAD',
            'notes' => $data['finance_comments'] ?? 'PIF finance certification',
            'programme_id' => $programme->id,
            'idempotency_key' => 'pif-cert-'.$programme->id,
            'confirm' => true,
        ], $actor);
    }

    public function submit(Programme $programme, User $user): Programme
    {
        if (!$programme->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Only draft programmes can be submitted.']);
        }

        $programme->update([
            'status'                    => 'submitted',
            'submitted_at'              => now(),
            'declaration_confirmed'     => true,
            'declaration_confirmed_by'  => $user->id,
            'declaration_confirmed_at'  => now(),
            'declaration_version'       => config('pif.current_declaration_version'),
        ]);

        AuditLog::record('programme.submitted', [
            'auditable_type' => Programme::class,
            'auditable_id'   => $programme->id,
            'tags'           => 'programme',
        ]);

        AuditLog::record('programme.declaration_confirmed', [
            'auditable_type' => Programme::class,
            'auditable_id'   => $programme->id,
            'new_values'     => ['declaration_version' => config('pif.current_declaration_version')],
            'tags'           => 'programme',
        ]);

        // Migrate PIF onto shared Workflow Engine (PRD §80 / §111) — no parallel engine
        try {
            app(WorkflowService::class)->initiate(
                $programme->fresh(),
                'programmes',
                $user,
                'pif-submit-'.$programme->id.'-'.($programme->fresh()->submitted_at?->timestamp ?? time()),
                [
                    'amount' => $programme->total_budget ?? null,
                    'currency' => $programme->currency ?? 'NAD',
                    'department_id' => $user->department_id,
                ]
            );
        } catch (\Throwable $e) {
            report($e);
        }

        return $programme->fresh();
    }

    /**
     * Finalizes an approved programme (or amendment). This is invoked in two
     * ways only, never called directly by a controller for a request that has
     * an active workflow:
     *  1. As the WorkflowService finalization hook via Programme::onWorkflowApproved()
     *     once every workflow step has been completed — WorkflowService::verifyActorCanApprove()
     *     has already authorised the final actor (including the Secretary
     *     General's own-request carve-out) by the time this runs, so no
     *     self-approval check belongs here — re-checking it here would
     *     incorrectly block a legitimately-authorised SG self-approval.
     *  2. As a legacy fallback by ProgrammeController::approve()/reject() for
     *     the rare record with no ApprovalRequest (e.g. pre-workflow-engine
     *     data) — the controller performs the self-approval check itself
     *     before reaching this method in that path.
     */
    public function approve(Programme $programme, User $approver): Programme
    {
        $isAmendment = $programme->status === 'amendment_pending_approval';

        if (!$isAmendment && !$programme->isSubmitted()) {
            throw ValidationException::withMessages(['status' => 'Only submitted programmes can be approved.']);
        }

        $programme->update([
            'status'      => $isAmendment ? 'amended' : 'approved',
            'approved_by' => $approver->id,
            'approved_at' => now(),
        ]);

        if ($isAmendment && $programme->amended_from_id) {
            $programme->amendedFrom?->update(['status' => 'superseded', 'superseded_at' => now()]);
            AuditLog::record('programme.superseded', [
                'auditable_type' => Programme::class,
                'auditable_id'   => $programme->amended_from_id,
                'tags'           => 'programme',
            ]);
        }

        AuditLog::record($isAmendment ? 'programme.amendment_approved' : 'programme.approved', [
            'auditable_type' => Programme::class,
            'auditable_id'   => $programme->id,
            'tags'           => 'programme',
        ]);

        $this->notifyMeOfPifApproval($programme);

        try {
            $settings = app(\App\Modules\MAndE\Services\MeSettingsService::class)
                ->forTenant((int) $programme->tenant_id);
            if ($settings->auto_intake) {
                app(\App\Modules\MAndE\Services\MeIntakeService::class)
                    ->ensureForProgramme($programme->fresh(), $approver);
            }
        } catch (\Throwable $e) {
            // Intake must not roll back PIF approval; log and continue.
            report($e);
        }

        return $programme->fresh(['creator', 'approver']);
    }

    public function createAmendment(Programme $original, User $user): Programme
    {
        if (!$original->isApprovedOrAmended()) {
            throw ValidationException::withMessages(['status' => 'Only approved programmes can be amended.']);
        }

        $openAmendmentExists = Programme::where('amended_from_id', $original->id)
            ->whereIn('status', ['amendment_draft', 'amendment_pending_approval'])
            ->exists();
        if ($openAmendmentExists) {
            throw ValidationException::withMessages(['amendment' => 'An open amendment already exists for this PIF.']);
        }

        $revisionCount = Programme::where('amended_from_id', $original->id)->count() + 1;

        // Cloned attributes are derived from Programme::$fillable rather than a hand-
        // maintained inclusion list, so newly-added fillable fields are cloned onto
        // amendments automatically instead of silently drifting out of sync (this list
        // previously missed several fields as new ones were added). Only the fields
        // below are excluded, each because cloning them would be wrong for a new
        // approval cycle:
        $excludedFromClone = [
            // Bookkeeping / identity — set explicitly below or by Programme::create()
            'id', 'created_by', 'approved_by', 'reference_number', 'title', 'status',
            // Reset for the new approval cycle
            'submitted_at', 'approved_at', 'rejection_reason',
            'amended_from_id', 'superseded_at',
            // Conflict-of-interest — an amendment is a new approval cycle and must go
            // through its own conflict declaration before it can be submitted/approved
            'conflict_declared', 'conflict_details', 'conflict_mitigation',
            'conflict_declared_by', 'conflict_declared_at',
            // Declaration — must be re-confirmed for the amendment's own submission
            'declaration_confirmed', 'declaration_confirmed_by',
            'declaration_confirmed_at', 'declaration_version',
        ];

        $attributes = $original->only(array_diff($original->getFillable(), $excludedFromClone));

        $amendment = Programme::create(array_merge($attributes, [
            'created_by'        => $user->id,
            'reference_number'  => "{$original->reference_number}-A{$revisionCount}",
            'title'             => $original->title,
            'status'            => 'amendment_draft',
            'amended_from_id'   => $original->id,
        ]));

        foreach ($original->documents as $doc) {
            $amendment->documents()->create($doc->only([
                'title', 'document_type', 'word_count', 'translation_required', 'source_language',
                'target_languages', 'owner_user_id', 'owner_name', 'owner_organisation', 'deadline',
                'budget_line', 'comments',
            ]));
        }
        foreach ($original->arrivalDepartures as $row) {
            $amendment->arrivalDepartures()->create($row->only([
                'category', 'arrival_date', 'departure_date', 'airport', 'flight_details',
                'transport_required', 'accommodation_required', 'comments',
            ]));
        }
        foreach ($original->procurementItems as $item) {
            $amendment->procurementItems()->create($item->only([
                'description', 'estimated_cost', 'method', 'vendor', 'delivery_date', 'currency', 'rfq_required',
                // procurement_request_id intentionally excluded — re-evaluated for the amendment
            ]));
        }

        AuditLog::record('programme.amendment_created', [
            'auditable_type' => Programme::class,
            'auditable_id'   => $amendment->id,
            'new_values'     => ['amended_from_id' => $original->id],
            'tags'           => 'programme',
        ]);

        return $amendment->fresh(['documents', 'arrivalDepartures', 'procurementItems']);
    }

    public function submitAmendment(Programme $amendment, User $user): Programme
    {
        if ($amendment->status !== 'amendment_draft') {
            throw ValidationException::withMessages(['status' => 'Only an amendment draft can be submitted.']);
        }
        $amendment->update([
            'status'                    => 'amendment_pending_approval',
            'submitted_at'              => now(),
            'declaration_confirmed'     => true,
            'declaration_confirmed_by'  => $user->id,
            'declaration_confirmed_at'  => now(),
            'declaration_version'       => config('pif.current_declaration_version'),
        ]);

        // Amendments are a fresh approval cycle and must go through the same
        // sequential workflow as the original PIF (PRD §80/§111) — without
        // this, an amendment had no ApprovalRequest at all and approval fell
        // straight to the legacy direct-write path.
        try {
            app(WorkflowService::class)->initiate(
                $amendment->fresh(),
                'programmes',
                $user,
                'pif-amendment-submit-'.$amendment->id.'-'.($amendment->fresh()->submitted_at?->timestamp ?? time()),
                [
                    'amount' => $amendment->total_budget ?? null,
                    'currency' => $amendment->currency ?? 'NAD',
                    'department_id' => $user->department_id,
                ]
            );
        } catch (\Throwable $e) {
            report($e);
        }

        return $amendment->fresh();
    }

    public function diff(Programme $amendment): array
    {
        if (!$amendment->amended_from_id) {
            return [];
        }
        $original = $amendment->amendedFrom;
        $fields = array_diff($amendment->getFillable(), ['id', 'created_at', 'updated_at', 'amended_from_id', 'status', 'reference_number']);

        $diff = [];
        foreach ($fields as $field) {
            $before = $original->{$field};
            $after  = $amendment->{$field};
            if ($before != $after) {
                $diff[$field] = ['before' => $before, 'after' => $after];
            }
        }
        return $diff;
    }

    /**
     * Notify all responsible officers and M&E intake staff when a PIF is approved.
     * Wrapped so that notification-layer failures never turn a successful approval into an error response.
     */
    private function notifyMeOfPifApproval(Programme $programme): void
    {
        try {
            $notifier = app(NotificationService::class);
            $vars = ['reference' => $programme->reference_number, 'title' => $programme->title];

            $officers = $programme->responsibleOfficers();
            if ($officers->isEmpty() && $programme->responsible_officer_id) {
                // Legacy fallback: programmes created/updated outside the normal service flow
                // (e.g. seeded directly) may only have the single legacy column populated.
                $legacyOfficer = User::find($programme->responsible_officer_id);
                if ($legacyOfficer) {
                    $officers = collect([$legacyOfficer]);
                }
            }

            foreach ($officers as $officer) {
                $notifier->dispatch(
                    $officer,
                    'programme.approved_for_me',
                    array_merge($vars, ['name' => $officer->name]),
                    [
                        'module' => 'programme',
                        'record_id' => $programme->id,
                        'url' => '/pif/' . $programme->id,
                        'secure_route' => '/pif/' . $programme->id,
                        'idempotency_key' => 'programme.approved_for_me:'.$programme->id.':user:'.$officer->id,
                    ]
                );
            }

            $meOfficers = User::where('tenant_id', $programme->tenant_id)
                ->permission('mande.create')
                ->get();

            $notifier->dispatchToMany(
                $meOfficers,
                'programme.me_intake_available',
                $vars,
                [
                    'module' => 'mande',
                    'record_id' => $programme->id,
                    'url' => '/mande/pif-linkages',
                    'secure_route' => '/mande/pif-linkages',
                    'idempotency_key' => 'programme.me_intake_available:'.$programme->id,
                ]
            );
        } catch (Throwable) {
            // Never block the approval flow due to notification failures
        }
    }

    public function reject(Programme $programme, string $reason, User $approver): Programme
    {
        if (!$programme->isSubmitted()) {
            throw ValidationException::withMessages(['status' => 'Only submitted programmes can be rejected.']);
        }

        $programme->update([
            'status'           => 'rejected',
            'approved_by'      => $approver->id,
            'rejection_reason' => $reason,
        ]);

        AuditLog::record('programme.rejected', [
            'auditable_type' => Programme::class,
            'auditable_id'   => $programme->id,
            'new_values'     => ['reason' => $reason],
            'tags'           => 'programme',
        ]);

        return $programme->fresh();
    }

    public function delete(Programme $programme): void
    {
        if (!$programme->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Only draft programmes can be deleted.']);
        }
        $programme->delete();
    }

    // --- Sub-resource: Activities ---

    public function addActivity(Programme $programme, array $data): ProgrammeActivity
    {
        return $programme->activities()->create($data);
    }

    public function updateActivity(ProgrammeActivity $activity, array $data): ProgrammeActivity
    {
        $activity->update($data);
        return $activity->fresh();
    }

    public function deleteActivity(ProgrammeActivity $activity): void
    {
        $activity->delete();
    }

    // --- Sub-resource: Milestones ---

    public function addMilestone(Programme $programme, array $data): ProgrammeMilestone
    {
        return $programme->milestones()->create($data);
    }

    public function updateMilestone(ProgrammeMilestone $milestone, array $data): ProgrammeMilestone
    {
        $milestone->update($data);
        return $milestone->fresh();
    }

    public function deleteMilestone(ProgrammeMilestone $milestone): void
    {
        $milestone->delete();
    }

    // --- Sub-resource: Deliverables ---

    public function addDeliverable(Programme $programme, array $data): ProgrammeDeliverable
    {
        return $programme->deliverables()->create($data);
    }

    public function updateDeliverable(ProgrammeDeliverable $deliverable, array $data): ProgrammeDeliverable
    {
        $deliverable->update($data);
        return $deliverable->fresh();
    }

    public function deleteDeliverable(ProgrammeDeliverable $deliverable): void
    {
        $deliverable->delete();
    }

    // --- Sub-resource: Budget Lines ---

    public function addBudgetLine(Programme $programme, array $data): ProgrammeBudgetLine
    {
        return $programme->budgetLines()->create($data);
    }

    public function updateBudgetLine(ProgrammeBudgetLine $line, array $data): ProgrammeBudgetLine
    {
        $line->update($data);
        return $line->fresh();
    }

    public function deleteBudgetLine(ProgrammeBudgetLine $line): void
    {
        $line->delete();
    }

    // --- Sub-resource: Procurement Items ---

    public function addProcurementItem(Programme $programme, array $data): ProgrammeProcurementItem
    {
        return $programme->procurementItems()->create($data);
    }

    public function updateProcurementItem(ProgrammeProcurementItem $item, array $data): ProgrammeProcurementItem
    {
        $item->update($data);
        return $item->fresh();
    }

    public function deleteProcurementItem(ProgrammeProcurementItem $item): void
    {
        $item->delete();
    }

    /**
     * Batch-transfers a set of approved PIF procurement items into a single
     * ProcurementRequest. Wrapped in a DB transaction: this creates one
     * ProcurementRequest, one ProcurementItem per selected row, and updates
     * each ProgrammeProcurementItem's procurement_request_id link. Without a
     * transaction, a failure partway through the loop (e.g. a DB error on
     * item N) would leave a ProcurementRequest linked to only some of the
     * intended items — a partial, inconsistent transfer with no rollback.
     * Since this endpoint's whole purpose is creating multiple related rows
     * atomically, that partial-failure state is unacceptable.
     */
    public function sendToProcurement(Programme $programme, array $data, User $user): ProcurementRequest
    {
        if (!$programme->isApprovedOrAmended()) {
            throw ValidationException::withMessages(['status' => 'Only approved programmes can send items to procurement.']);
        }

        $items = $programme->procurementItems()->whereIn('id', $data['procurement_item_ids'])->get();

        $alreadyLinked = $items->whereNotNull('procurement_request_id');
        if ($alreadyLinked->isNotEmpty()) {
            abort(409, 'One or more selected items have already been sent to procurement.');
        }

        $procurementRequest = DB::transaction(function () use ($programme, $data, $user, $items) {
            $estimatedValue = $items->sum(fn (ProgrammeProcurementItem $item) => (float) $item->estimated_cost);

            $procurementRequest = ProcurementRequest::create([
                'tenant_id'        => $programme->tenant_id,
                'requester_id'     => $user->id,
                'programme_id'     => $programme->id,
                'title'            => $data['request_title'],
                'description'      => 'Generated from approved PIF ' . $programme->reference_number,
                'category'         => $data['category'] ?? 'goods',
                'estimated_value'  => $estimatedValue,
                'status'           => 'draft',
                'currency'         => $programme->primary_currency ?? 'USD',
                'budget_line'      => $programme->reference_number,
            ]);

            foreach ($items as $item) {
                ProcurementItem::create([
                    'procurement_request_id' => $procurementRequest->id,
                    'description'             => $item->description,
                    'quantity'                => 1,
                    'unit'                    => 'item',
                    'estimated_unit_price'    => $item->estimated_cost,
                    'total_price'             => $item->estimated_cost,
                ]);
                $item->update(['procurement_request_id' => $procurementRequest->id]);
            }

            return $procurementRequest;
        });

        AuditLog::record('programme.procurement_sent', [
            'auditable_type' => Programme::class,
            'auditable_id'   => $programme->id,
            'new_values'     => [
                'procurement_item_ids'   => $data['procurement_item_ids'],
                'procurement_request_id' => $procurementRequest->id,
            ],
            'tags' => 'programme',
        ]);

        return $procurementRequest->fresh();
    }

    /**
     * Create one draft TravelRequest per selected traveller, prefilling from the approved PIF.
     *
     * @return list<TravelRequest>
     */
    public function sendToTravel(Programme $programme, array $data, User $user): array
    {
        if (! $programme->isApprovedOrAmended()) {
            throw ValidationException::withMessages(['status' => 'Only approved programmes can send travellers to travel.']);
        }

        $travellerIds = array_values(array_unique($data['traveller_ids'] ?? []));
        if (empty($travellerIds)) {
            throw ValidationException::withMessages(['traveller_ids' => 'Select at least one traveller.']);
        }

        $travellers = User::where('tenant_id', $programme->tenant_id)
            ->whereIn('id', $travellerIds)
            ->get();

        if ($travellers->count() !== count($travellerIds)) {
            throw ValidationException::withMessages(['traveller_ids' => 'One or more travellers are invalid for this tenant.']);
        }

        $missionId = $data['mission_id'] ?? null;
        if (! $missionId && ! empty($data['mission_title'])) {
            $mission = TravelMission::create([
                'tenant_id'           => $programme->tenant_id,
                'title'               => $data['mission_title'],
                'programme_id'        => $programme->id,
                'destination_country' => $data['destination_country'] ?? $programme->venue_country ?? null,
                'destination_city'    => $data['destination_city'] ?? $programme->venue_city ?? null,
                'start_date'          => $data['departure_date'] ?? $programme->start_date ?? null,
                'end_date'            => $data['return_date'] ?? $programme->end_date ?? null,
                'created_by'          => $user->id,
            ]);
            $missionId = $mission->id;
        }

        $created = [];
        DB::transaction(function () use ($programme, $data, $user, $travellers, $missionId, &$created) {
            foreach ($travellers as $traveller) {
                $travel = TravelRequest::create([
                    'tenant_id'           => $programme->tenant_id,
                    'requester_id'        => $traveller->id,
                    'prepared_by'         => $user->id,
                    'prepared_on_behalf_of' => (int) $traveller->id !== (int) $user->id ? $traveller->id : null,
                    'reference_number'    => 'TRV-' . strtoupper(Str::random(8)),
                    'purpose'             => $data['purpose'] ?? ('Mission travel — ' . ($programme->title ?? $programme->reference_number)),
                    'status'              => 'draft',
                    'departure_date'      => $data['departure_date'] ?? ($programme->start_date?->toDateString() ?? now()->addDays(14)->toDateString()),
                    'return_date'         => $data['return_date'] ?? ($programme->end_date?->toDateString() ?? now()->addDays(17)->toDateString()),
                    'destination_country' => $data['destination_country'] ?? $programme->venue_country ?? 'Namibia',
                    'destination_city'    => $data['destination_city'] ?? $programme->venue_city ?? null,
                    'programme_id'        => $programme->id,
                    'mission_id'          => $missionId,
                    'host_organization'   => $programme->funding_source ?? null,
                    'budget_line_id'      => $programme->budgetLines()->value('id'),
                    'justification'       => 'Prefill from approved PIF ' . $programme->reference_number,
                    'currency'            => $programme->primary_currency ?? 'USD',
                    'cabin_class'         => config('travel.default_cabin_class', 'economy'),
                    'estimated_dsa'       => $programme->proposed_dsa_rate ?? 0,
                ]);

                $created[] = $travel->load(['requester', 'programme', 'mission']);
            }
        });

        AuditLog::record('programme.travel_sent', [
            'auditable_type' => Programme::class,
            'auditable_id'   => $programme->id,
            'new_values'     => [
                'traveller_ids' => $travellerIds,
                'travel_ids'    => collect($created)->pluck('id')->all(),
                'mission_id'    => $missionId,
            ],
            'tags' => 'programme,travel',
        ]);

        return $created;
    }

    // --- Sub-resource: Documents ---

    public function addDocument(Programme $programme, array $data): ProgrammeDocument
    {
        $document = $programme->documents()->create($data);

        AuditLog::record('programme.document_added', [
            'auditable_type' => Programme::class,
            'auditable_id'   => $programme->id,
            'new_values'     => ['document_id' => $document->id, 'title' => $document->title],
            'tags'           => 'programme',
        ]);

        return $document;
    }

    public function updateDocument(ProgrammeDocument $document, array $data): ProgrammeDocument
    {
        $document->update($data);
        return $document->fresh();
    }

    public function deleteDocument(ProgrammeDocument $document): void
    {
        AuditLog::record('programme.document_removed', [
            'auditable_type' => Programme::class,
            'auditable_id'   => $document->programme_id,
            'new_values'     => ['document_id' => $document->id],
            'tags'           => 'programme',
        ]);

        $document->delete();
    }

    // --- Sub-resource: Arrival/Departure ---

    public function addArrivalDeparture(Programme $programme, array $data): ProgrammeArrivalDeparture
    {
        $row = $programme->arrivalDepartures()->create($data);

        AuditLog::record('programme.arrival_departure_added', [
            'auditable_type' => Programme::class,
            'auditable_id'   => $programme->id,
            'new_values'     => ['arrival_departure_id' => $row->id, 'category' => $row->category],
            'tags'           => 'programme',
        ]);

        return $row;
    }

    public function updateArrivalDeparture(ProgrammeArrivalDeparture $row, array $data): ProgrammeArrivalDeparture
    {
        $row->update($data);
        return $row->fresh();
    }

    public function deleteArrivalDeparture(ProgrammeArrivalDeparture $row): void
    {
        AuditLog::record('programme.arrival_departure_removed', [
            'auditable_type' => Programme::class,
            'auditable_id'   => $row->programme_id,
            'new_values'     => ['arrival_departure_id' => $row->id],
            'tags'           => 'programme',
        ]);

        $row->delete();
    }

    /**
     * Applies conflict-of-interest fields, stamping declared_by/declared_at
     * server-side from the acting user — never from the request payload.
     *
     * conflict_details/conflict_mitigation fall back to the Programme's
     * existing values when the request doesn't include them, so that a later,
     * unrelated partial update (e.g. one that only resends conflict_declared)
     * doesn't silently wipe previously-recorded conflict details.
     */
    private function applyConflictDeclaration(Programme $programme, array $data, User $user): void
    {
        if (!array_key_exists('conflict_declared', $data)
            && !array_key_exists('conflict_details', $data)
            && !array_key_exists('conflict_mitigation', $data)
        ) {
            return;
        }

        $wasDeclared = (bool) $programme->conflict_declared;
        $nowDeclared = array_key_exists('conflict_declared', $data)
            ? (bool) $data['conflict_declared']
            : $wasDeclared;

        $payload = [
            'conflict_declared'   => $nowDeclared,
            'conflict_details'    => $data['conflict_details'] ?? $programme->conflict_details ?? null,
            'conflict_mitigation' => $data['conflict_mitigation'] ?? $programme->conflict_mitigation ?? null,
        ];

        if ($nowDeclared && !$wasDeclared) {
            $payload['conflict_declared_by'] = $user->id;
            $payload['conflict_declared_at'] = now();

            AuditLog::record('programme.conflict_declared', [
                'auditable_type' => Programme::class,
                'auditable_id'   => $programme->id,
                'tags'           => 'programme',
            ]);
        } elseif ($nowDeclared && $wasDeclared) {
            AuditLog::record('programme.conflict_amended', [
                'auditable_type' => Programme::class,
                'auditable_id'   => $programme->id,
                'tags'           => 'programme',
            ]);
        }

        $programme->update($payload);
    }

    /**
     * Renders the full Programme Implementation Form as a PDF, embedding a
     * verification QR code and the approval history (if a workflow has been
     * started for this Programme — a draft/never-submitted Programme has no
     * ApprovalRequest yet, so the history is simply empty in that case).
     */
    public function generatePdf(Programme $programme): \Barryvdh\DomPDF\PDF
    {
        $programme->load(['creator', 'approver', 'responsibleOfficer', 'attachments.uploader', 'conflictDeclaredBy']);

        $verifyUrl = config('app.url') . '/pif/verify/' . $programme->id;
        $qrResult  = Builder::create()->data($verifyUrl)->size(90)->build();
        $qrBase64  = base64_encode($qrResult->getString());

        $approvalRequest = $programme->approvalRequest;
        $approvalHistory = $approvalRequest
            ? (app(WorkflowService::class)->snapshot($approvalRequest)['history'] ?? [])
            : [];

        return Pdf::loadView('pdf.programme', [
            'programme'       => $programme,
            'attachments'     => $programme->attachments,
            'approvalHistory' => $approvalHistory,
            'qrBase64'        => $qrBase64,
            'verifyUrl'       => $verifyUrl,
        ])->setPaper('a4');
    }

    // --- Private helpers ---

    private function syncSubRecords(Programme $programme, array $data): void
    {
        if (!empty($data['activities'])) {
            foreach ($data['activities'] as $row) {
                $programme->activities()->create($row);
            }
        }
        if (!empty($data['milestones'])) {
            foreach ($data['milestones'] as $row) {
                $programme->milestones()->create($row);
            }
        }
        if (!empty($data['deliverables'])) {
            foreach ($data['deliverables'] as $row) {
                $programme->deliverables()->create($row);
            }
        }
        if (!empty($data['budget_lines'])) {
            foreach ($data['budget_lines'] as $row) {
                $programme->budgetLines()->create($row);
            }
        }
        if (!empty($data['procurement_items'])) {
            foreach ($data['procurement_items'] as $row) {
                $programme->procurementItems()->create($row);
            }
        }
    }

    private function ensureResponsibleOfficerInTenant(?int $userId, int $tenantId): void
    {
        if ($userId === null) {
            return;
        }
        $assigned = User::where('id', $userId)->where('tenant_id', $tenantId)->exists();
        if (!$assigned) {
            throw ValidationException::withMessages([
                'responsible_officer_id' => ['The selected responsible officer must be a user in your organisation.'],
            ]);
        }
    }

    private function ensureResponsibleOfficersInTenant(array $userIds, int $tenantId): void
    {
        if (empty($userIds)) {
            return;
        }
        $ids = array_map('intval', array_values($userIds));
        $found = User::whereIn('id', $ids)->where('tenant_id', $tenantId)->pluck('id')->all();
        $missing = array_diff($ids, $found);
        if (!empty($missing)) {
            throw ValidationException::withMessages([
                'responsible_officer_ids' => ['One or more selected responsible officers are not in your organisation.'],
            ]);
        }
    }

    /** @return array<int, string> */
    private function normalizePillars(array $data): array
    {
        if (!empty($data['strategic_pillars']) && is_array($data['strategic_pillars'])) {
            return array_values(array_filter(array_map('trim', $data['strategic_pillars'])));
        }
        if (!empty($data['strategic_pillar'])) {
            return [trim((string) $data['strategic_pillar'])];
        }
        return [];
    }

    /** @return array<int, string> */
    private function normalizeDepartments(array $data): array
    {
        if (!empty($data['implementing_departments']) && is_array($data['implementing_departments'])) {
            return array_values(array_filter(array_map('trim', $data['implementing_departments'])));
        }
        if (!empty($data['implementing_department'])) {
            return [trim((string) $data['implementing_department'])];
        }
        return [];
    }

    /** @return array<int, int> */
    private function normalizeResponsibleOfficerIds(array $data): array
    {
        if (!empty($data['responsible_officer_ids']) && is_array($data['responsible_officer_ids'])) {
            return array_values(array_map('intval', array_filter($data['responsible_officer_ids'])));
        }
        if (isset($data['responsible_officer_id']) && $data['responsible_officer_id'] !== null && $data['responsible_officer_id'] !== '') {
            return [(int) $data['responsible_officer_id']];
        }
        return [];
    }

    /** @return array<int, array{name: string, budget_amount?: float, pays_for?: string}> */
    private function normalizeFundingSources(array $data): array
    {
        if (empty($data['funding_sources']) || !is_array($data['funding_sources'])) {
            return [];
        }
        $out = [];
        foreach ($data['funding_sources'] as $row) {
            if (empty($row['name']) || !is_string($row['name'])) {
                continue;
            }
            $out[] = [
                'name'          => trim($row['name']),
                'budget_amount' => isset($row['budget_amount']) ? (float) $row['budget_amount'] : null,
                'pays_for'      => isset($row['pays_for']) ? trim((string) $row['pays_for']) : null,
            ];
        }
        return $out;
    }
}
