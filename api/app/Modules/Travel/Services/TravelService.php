<?php
namespace App\Modules\Travel\Services;

use App\Models\Attachment;
use App\Models\AuditLog;
use App\Models\TravelAmendment;
use App\Models\TravelFundingLine;
use App\Models\TravelRequest;
use App\Models\User;
use App\Models\WorkplanEvent;
use App\Services\DelegationService;
use App\Services\NotificationService;
use App\Services\WorkflowService;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class TravelService
{
    public function __construct(
        protected WorkflowService $workflowService,
        protected NotificationService $notificationService,
        protected DelegationService $delegationService,
        protected TravelToilService $toilService,
        protected TravelConflictService $conflictService,
        protected TravelBudgetReservationService $budgetReservationService,
    ) {}

    public function list(array $filters, User $user): LengthAwarePaginator
    {
        $query = TravelRequest::with(['requester', 'itineraries', 'programme'])
            ->orderByDesc('created_at');

        $canViewAll = $user->isSystemAdmin()
            || $user->hasAnyRole(['Secretary General', 'HR Manager', 'Finance Controller', 'Director', 'Administration Officer', 'HOD'])
            || $user->can('travel.admin')
            || $user->can('travel.finance-review')
            || $user->can('travel.approve');

        if (! $canViewAll) {
            $query->where(function ($q) use ($user) {
                $q->where('requester_id', $user->id)
                    ->orWhere('prepared_by', $user->id)
                    ->orWhere('prepared_on_behalf_of', $user->id);
            });
        }

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (! empty($filters['scope']) && $filters['scope'] === 'mine') {
            $query->where('requester_id', $user->id);
        }
        if (! empty($filters['queue'])) {
            $this->applyQueueFilter($query, $filters['queue'], $user);
        }
        if (! empty($filters['search'])) {
            $query->where(function ($q) use ($filters) {
                $q->where('reference_number', 'ilike', "%{$filters['search']}%")
                  ->orWhere('purpose', 'ilike', "%{$filters['search']}%")
                  ->orWhere('destination_country', 'ilike', "%{$filters['search']}%");
            });
        }

        return $query->paginate($filters['per_page'] ?? 20);
    }

    protected function applyQueueFilter($query, string $queue, User $user): void
    {
        match ($queue) {
            'approval' => $query->whereIn('status', ['submitted', 'resubmitted']),
            'admin' => $query->whereIn('status', ['submitted', 'resubmitted']),
            'finance' => $query->whereIn('status', ['submitted', 'resubmitted', 'approved'])
                ->where(function ($q) {
                    $q->whereNull('finance_status')->orWhere('finance_status', '!=', 'dsa_calculated');
                }),
            'director-finance' => $query->whereNotNull('finance_status')
                ->whereNull('director_finance_confirmed_at'),
            'retirement' => $query->whereNotNull('returned_at')
                ->where(function ($q) {
                    $q->whereNull('retirement_status')
                        ->orWhereNotIn('retirement_status', ['completed', 'retired']);
                }),
            default => null,
        };
    }

    public function create(array $data, User $user): TravelRequest
    {
        $onBehalfOf = isset($data['prepared_on_behalf_of']) ? (int) $data['prepared_on_behalf_of'] : null;
        $delegation = null;

        if ($onBehalfOf && $onBehalfOf !== (int) $user->id) {
            if ($user->can('travel.prepare-for-others') || $user->isSystemAdmin()) {
                // permission-based prepare-for-others does not require active delegation
            } else {
                $delegation = $this->delegationService->authorise($user, $onBehalfOf, 'travel', 'draft');
            }
        }

        $ownerId = $this->delegationService->ownerId($user, $onBehalfOf);
        $cabin = $data['cabin_class'] ?? config('travel.default_cabin_class', 'economy');
        if ($cabin !== 'economy' && empty($data['route_justification']) && empty($data['cabin_justification'])) {
            throw ValidationException::withMessages([
                'cabin_class' => 'Non-economy cabin class requires a justification.',
            ]);
        }

        $travel = TravelRequest::create([
            'tenant_id'                      => $user->tenant_id,
            'requester_id'                   => $ownerId,
            'reference_number'               => 'TRV-' . strtoupper(Str::random(8)),
            'purpose'                        => $data['purpose'],
            'status'                         => 'draft',
            'departure_date'                 => $data['departure_date'],
            'return_date'                    => $data['return_date'],
            'destination_country'            => $data['destination_country'],
            'destination_city'               => $data['destination_city'] ?? null,
            'estimated_dsa'                  => $data['estimated_dsa'] ?? 0,
            'currency'                       => $data['currency'] ?? 'USD',
            'justification'                  => $data['justification'] ?? null,
            'workplan_event_id'              => $data['workplan_event_id'] ?? null,
            'programme_id'                   => $data['programme_id'] ?? null,
            'mission_id'                     => $data['mission_id'] ?? null,
            'host_organization'              => $data['host_organization'] ?? null,
            'budget_line_id'                 => $data['budget_line_id'] ?? null,
            'cabin_class'                    => $cabin,
            'route_is_most_economical'       => $data['route_is_most_economical'] ?? true,
            'route_justification'            => $data['route_justification'] ?? $data['cabin_justification'] ?? null,
            'personal_incremental_cost'      => $data['personal_incremental_cost'] ?? null,
            'personal_cost_acknowledged_at'  => ! empty($data['personal_cost_acknowledged']) ? now() : null,
            'vehicle_type'                   => $data['vehicle_type'] ?? null,
            'driver_required'                => (bool) ($data['driver_required'] ?? false),
            'driver_name'                    => $data['driver_name'] ?? null,
            'is_emergency'                   => (bool) ($data['is_emergency'] ?? false),
            'emergency_reason'               => $data['emergency_reason'] ?? null,
            'official_personal_days'         => $data['official_personal_days'] ?? null,
            'sponsored_deduction_rate_id'    => $data['sponsored_deduction_rate_id'] ?? null,
            'meals_provided_by_host'         => (bool) ($data['meals_provided_by_host'] ?? false),
            'accommodation_provided_by_host' => (bool) ($data['accommodation_provided_by_host'] ?? false),
        ]);

        $this->delegationService->stampPreparation($travel, $user, $onBehalfOf, 'travel', 'draft', $delegation);
        $travel->save();

        if (! empty($data['itineraries'])) {
            foreach ($data['itineraries'] as $leg) {
                $travel->itineraries()->create($leg);
            }
        }

        $this->syncFundingLines($travel, $data['funding_details'] ?? $data['funding_lines'] ?? []);

        if (($data['vehicle_type'] ?? null) === 'private'
            || isset($data['estimated_kilometres'])
            || isset($data['mileage_rate_per_km'])) {
            $this->updateVehicleMileage($travel, $data, $user);
        }

        AuditLog::record('travel.created', [
            'auditable_type' => TravelRequest::class,
            'auditable_id'   => $travel->id,
            'new_values'     => [
                'reference'              => $travel->reference_number,
                'purpose'                => $travel->purpose,
                'prepared_on_behalf_of'  => $travel->prepared_on_behalf_of,
            ],
            'tags'           => 'travel',
        ]);

        return $travel->load(['requester', 'itineraries', 'fundingLines', 'programme']);
    }

    public function update(TravelRequest $travel, array $data, User $user): TravelRequest
    {
        if ($travel->isApproved()) {
            throw ValidationException::withMessages([
                'status' => 'Approved requests cannot be silently edited. Submit an amendment instead.',
            ]);
        }

        if (! $travel->isDraft() && $travel->status !== 'returned_for_correction') {
            throw ValidationException::withMessages(['status' => 'Only draft or returned requests can be edited.']);
        }

        if ((int) $travel->requester_id !== (int) $user->id
            && (int) $travel->prepared_by !== (int) $user->id
            && ! $user->isSystemAdmin()) {
            throw ValidationException::withMessages([
                'request' => 'You can only edit your own travel requests.',
            ]);
        }

        $payload = array_filter([
            'purpose'                   => $data['purpose'] ?? null,
            'departure_date'            => $data['departure_date'] ?? null,
            'return_date'               => $data['return_date'] ?? null,
            'destination_country'       => $data['destination_country'] ?? null,
            'destination_city'          => $data['destination_city'] ?? null,
            'estimated_dsa'             => $data['estimated_dsa'] ?? null,
            'currency'                  => $data['currency'] ?? null,
            'justification'             => $data['justification'] ?? null,
            'host_organization'         => $data['host_organization'] ?? null,
            'vehicle_type'              => $data['vehicle_type'] ?? null,
            'driver_name'               => $data['driver_name'] ?? null,
            'cabin_class'               => $data['cabin_class'] ?? null,
            'route_justification'       => $data['route_justification'] ?? null,
            'personal_incremental_cost' => $data['personal_incremental_cost'] ?? null,
        ], fn ($v) => $v !== null);

        foreach (['workplan_event_id', 'programme_id', 'mission_id', 'budget_line_id', 'route_is_most_economical', 'driver_required', 'official_personal_days', 'is_emergency', 'emergency_reason'] as $key) {
            if (array_key_exists($key, $data)) {
                $payload[$key] = $data[$key];
            }
        }
        if (! empty($data['personal_cost_acknowledged'])) {
            $payload['personal_cost_acknowledged_at'] = now();
        }

        $travel->update($payload);

        if (isset($data['funding_details']) || isset($data['funding_lines'])) {
            $this->syncFundingLines($travel, $data['funding_details'] ?? $data['funding_lines'] ?? []);
        }

        AuditLog::record('travel.updated', [
            'auditable_type' => TravelRequest::class,
            'auditable_id'   => $travel->id,
            'tags'           => 'travel',
        ]);

        return $travel->fresh(['requester', 'itineraries', 'fundingLines', 'programme']);
    }

    protected function syncFundingLines(TravelRequest $travel, array $lines): void
    {
        $travel->fundingLines()->delete();
        foreach (array_values($lines) as $i => $line) {
            if (empty($line['item']) && empty($line['description'])) {
                continue;
            }
            $forum = (float) ($line['forum_amount'] ?? $line['sadc_amount'] ?? 0);
            $host = (float) ($line['host_amount'] ?? 0);
            $donor = (float) ($line['donor_amount'] ?? 0);
            $self = (float) ($line['self_amount'] ?? 0);
            TravelFundingLine::create([
                'travel_request_id' => $travel->id,
                'item'              => $line['item'] ?? $line['description'] ?? 'Funding',
                'forum_amount'      => $forum,
                'host_amount'       => $host,
                'donor_amount'      => $donor,
                'self_amount'       => $self,
                'payor_sadc_pf'     => (bool) ($line['payor_sadc_pf'] ?? $forum > 0),
                'payor_host'        => (bool) ($line['payor_host'] ?? $host > 0),
                'payor_donor'       => (bool) ($line['payor_donor'] ?? $donor > 0),
                'payor_self'        => (bool) ($line['payor_self'] ?? $self > 0),
                'funding_agency'    => $line['funding_agency'] ?? $line['agency'] ?? null,
                'project'           => $line['project'] ?? null,
                'budget_line'       => $line['budget_line'] ?? null,
                'sort_order'        => $i,
            ]);
        }
    }

    public function assertAttachmentsForStage(TravelRequest $travel, string $stage): void
    {
        $required = config("travel.attachment_requirements.{$stage}", []);
        if ($stage === 'submit' && $travel->programme_id) {
            $required = array_values(array_unique(array_merge($required, ['approved_pif'])));
        }
        if (empty($required)) {
            return;
        }

        $types = $travel->attachments()->pluck('document_type')->filter()->all();
        $missing = array_values(array_diff($required, $types));
        if (! empty($missing)) {
            throw ValidationException::withMessages([
                'attachments' => 'Missing required documents for this stage: ' . implode(', ', $missing),
            ]);
        }
    }

    public function submit(TravelRequest $travel, User $user, array $options = []): TravelRequest
    {
        $canSubmit = (int) $travel->requester_id === (int) $user->id
            || (int) $travel->prepared_by === (int) $user->id
            || $user->isSystemAdmin();
        if (! $canSubmit) {
            abort(403);
        }
        if (! $travel->isDraft() && $travel->status !== 'returned_for_correction') {
            throw ValidationException::withMessages(['status' => 'Only draft requests can be submitted.']);
        }

        $this->assertAttachmentsForStage($travel, 'submit');

        $conflicts = $this->conflictService->detectForTravel($travel);
        if (! empty($conflicts) && empty($options['acknowledge_conflicts'])) {
            throw ValidationException::withMessages([
                'conflicts' => array_map(fn ($c) => $c['message'], $conflicts),
            ]);
        }

        $payload = ['status' => 'submitted', 'submitted_at' => now()];
        if (! empty($options['acknowledge_conflicts'])) {
            $payload['conflicts_acknowledged_at'] = now();
            $payload['conflict_resolution_note'] = $options['conflict_resolution_note'] ?? null;
        }
        $travel->update($payload);

        $this->workflowService->initiate($travel, 'travel', $user);

        $approvers = User::role(['HR Manager', 'Secretary General', 'HOD', 'Administration Officer', 'Finance Controller', 'Director'])
            ->where('tenant_id', $user->tenant_id)
            ->where('id', '!=', $user->id)
            ->get();
        $this->notificationService->dispatchToMany($approvers, 'travel.submitted', [
            'reference'   => $travel->reference_number,
            'requester'   => $user->name,
            'destination' => $travel->destination_country,
            'date'        => $travel->departure_date,
        ], ['module' => 'travel', 'record_id' => $travel->id, 'url' => '/travel/' . $travel->id]);

        AuditLog::record('travel.submitted', [
            'auditable_type' => TravelRequest::class,
            'auditable_id'   => $travel->id,
            'tags'           => 'travel',
        ]);

        return $travel->fresh(['approvalRequest.workflow.steps', 'approvalRequest.history.user']);
    }

    public function onWorkflowApproved(TravelRequest $travel, User $approver): void
    {
        $travel->update([
            'status'      => 'approved',
            'approved_by' => $approver->id,
            'approved_at' => now(),
            'original_snapshot' => $travel->original_snapshot ?? [
                'departure_date' => $travel->departure_date?->toDateString(),
                'return_date'    => $travel->return_date?->toDateString(),
                'destination_country' => $travel->destination_country,
                'destination_city' => $travel->destination_city,
                'purpose' => $travel->purpose,
                'finance_dsa_total' => $travel->finance_dsa_total,
            ],
        ]);

        AuditLog::record('travel.approved', [
            'auditable_type' => TravelRequest::class,
            'auditable_id'   => $travel->id,
            'tags'           => 'travel',
        ]);

        $this->budgetReservationService->reserveOnApprove($travel->fresh(['fundingLines']), $approver);

        $travel->loadMissing('requester');

        if ($travel->requester) {
            $this->notificationService->dispatch($travel->requester, 'travel.approved', [
                'name'        => $travel->requester->name,
                'reference'   => $travel->reference_number,
                'destination' => $travel->destination_country,
                'date'        => $travel->departure_date,
            ], ['module' => 'travel', 'record_id' => $travel->id, 'url' => '/travel/' . $travel->id]);
        }
        WorkplanEvent::updateOrCreate(
            ['linked_module' => 'travel', 'linked_id' => $travel->id],
            [
                'tenant_id'   => $travel->tenant_id,
                'created_by'  => $approver->id,
                'title'       => 'Mission: ' . $travel->purpose . ' — ' . $travel->destination_country,
                'type'        => 'travel',
                'date'        => $travel->departure_date,
                'end_date'    => $travel->return_date,
                'responsible' => $travel->requester?->name,
                'description' => $travel->reference_number,
            ]
        );
    }

    public function onWorkflowRejected(TravelRequest $travel, User $approver, ?string $reason = null): void
    {
        $travel->update([
            'status'           => 'rejected',
            'approved_by'      => $approver->id,
            'rejection_reason' => $reason,
        ]);

        AuditLog::record('travel.rejected', [
            'auditable_type' => TravelRequest::class,
            'auditable_id'   => $travel->id,
            'new_values'     => ['reason' => $reason],
            'tags'           => 'travel',
        ]);

        $travel->loadMissing('requester');
        if ($travel->requester) {
            $this->notificationService->dispatch($travel->requester, 'travel.rejected', [
                'name'        => $travel->requester->name,
                'reference'   => $travel->reference_number,
                'destination' => $travel->destination_country,
                'comment'     => $reason ?? '',
            ], ['module' => 'travel', 'record_id' => $travel->id, 'url' => '/travel/' . $travel->id]);
        }
    }

    public function approve(TravelRequest $travel, User $approver): TravelRequest
    {
        if (!$travel->isSubmitted()) {
            throw ValidationException::withMessages(['status' => 'Only submitted requests can be approved.']);
        }

        if ((int) $travel->requester_id === (int) $approver->id) {
            throw ValidationException::withMessages([
                'approval' => 'You cannot approve your own request.',
            ]);
        }

        if (
            ! $approver->isSystemAdmin()
            && ! $approver->hasAnyRole(['Secretary General', 'HR Manager'])
            && ! $approver->can('travel.approve')
            && ! $approver->can('travel.final-approve')
        ) {
            abort(403, 'You are not authorised to approve travel requests.');
        }

        $this->onWorkflowApproved($travel, $approver);

        return $travel->fresh(['requester', 'approver']);
    }

    public function reject(TravelRequest $travel, string $reason, User $approver): TravelRequest
    {
        if (!$travel->isSubmitted()) {
            throw ValidationException::withMessages(['status' => 'Only submitted requests can be rejected.']);
        }

        if ((int) $travel->requester_id === (int) $approver->id) {
            throw ValidationException::withMessages([
                'approval' => 'You cannot reject your own request.',
            ]);
        }

        if (
            ! $approver->isSystemAdmin()
            && ! $approver->hasAnyRole(['Secretary General', 'HR Manager'])
            && ! $approver->can('travel.approve')
        ) {
            abort(403, 'You are not authorised to reject travel requests.');
        }

        $this->onWorkflowRejected($travel, $approver, $reason);

        return $travel->fresh();
    }

    public function confirmFunds(TravelRequest $travel, User $user, ?string $remarks = null): TravelRequest
    {
        if (! $user->can('travel.director-finance-confirm') && ! $user->hasRole('Director') && ! $user->isSystemAdmin()) {
            abort(403, 'Director Finance confirmation required.');
        }
        if ((int) $travel->requester_id === (int) $user->id && ! $user->isSystemAdmin()) {
            throw ValidationException::withMessages(['funds' => 'You cannot confirm funds on your own request.']);
        }

        $travel->update([
            'director_finance_confirmed_at' => now(),
            'director_finance_confirmed_by' => $user->id,
            'director_finance_remarks'      => $remarks,
            'finance_status'                => 'funds_confirmed',
        ]);

        $this->notificationService->dispatchToMany(
            User::role('Secretary General')->where('tenant_id', $travel->tenant_id)->get(),
            'travel.director_finance_confirmed',
            [
                'reference'   => $travel->reference_number,
                'destination' => $travel->destination_country,
            ],
            ['module' => 'travel', 'record_id' => $travel->id, 'url' => '/travel/' . $travel->id]
        );

        AuditLog::record('travel.director_finance_confirmed', [
            'auditable_type' => TravelRequest::class,
            'auditable_id'   => $travel->id,
            'tags'           => 'travel',
        ]);

        return $travel->fresh();
    }

    public function markBooked(TravelRequest $travel, User $user, array $data = []): TravelRequest
    {
        $isApproved = $travel->isApproved();
        $emergencyOk = false;

        if (! $isApproved) {
            if (! empty($data['emergency_commit']) || $travel->is_emergency) {
                if (! $user->hasRole('Secretary General') && ! $user->isSystemAdmin()) {
                    throw ValidationException::withMessages([
                        'booking' => 'Emergency booking commitment requires Secretary General authorisation.',
                    ]);
                }
                $emergencyOk = true;
                $travel->update([
                    'is_emergency'            => true,
                    'emergency_reason'        => $data['emergency_reason'] ?? $travel->emergency_reason ?? 'SG emergency commit',
                    'emergency_authorised_by' => $user->id,
                ]);
                AuditLog::record('travel.emergency_commit', [
                    'auditable_type' => TravelRequest::class,
                    'auditable_id'   => $travel->id,
                    'new_values'     => ['authorised_by' => $user->id, 'reason' => $travel->emergency_reason],
                    'tags'           => 'travel,emergency',
                ]);
            } else {
                throw ValidationException::withMessages([
                    'booking' => 'Bookings and ticket commitments are only allowed after SG approval (or audited SG emergency exception).',
                ]);
            }
        }

        $this->assertAttachmentsForStage($travel, 'mark_booked');

        $travel->update(['booking_committed_at' => now()]);

        $this->notificationService->dispatch($travel->requester, 'travel.booked', [
            'name'      => $travel->requester?->name,
            'reference' => $travel->reference_number,
        ], ['module' => 'travel', 'record_id' => $travel->id, 'url' => '/travel/' . $travel->id]);

        AuditLog::record('travel.booked', [
            'auditable_type' => TravelRequest::class,
            'auditable_id'   => $travel->id,
            'new_values'     => ['emergency' => $emergencyOk],
            'tags'           => 'travel',
        ]);

        return $travel->fresh();
    }

    public function markReturned(TravelRequest $travel, User $user): TravelRequest
    {
        if (! $travel->isApproved()) {
            throw ValidationException::withMessages(['status' => 'Only approved travel can be marked returned.']);
        }

        $workingDays = (int) config('travel.retirement_working_days', 5);
        $due = $this->addWorkingDays(Carbon::parse($travel->return_date)->startOfDay(), $workingDays);

        $travel->update([
            'returned_at'        => now(),
            'retirement_status'  => 'pending',
            'retirement_due_at'  => $due->toDateString(),
        ]);

        $this->toilService->generateForTravel($travel);

        $this->notificationService->dispatch($travel->requester, 'travel.returned', [
            'name'      => $travel->requester?->name,
            'reference' => $travel->reference_number,
            'due_date'  => $due->toDateString(),
        ], ['module' => 'travel', 'record_id' => $travel->id, 'url' => '/travel/' . $travel->id]);

        $this->notificationService->dispatch($travel->requester, 'travel.retirement_due', [
            'name'      => $travel->requester?->name,
            'reference' => $travel->reference_number,
            'due_date'  => $due->toDateString(),
        ], ['module' => 'travel', 'record_id' => $travel->id, 'url' => '/travel/' . $travel->id]);

        AuditLog::record('travel.returned', [
            'auditable_type' => TravelRequest::class,
            'auditable_id'   => $travel->id,
            'new_values'     => ['retirement_due_at' => $due->toDateString()],
            'tags'           => 'travel',
        ]);

        return $travel->fresh(['toilCandidates']);
    }

    public function cancel(TravelRequest $travel, User $user, string $reason): TravelRequest
    {
        if (in_array($travel->status, ['cancelled', 'withdrawn'], true)) {
            throw ValidationException::withMessages(['status' => 'Travel is already cancelled.']);
        }
        if ($travel->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Delete draft requests instead of cancelling.']);
        }

        abort_unless(
            $user->isSystemAdmin()
                || $user->hasAnyRole(['Secretary General', 'Administration Officer', 'HR Manager', 'Finance Controller'])
                || $user->can('travel.admin')
                || $user->can('travel.approve')
                || (int) $travel->requester_id === (int) $user->id,
            403
        );

        $this->budgetReservationService->releaseOnCancel($travel, $user);

        $travel->update([
            'status' => 'cancelled',
            'cancelled_at' => now(),
            'cancelled_by' => $user->id,
            'cancellation_reason' => $reason,
        ]);

        $travel->loadMissing('requester');
        if ($travel->requester) {
            $this->notificationService->dispatch($travel->requester, 'travel.cancelled', [
                'name' => $travel->requester->name,
                'reference' => $travel->reference_number,
                'comment' => $reason,
            ], ['module' => 'travel', 'record_id' => $travel->id, 'url' => '/travel/'.$travel->id]);
        }

        AuditLog::record('travel.cancelled', [
            'auditable_type' => TravelRequest::class,
            'auditable_id' => $travel->id,
            'new_values' => ['reason' => $reason],
            'tags' => 'travel',
        ]);

        return $travel->fresh();
    }

    public function updatePersonalDays(TravelRequest $travel, array $days, User $user): TravelRequest
    {
        $canEdit = (int) $travel->requester_id === (int) $user->id
            || (int) $travel->prepared_by === (int) $user->id
            || $user->isSystemAdmin()
            || $user->can('travel.admin')
            || $user->can('travel.finance-review');
        abort_unless($canEdit, 403);

        if (! in_array($travel->status, ['draft', 'returned_for_correction', 'submitted', 'resubmitted', 'approved'], true)) {
            throw ValidationException::withMessages(['status' => 'Personal days cannot be edited in this status.']);
        }

        $normalized = [];
        foreach ($days as $day) {
            $date = $day['date'] ?? null;
            $type = $day['type'] ?? 'official';
            if (! $date) {
                continue;
            }
            $normalized[] = [
                'date' => Carbon::parse($date)->toDateString(),
                'type' => in_array($type, ['personal', 'official'], true) ? $type : 'official',
            ];
        }

        $travel->update(['official_personal_days' => $normalized]);

        AuditLog::record('travel.personal_days_updated', [
            'auditable_type' => TravelRequest::class,
            'auditable_id' => $travel->id,
            'new_values' => ['days' => $normalized],
            'tags' => 'travel',
        ]);

        return $travel->fresh();
    }

    public function linkImprest(TravelRequest $travel, array $data, User $user): \App\Models\ImprestRequest
    {
        $canLink = (int) $travel->requester_id === (int) $user->id
            || $user->isSystemAdmin()
            || $user->can('travel.finance-review')
            || $user->hasRole('Finance Controller');
        abort_unless($canLink, 403);

        $amount = (float) ($data['amount_requested'] ?? $travel->finance_dsa_total ?? $travel->estimated_dsa ?? 0);
        if ($amount <= 0) {
            throw ValidationException::withMessages(['amount_requested' => 'Amount is required to create an imprest.']);
        }

        $imprest = app(\App\Modules\Imprest\Services\ImprestService::class)->create([
            'budget_line_id' => $data['budget_line_id'] ?? $travel->budget_line_id,
            'budget_line' => $data['budget_line']
                ?? $travel->fundingLines()->whereNotNull('budget_line')->value('budget_line')
                ?? 'TRAVEL-'.$travel->reference_number,
            'amount_requested' => $amount,
            'currency' => $data['currency'] ?? $travel->currency ?? 'NAD',
            'expected_liquidation_date' => $data['expected_liquidation_date']
                ?? ($travel->retirement_due_at?->toDateString() ?? now()->addDays(14)->toDateString()),
            'purpose' => $data['purpose'] ?? ('Travel retirement — '.$travel->reference_number),
            'justification' => $data['justification'] ?? ('Linked from travel '.$travel->reference_number),
            'travel_request_id' => $travel->id,
        ], $user);

        AuditLog::record('travel.imprest_linked', [
            'auditable_type' => TravelRequest::class,
            'auditable_id' => $travel->id,
            'new_values' => ['imprest_id' => $imprest->id, 'reference' => $imprest->reference_number],
            'tags' => 'travel,imprest',
        ]);

        return $imprest;
    }

    public function listTravellers(User $user): \Illuminate\Support\Collection
    {
        abort_unless(
            $user->can('travel.prepare-for-others') || $user->isSystemAdmin(),
            403
        );

        return User::query()
            ->where('tenant_id', $user->tenant_id)
            ->where(function ($q) {
                $q->where('is_active', true)->orWhereNull('is_active');
            })
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'department_id']);
    }

    public function completeRetirement(TravelRequest $travel, User $user): TravelRequest
    {
        $this->assertAttachmentsForStage($travel, 'retire');
        $travel->update(['retirement_status' => 'completed']);

        AuditLog::record('travel.retirement_completed', [
            'auditable_type' => TravelRequest::class,
            'auditable_id'   => $travel->id,
            'tags'           => 'travel',
        ]);

        return $travel->fresh();
    }

    public function createAmendment(TravelRequest $travel, array $changes, User $user, ?string $reason = null): TravelAmendment
    {
        if (! $travel->isApproved()) {
            throw ValidationException::withMessages(['status' => 'Amendments are only for approved travel.']);
        }

        $snapshot = $travel->original_snapshot ?? [
            'departure_date' => $travel->departure_date?->toDateString(),
            'return_date'    => $travel->return_date?->toDateString(),
            'purpose'        => $travel->purpose,
        ];

        $amendment = TravelAmendment::create([
            'travel_request_id' => $travel->id,
            'created_by'        => $user->id,
            'status'            => 'submitted',
            'proposed_changes'  => $changes,
            'original_snapshot' => $snapshot,
            'reason'            => $reason,
        ]);

        $travel->update(['status' => 'amendment_pending']);

        AuditLog::record('travel.amendment_created', [
            'auditable_type' => TravelRequest::class,
            'auditable_id'   => $travel->id,
            'new_values'     => ['amendment_id' => $amendment->id],
            'tags'           => 'travel',
        ]);

        return $amendment;
    }

    public function approveAmendment(TravelAmendment $amendment, User $user): TravelRequest
    {
        $travel = $amendment->travelRequest;
        $changes = $amendment->proposed_changes ?? [];
        $allowed = collect($changes)->only([
            'departure_date', 'return_date', 'destination_country', 'destination_city',
            'purpose', 'justification', 'cabin_class', 'route_justification',
        ])->all();
        $travel->update(array_merge($allowed, ['status' => 'approved']));
        $amendment->update(['status' => 'approved']);

        AuditLog::record('travel.amendment_approved', [
            'auditable_type' => TravelRequest::class,
            'auditable_id'   => $travel->id,
            'tags'           => 'travel',
        ]);

        return $travel->fresh();
    }

    public function addWorkingDays(Carbon $start, int $days): Carbon
    {
        $d = $start->copy();
        $added = 0;
        while ($added < $days) {
            $d->addDay();
            if (! $d->isWeekend()) {
                $added++;
            }
        }

        return $d;
    }

    public function delete(TravelRequest $travel, User $user): void
    {
        if (!$travel->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Only draft requests can be deleted.']);
        }
        if ((int) $travel->requester_id !== (int) $user->id && !$user->isSystemAdmin()) {
            throw ValidationException::withMessages(['request' => 'You can only delete your own travel requests.']);
        }
        $travel->delete();
    }

    public function exportRegister(User $user, array $filters = []): array
    {
        $paginator = $this->list(array_merge($filters, ['per_page' => 500]), $user);
        $rows = [];
        foreach ($paginator->items() as $t) {
            $rows[] = [
                'reference' => $t->reference_number,
                'requester' => $t->requester?->name,
                'purpose'   => $t->purpose,
                'destination' => trim(($t->destination_city ?? '') . ', ' . $t->destination_country, ', '),
                'departure' => $t->departure_date?->toDateString(),
                'return'    => $t->return_date?->toDateString(),
                'status'    => $t->status,
                'dsa_total' => $t->finance_dsa_total ?? $t->actual_dsa ?? $t->estimated_dsa,
                'currency'  => $t->currency,
            ];
        }

        return $rows;
    }

    public function authorisationPdf(TravelRequest $travel)
    {
        $travel->load([
            'requester.department',
            'approver',
            'itineraries',
            'fundingLines',
            'dsaLines',
            'directorFinanceConfirmer',
            'approvalRequest.history.user',
            'approvalRequest.workflow.steps',
        ]);

        return \Barryvdh\DomPDF\Facade\Pdf::loadView('pdf.travel_authorisation_parts_ad', [
            'travel' => $travel,
        ]);
    }

    public function addAccommodation(TravelRequest $travel, array $data, User $user): \App\Models\TravelAccommodation
    {
        abort_unless(
            $user->can('travel.admin-review')
                || $user->can('travel.admin')
                || $user->isSystemAdmin()
                || $user->hasAnyRole(['Administration Officer', 'System Admin', 'Finance Controller'])
                || (int) $travel->requester_id === (int) $user->id,
            403
        );

        $accommodation = $travel->accommodations()->create([
            'hotel_name' => $data['hotel_name'],
            'country' => $data['country'] ?? null,
            'city' => $data['city'] ?? null,
            'check_in' => $data['check_in'] ?? null,
            'check_out' => $data['check_out'] ?? null,
            'room_type' => $data['room_type'] ?? null,
            'rate' => $data['rate'] ?? null,
            'currency' => $data['currency'] ?? $travel->currency,
            'paid_by' => $data['paid_by'] ?? null,
            'confirmation_number' => $data['confirmation_number'] ?? null,
            'cancellation_deadline' => $data['cancellation_deadline'] ?? null,
            'contact' => $data['contact'] ?? null,
            'attachment_id' => $data['attachment_id'] ?? null,
            'notes' => $data['notes'] ?? null,
        ]);

        AuditLog::record('travel.accommodation_added', [
            'auditable_type' => TravelRequest::class,
            'auditable_id' => $travel->id,
            'new_values' => ['hotel' => $accommodation->hotel_name, 'confirmation' => $accommodation->confirmation_number],
            'tags' => 'travel',
        ]);

        return $accommodation;
    }

    public function updateVehicleMileage(TravelRequest $travel, array $data, User $user): TravelRequest
    {
        abort_unless(
            $user->can('travel.admin-review')
                || $user->can('travel.admin')
                || $user->isSystemAdmin()
                || $user->hasAnyRole(['Administration Officer', 'System Admin', 'Finance Controller', 'HOD'])
                || (int) $travel->requester_id === (int) $user->id,
            403
        );

        $km = (float) ($data['estimated_kilometres'] ?? 0);
        $rate = (float) ($data['mileage_rate_per_km'] ?? 0);
        $airfare = isset($data['equivalent_airfare']) ? (float) $data['equivalent_airfare'] : null;
        $mileageEstimate = round($km * $rate, 2);
        $capped = $airfare === null ? $mileageEstimate : min($mileageEstimate, $airfare);
        $exceeds = $airfare !== null && $mileageEstimate > $airfare;

        $travel->update([
            'private_vehicle_reason' => $data['private_vehicle_reason'] ?? $travel->private_vehicle_reason,
            'private_vehicle_route' => $data['private_vehicle_route'] ?? $travel->private_vehicle_route,
            'estimated_kilometres' => $km,
            'mileage_rate_per_km' => $rate,
            'equivalent_airfare' => $airfare,
            'mileage_reimbursement_estimate' => $mileageEstimate,
            'reimbursement_capped_amount' => $capped,
            'mileage_exceeds_airfare' => $exceeds,
            'vehicle_type' => $travel->vehicle_type ?: 'private',
        ]);

        AuditLog::record('travel.vehicle_mileage_updated', [
            'auditable_type' => TravelRequest::class,
            'auditable_id' => $travel->id,
            'new_values' => [
                'km' => $km,
                'mileage_estimate' => $mileageEstimate,
                'capped' => $capped,
                'exceeds_airfare' => $exceeds,
            ],
            'tags' => 'travel',
        ]);

        return $travel->fresh();
    }
}
