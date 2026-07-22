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
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Validation\ValidationException;
use Throwable;

class ProgrammeService
{
    public function list(array $filters, User $user): LengthAwarePaginator
    {
        $query = Programme::with(['creator', 'approver', 'responsibleOfficer', 'budgetLines', 'meActivityReport', 'trashedMeActivityReport'])
            ->orderByDesc('created_at');

        if ($user->hasRole('staff')) {
            $query->where('created_by', $user->id);
        }

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
        ]);
    }

    public function create(array $data, User $user): Programme
    {
        $pillars = $this->normalizePillars($data);
        $departments = $this->normalizeDepartments($data);
        $officerIds = $this->normalizeResponsibleOfficerIds($data);
        $this->ensureResponsibleOfficersInTenant($officerIds, $user->tenant_id);
        $firstOfficerId = !empty($officerIds) ? (int) $officerIds[0] : null;

        $year = now()->year;
        $count = Programme::whereYear('created_at', $year)->count() + 1;
        $ref = 'PIF-' . $year . '-' . str_pad($count, 3, '0', STR_PAD_LEFT);

        $programme = Programme::create([
            'tenant_id'                => $user->tenant_id,
            'created_by'               => $user->id,
            'reference_number'         => $ref,
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
        if (!$programme->isDraft()) {
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
        $programme->forceFill([
            'budget_availability_status' => $data['budget_availability_status'],
            'finance_comments'           => array_key_exists('finance_comments', $data)
                ? $data['finance_comments']
                : $programme->finance_comments,
        ])->save();

        AuditLog::record('programme.finance_review_updated', [
            'auditable_type' => Programme::class,
            'auditable_id'   => $programme->id,
            'new_values'     => ['budget_availability_status' => $data['budget_availability_status']],
            'tags'           => 'programme',
        ]);

        return $programme->fresh();
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

        return $programme->fresh();
    }

    public function approve(Programme $programme, User $approver): Programme
    {
        if (!$programme->isSubmitted()) {
            throw ValidationException::withMessages(['status' => 'Only submitted programmes can be approved.']);
        }

        if ($programme->created_by && (int) $programme->created_by === (int) $approver->id) {
            throw ValidationException::withMessages([
                'approval' => 'You cannot approve your own request. Requests must go through the workflow before the Secretary General approves.',
            ]);
        }

        $programme->update([
            'status'      => 'approved',
            'approved_by' => $approver->id,
            'approved_at' => now(),
        ]);

        AuditLog::record('programme.approved', [
            'auditable_type' => Programme::class,
            'auditable_id'   => $programme->id,
            'tags'           => 'programme',
        ]);

        $this->notifyMeOfPifApproval($programme);

        return $programme->fresh(['creator', 'approver']);
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
                    ['module' => 'programme', 'record_id' => $programme->id, 'url' => '/pif/' . $programme->id]
                );
            }

            $meOfficers = User::where('tenant_id', $programme->tenant_id)
                ->permission('mande.create')
                ->get();

            $notifier->dispatchToMany(
                $meOfficers,
                'programme.me_intake_available',
                $vars,
                ['module' => 'mande', 'record_id' => $programme->id, 'url' => '/mande/pif-linkages']
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
