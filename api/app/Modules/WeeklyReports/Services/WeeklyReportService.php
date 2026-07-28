<?php

namespace App\Modules\WeeklyReports\Services;

use App\Models\Assignment;
use App\Models\LeaveRequest;
use App\Models\Risk;
use App\Models\User;
use App\Models\WeeklyReport;
use App\Models\WeeklyReportBlocker;
use App\Models\WeeklyReportDeadlineChange;
use App\Models\WeeklyReportDecisionRequest;
use App\Models\WeeklyReportExemption;
use App\Models\WeeklyReportItem;
use App\Models\WeeklyReportPriority;
use App\Models\WeeklyReportReview;
use App\Models\WeeklyReportRisk;
use App\Models\WeeklyReportSuggestionDecision;
use App\Models\WeeklyReportSupportRequest;
use App\Models\WeeklyReportVersion;
use App\Models\WeeklyReportingPeriod;
use App\Services\NotificationService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class WeeklyReportService
{
    public function __construct(
        private readonly WeeklyPeriodService $periods,
        private readonly WeeklySuggestionService $suggestions,
        private readonly WeeklyReportAuditService $audit,
        private readonly NotificationService $notifications,
    ) {}

    public function dashboard(User $user): array
    {
        $period = $this->periods->ensureCurrent($user);
        $mine = WeeklyReport::query()
            ->where('tenant_id', $user->tenant_id)
            ->where('report_type', WeeklyReport::TYPE_INDIVIDUAL)
            ->where('employee_id', $user->id)
            ->where('period_id', $period->id)
            ->first();

        $teamPending = WeeklyReport::query()
            ->where('tenant_id', $user->tenant_id)
            ->where('report_type', WeeklyReport::TYPE_INDIVIDUAL)
            ->where('supervisor_id', $user->id)
            ->whereIn('status', ['submitted', 'pending_review', 'resubmitted'])
            ->count();

        $missing = $this->missingReports($user, $period);

        return [
            'period' => $period,
            'my_report' => $mine,
            'team_pending_review' => $teamPending,
            'missing_reports' => $missing,
            'compliance' => [
                'submitted' => WeeklyReport::where('period_id', $period->id)
                    ->where('report_type', WeeklyReport::TYPE_INDIVIDUAL)
                    ->whereNotNull('submitted_at')
                    ->where('tenant_id', $user->tenant_id)
                    ->when($user->department_id, fn ($q) => $q->whereHas('employee', fn ($e) => $e->where('department_id', $user->department_id)))
                    ->count(),
                'exempted' => WeeklyReportExemption::where('period_id', $period->id)
                    ->where('tenant_id', $user->tenant_id)
                    ->count(),
            ],
        ];
    }

    public function missingReports(User $user, WeeklyReportingPeriod $period): array
    {
        $deptId = $user->department_id;
        if (! $deptId && ! $user->can('weekly-reports.view-management') && ! $user->isSystemAdmin()) {
            return [];
        }

        $employees = User::query()
            ->where('tenant_id', $user->tenant_id)
            ->where('is_active', true)
            ->when($deptId && ! $user->can('weekly-reports.view-management') && ! $user->isSystemAdmin(),
                fn ($q) => $q->where('department_id', $deptId))
            ->get(['id', 'name', 'email', 'department_id']);

        $submitted = WeeklyReport::query()
            ->where('period_id', $period->id)
            ->where('report_type', WeeklyReport::TYPE_INDIVIDUAL)
            ->whereNotNull('submitted_at')
            ->pluck('employee_id')
            ->all();

        $exempted = WeeklyReportExemption::where('period_id', $period->id)->pluck('employee_id')->all();
        $skip = array_unique(array_merge($submitted, $exempted));

        return $employees->reject(fn ($e) => in_array($e->id, $skip, true))
            ->values()
            ->map(fn ($e) => ['id' => $e->id, 'name' => $e->name, 'department_id' => $e->department_id])
            ->all();
    }

    public function findOrCreateIndividual(User $employee, ?int $periodId = null): WeeklyReport
    {
        $period = $periodId
            ? WeeklyReportingPeriod::where('tenant_id', $employee->tenant_id)->findOrFail($periodId)
            : $this->periods->ensureCurrent($employee);

        $existing = WeeklyReport::query()
            ->where('tenant_id', $employee->tenant_id)
            ->where('period_id', $period->id)
            ->where('report_type', WeeklyReport::TYPE_INDIVIDUAL)
            ->where('employee_id', $employee->id)
            ->first();

        if ($existing) {
            return $existing->load($this->detailRelations());
        }

        // Auto-exemption for full-week approved leave
        $fullWeekLeave = LeaveRequest::query()
            ->where('requester_id', $employee->id)
            ->where('status', 'approved')
            ->whereDate('start_date', '<=', $period->start_date)
            ->whereDate('end_date', '>=', $period->end_date)
            ->first();

        return DB::transaction(function () use ($employee, $period, $fullWeekLeave) {
            $report = WeeklyReport::create([
                'tenant_id' => $employee->tenant_id,
                'reference' => $this->nextReference($employee->tenant_id, 'WSR'),
                'period_id' => $period->id,
                'report_type' => WeeklyReport::TYPE_INDIVIDUAL,
                'employee_id' => $employee->id,
                'department_id' => $employee->department_id,
                'supervisor_id' => $this->periods->resolveSupervisor($employee),
                'owner_id' => $employee->id,
                'prepared_by_id' => $employee->id,
                'status' => $fullWeekLeave ? 'exempted' : 'draft',
                'version' => 1,
                'confidentiality' => 'internal',
                'employee_due_at' => $period->employee_due_at,
                'work_location_status' => $fullWeekLeave ? 'on_leave' : 'office',
            ]);

            if ($fullWeekLeave) {
                WeeklyReportExemption::firstOrCreate(
                    ['period_id' => $period->id, 'employee_id' => $employee->id],
                    [
                        'tenant_id' => $employee->tenant_id,
                        'reason' => 'full_week_leave',
                        'leave_request_id' => $fullWeekLeave->id,
                        'granted_by' => $employee->id,
                        'notes' => 'Auto-exempted: approved leave covers reporting week.',
                    ]
                );
            }

            $this->audit->record($report, $employee, 'report.created', [
                'exempted' => (bool) $fullWeekLeave,
            ]);

            return $report->load($this->detailRelations());
        });
    }

    public function show(WeeklyReport $report, User $viewer): WeeklyReport
    {
        $this->assertCanView($report, $viewer);

        return $report->load($this->detailRelations());
    }

    public function update(WeeklyReport $report, User $actor, array $data): WeeklyReport
    {
        $this->assertCanEdit($report, $actor);

        if (! $report->isEditable()) {
            throw ValidationException::withMessages(['status' => 'Report is not editable in its current status.']);
        }

        $report->fill(collect($data)->only([
            'additional_notes', 'work_location_status', 'no_activity', 'confidentiality',
        ])->all());

        if (($data['status'] ?? null) === 'ready' && $report->status === 'draft') {
            $report->status = 'ready';
        } elseif (in_array($report->status, ['draft', 'not_started'], true)) {
            $report->status = 'in_progress';
        }

        $report->save();
        $this->audit->record($report, $actor, 'report.updated', ['fields' => array_keys($data)]);

        return $report->fresh($this->detailRelations());
    }

    public function addItem(WeeklyReport $report, User $actor, array $data): WeeklyReportItem
    {
        $this->assertCanEdit($report, $actor);
        if (! $report->isEditable()) {
            throw ValidationException::withMessages(['status' => 'Report is not editable.']);
        }

        $item = WeeklyReportItem::create([
            'weekly_report_id' => $report->id,
            'section_type' => $data['section_type'],
            'title' => $data['title'],
            'narrative' => $data['narrative'] ?? null,
            'sequence' => $data['sequence'] ?? 0,
            'source_type' => $data['source_type'] ?? null,
            'source_id' => $data['source_id'] ?? null,
            'source_reference_snapshot' => $data['source_reference_snapshot'] ?? null,
            'source_status_snapshot' => $data['source_status_snapshot'] ?? null,
            'result_or_expected_outcome' => $data['result_or_expected_outcome'] ?? null,
            'due_date' => $data['due_date'] ?? null,
            'priority' => $data['priority'] ?? null,
            'confidentiality' => $data['confidentiality'] ?? 'internal',
            'include_in_consolidation' => $data['include_in_consolidation'] ?? true,
            'structured' => $data['structured'] ?? null,
        ]);

        if ($report->status === 'draft') {
            $report->update(['status' => 'in_progress']);
        }

        $this->audit->record($report, $actor, 'item.added', ['item_id' => $item->id, 'section' => $item->section_type]);

        return $item;
    }

    public function addBlocker(WeeklyReport $report, User $actor, array $data): WeeklyReportBlocker
    {
        $this->assertCanEdit($report, $actor);
        if (empty($data['problem'])) {
            throw ValidationException::withMessages(['problem' => 'Blocker problem is required.']);
        }

        return WeeklyReportBlocker::create([
            'weekly_report_id' => $report->id,
            'problem' => $data['problem'],
            'impact' => $data['impact'] ?? null,
            'responsible_party' => $data['responsible_party'] ?? null,
            'responsible_user_id' => $data['responsible_user_id'] ?? null,
            'action_taken' => $data['action_taken'] ?? null,
            'assistance_required' => $data['assistance_required'] ?? null,
            'severity' => $data['severity'] ?? 'medium',
            'source_type' => $data['source_type'] ?? null,
            'source_id' => $data['source_id'] ?? null,
            'confidentiality' => $data['confidentiality'] ?? 'internal',
        ]);
    }

    public function addDecisionRequest(WeeklyReport $report, User $actor, array $data): WeeklyReportDecisionRequest
    {
        $this->assertCanEdit($report, $actor);
        if (empty($data['decision_requested'])) {
            throw ValidationException::withMessages(['decision_requested' => 'Decision text is required.']);
        }

        return WeeklyReportDecisionRequest::create([
            'weekly_report_id' => $report->id,
            'decision_requested' => $data['decision_requested'],
            'requested_from' => $data['requested_from'] ?? null,
            'requested_from_user_id' => $data['requested_from_user_id'] ?? null,
            'deadline' => $data['deadline'] ?? null,
            'impact_if_delayed' => $data['impact_if_delayed'] ?? null,
            'confidentiality' => $data['confidentiality'] ?? 'internal',
        ]);
    }

    public function addPriority(WeeklyReport $report, User $actor, array $data): WeeklyReportPriority
    {
        $this->assertCanEdit($report, $actor);

        return WeeklyReportPriority::create([
            'weekly_report_id' => $report->id,
            'priority_text' => $data['priority_text'],
            'intended_result' => $data['intended_result'] ?? null,
            'due_date' => $data['due_date'] ?? null,
            'linked_assignment_id' => $data['linked_assignment_id'] ?? null,
            'source_type' => $data['source_type'] ?? null,
            'source_id' => $data['source_id'] ?? null,
            'confidentiality' => $data['confidentiality'] ?? 'internal',
        ]);
    }

    public function addRisk(WeeklyReport $report, User $actor, array $data): WeeklyReportRisk
    {
        $this->assertCanEdit($report, $actor);

        return WeeklyReportRisk::create([
            'weekly_report_id' => $report->id,
            'emerging_issue' => $data['emerging_issue'],
            'possible_impact' => $data['possible_impact'] ?? null,
            'immediate_mitigation' => $data['immediate_mitigation'] ?? null,
            'escalate_to_risk_register' => $data['escalate_to_risk_register'] ?? false,
            'confidentiality' => $data['confidentiality'] ?? 'internal',
        ]);
    }

    public function addSupport(WeeklyReport $report, User $actor, array $data): WeeklyReportSupportRequest
    {
        $this->assertCanEdit($report, $actor);

        return WeeklyReportSupportRequest::create([
            'weekly_report_id' => $report->id,
            'department_or_person' => $data['department_or_person'] ?? null,
            'support_needed' => $data['support_needed'],
            'required_date' => $data['required_date'] ?? null,
            'confidentiality' => $data['confidentiality'] ?? 'internal',
        ]);
    }

    public function currentSuggestions(User $user, ?int $periodId = null): array
    {
        $period = $periodId
            ? WeeklyReportingPeriod::where('tenant_id', $user->tenant_id)->findOrFail($periodId)
            : $this->periods->ensureCurrent($user);
        $report = WeeklyReport::query()
            ->where('tenant_id', $user->tenant_id)
            ->where('period_id', $period->id)
            ->where('employee_id', $user->id)
            ->where('report_type', WeeklyReport::TYPE_INDIVIDUAL)
            ->first();

        return $this->suggestions->suggestions($user, $period, $report);
    }

    public function includeSuggestion(WeeklyReport $report, User $actor, array $data): array
    {
        $this->assertCanEdit($report, $actor);
        if (! $report->isEditable()) {
            throw ValidationException::withMessages(['status' => 'Report is not editable.']);
        }

        $sourceType = $data['source_type'];
        $sourceId = (int) $data['source_id'];
        $section = $data['suggested_section'] ?? 'wip';
        $title = $data['title'] ?? ($sourceType.' #'.$sourceId);
        $confidentiality = $data['confidentiality'] ?? 'internal';

        if ($confidentiality === 'confidential' && $report->employee_id !== $actor->id
            && ! $actor->can('weekly-reports.admin') && ! $actor->isSystemAdmin()) {
            throw ValidationException::withMessages(['confidentiality' => 'Cannot include confidential suggestion.']);
        }

        return DB::transaction(function () use ($report, $actor, $sourceType, $sourceId, $section, $title, $confidentiality, $data) {
            WeeklyReportSuggestionDecision::updateOrCreate(
                [
                    'weekly_report_id' => $report->id,
                    'source_type' => $sourceType,
                    'source_id' => $sourceId,
                ],
                [
                    'decision' => 'included',
                    'suggested_section' => $section,
                    'decided_by' => $actor->id,
                    'decided_at' => now(),
                ]
            );

            $created = null;
            if ($section === 'blocker') {
                $created = $this->addBlocker($report, $actor, [
                    'problem' => $title,
                    'impact' => $data['narrative'] ?? null,
                    'source_type' => $sourceType,
                    'source_id' => $sourceId,
                    'confidentiality' => $confidentiality,
                ]);
            } elseif ($section === 'priority') {
                $created = $this->addPriority($report, $actor, [
                    'priority_text' => $title,
                    'source_type' => $sourceType,
                    'source_id' => $sourceId,
                    'confidentiality' => $confidentiality,
                ]);
            } else {
                $map = [
                    'achievement' => 'achievement',
                    'wip' => 'wip',
                    'meeting' => 'meeting',
                    'note' => 'note',
                ];
                $created = $this->addItem($report, $actor, [
                    'section_type' => $map[$section] ?? 'wip',
                    'title' => $title,
                    'narrative' => $data['narrative'] ?? null,
                    'source_type' => $sourceType,
                    'source_id' => $sourceId,
                    'source_reference_snapshot' => $data['reference'] ?? null,
                    'source_status_snapshot' => $data['status'] ?? null,
                    'confidentiality' => $confidentiality,
                ]);
            }

            $this->audit->record($report, $actor, 'suggestion.included', [
                'source_type' => $sourceType,
                'source_id' => $sourceId,
            ]);

            return ['decision' => 'included', 'created' => $created];
        });
    }

    public function excludeSuggestion(WeeklyReport $report, User $actor, array $data): WeeklyReportSuggestionDecision
    {
        $this->assertCanEdit($report, $actor);

        $decision = WeeklyReportSuggestionDecision::updateOrCreate(
            [
                'weekly_report_id' => $report->id,
                'source_type' => $data['source_type'],
                'source_id' => (int) $data['source_id'],
            ],
            [
                'decision' => 'excluded',
                'suggested_section' => $data['suggested_section'] ?? null,
                'decided_by' => $actor->id,
                'decided_at' => now(),
            ]
        );

        $this->audit->record($report, $actor, 'suggestion.excluded', [
            'source_type' => $data['source_type'],
            'source_id' => (int) $data['source_id'],
        ]);

        return $decision;
    }

    public function submit(WeeklyReport $report, User $actor): WeeklyReport
    {
        $this->assertCanEdit($report, $actor);

        if ($report->status === 'exempted' || $report->status === 'no_report_required') {
            throw ValidationException::withMessages(['status' => 'Exempted reports cannot be submitted.']);
        }

        if (! ($report->declaration_confirmed || request()->boolean('declaration_confirmed'))) {
            throw ValidationException::withMessages(['declaration_confirmed' => 'Employee confirmation is required.']);
        }

        if (! $report->no_activity
            && $report->items()->count() === 0
            && $report->blockers()->count() === 0
            && $report->priorities()->count() === 0
            && $report->decisionRequests()->count() === 0) {
            throw ValidationException::withMessages(['content' => 'Add content or mark no-activity before submitting.']);
        }

        return DB::transaction(function () use ($report, $actor) {
            $wasReturned = $report->status === 'returned';
            $report->update([
                'declaration_confirmed' => true,
                'declaration_confirmed_at' => now(),
                'submitted_at' => now(),
                'status' => $wasReturned ? 'resubmitted' : 'submitted',
            ]);

            // Immediately pending review
            if (in_array($report->status, ['submitted', 'resubmitted'], true)) {
                $report->update(['status' => 'pending_review']);
            }

            $this->snapshotVersion($report, $actor, $wasReturned ? 'resubmit' : 'submit');
            $this->audit->record($report, $actor, 'report.submitted');

            if ($report->supervisor_id) {
                $supervisor = User::find($report->supervisor_id);
                if ($supervisor) {
                    $this->notifications->dispatch(
                        $supervisor,
                        'weekly_report.submitted',
                        ['name' => $supervisor->name, 'employee' => $actor->name, 'reference' => $report->reference],
                        ['module' => 'weekly_reports', 'record_id' => $report->id, 'url' => '/weekly-summaries/'.$report->id],
                        sendEmail: false,
                    );
                }
            }

            return $report->fresh($this->detailRelations());
        });
    }

    public function returnReport(WeeklyReport $report, User $reviewer, array $data): WeeklyReport
    {
        $this->assertCanReview($report, $reviewer);
        $this->assertNotSelfReview($report, $reviewer);

        if (empty($data['reason'] ?? $data['correction_requested'] ?? null)) {
            throw ValidationException::withMessages(['reason' => 'Return requires a reason.']);
        }

        return DB::transaction(function () use ($report, $reviewer, $data) {
            WeeklyReportReview::create([
                'weekly_report_id' => $report->id,
                'reviewer_id' => $reviewer->id,
                'action' => 'return',
                'comment_type' => 'correction_required',
                'comments' => $data['comments'] ?? $data['reason'] ?? null,
                'section_or_item' => $data['section_or_item'] ?? null,
                'correction_requested' => $data['correction_requested'] ?? $data['reason'],
                'resubmission_due_date' => $data['resubmission_due_date'] ?? null,
                'is_confidential' => (bool) ($data['is_confidential'] ?? false),
                'report_version' => $report->version,
            ]);

            $report->update([
                'status' => 'returned',
                'reviewed_at' => now(),
            ]);

            $this->audit->record($report, $reviewer, 'report.returned', [
                'reason' => $data['correction_requested'] ?? $data['reason'],
            ]);

            if ($report->employee) {
                $this->notifications->dispatch(
                    $report->employee,
                    'weekly_report.returned',
                    ['name' => $report->employee->name, 'reference' => $report->reference],
                    ['module' => 'weekly_reports', 'record_id' => $report->id, 'url' => '/weekly-summaries/'.$report->id],
                    sendEmail: false,
                );
            }

            return $report->fresh($this->detailRelations());
        });
    }

    public function accept(WeeklyReport $report, User $reviewer, array $data = []): WeeklyReport
    {
        $this->assertCanReview($report, $reviewer);
        $this->assertNotSelfReview($report, $reviewer);

        return DB::transaction(function () use ($report, $reviewer, $data) {
            WeeklyReportReview::create([
                'weekly_report_id' => $report->id,
                'reviewer_id' => $reviewer->id,
                'action' => 'accept',
                'comment_type' => $data['comment_type'] ?? 'general_feedback',
                'comments' => $data['comments'] ?? null,
                'is_confidential' => (bool) ($data['is_confidential'] ?? false),
                'report_version' => $report->version,
            ]);

            $report->update([
                'status' => 'accepted',
                'reviewed_at' => now(),
                'accepted_at' => now(),
            ]);

            $this->snapshotVersion($report, $reviewer, 'accept');
            $this->audit->record($report, $reviewer, 'report.accepted');

            return $report->fresh($this->detailRelations());
        });
    }

    public function reopen(WeeklyReport $report, User $actor, string $reason): WeeklyReport
    {
        if (! $actor->can('weekly-reports.reopen') && ! $actor->isSystemAdmin()) {
            throw ValidationException::withMessages(['permission' => 'Reopen not permitted.']);
        }

        $report->update(['status' => 'reopened']);
        $this->audit->record($report, $actor, 'report.reopened', ['reason' => $reason]);

        return $report->fresh($this->detailRelations());
    }

    public function extendDeadline(WeeklyReport $report, User $actor, array $data): WeeklyReport
    {
        if (! $actor->can('weekly-reports.manage-exemptions') && ! $actor->isSystemAdmin()
            && $report->supervisor_id !== $actor->id) {
            throw ValidationException::withMessages(['permission' => 'Cannot extend deadline.']);
        }

        WeeklyReportDeadlineChange::create([
            'weekly_report_id' => $report->id,
            'previous_due_at' => $report->employee_due_at,
            'new_due_at' => $data['new_due_at'],
            'reason' => $data['reason'] ?? null,
            'changed_by' => $actor->id,
        ]);

        $report->update(['employee_due_at' => $data['new_due_at']]);
        $this->audit->record($report, $actor, 'deadline.extended', $data);

        return $report->fresh();
    }

    public function grantExemption(User $actor, array $data): WeeklyReportExemption
    {
        $period = WeeklyReportingPeriod::where('tenant_id', $actor->tenant_id)->findOrFail($data['period_id']);

        $exemption = WeeklyReportExemption::updateOrCreate(
            ['period_id' => $period->id, 'employee_id' => $data['employee_id']],
            [
                'tenant_id' => $actor->tenant_id,
                'reason' => $data['reason'] ?? 'other',
                'leave_request_id' => $data['leave_request_id'] ?? null,
                'granted_by' => $actor->id,
                'notes' => $data['notes'] ?? null,
            ]
        );

        $report = WeeklyReport::query()
            ->where('period_id', $period->id)
            ->where('employee_id', $data['employee_id'])
            ->where('report_type', WeeklyReport::TYPE_INDIVIDUAL)
            ->first();

        if ($report) {
            $report->update(['status' => 'exempted']);
        }

        $this->audit->record($report, $actor, 'exemption.granted', [
            'employee_id' => $data['employee_id'],
            'period_id' => $period->id,
        ], $period->id);

        return $exemption;
    }

    public function carryForwardPriority(WeeklyReportPriority $priority, WeeklyReport $target, User $actor): WeeklyReportPriority
    {
        $this->assertCanEdit($target, $actor);

        $carryCount = $priority->carry_count + 1;
        $new = WeeklyReportPriority::create([
            'weekly_report_id' => $target->id,
            'priority_text' => $priority->priority_text,
            'intended_result' => $priority->intended_result,
            'due_date' => $priority->due_date,
            'linked_assignment_id' => $priority->linked_assignment_id,
            'carried_from_priority_id' => $priority->id,
            'carry_count' => $carryCount,
            'stale_warning' => $carryCount >= 2,
            'status' => 'planned',
            'source_type' => 'carry_forward',
            'source_id' => $priority->id,
            'confidentiality' => $priority->confidentiality,
        ]);

        $this->audit->record($target, $actor, 'priority.carried_forward', [
            'from_priority_id' => $priority->id,
            'to_priority_id' => $new->id,
            'carry_count' => $carryCount,
        ]);

        return $new;
    }

    public function recordDecision(WeeklyReportDecisionRequest $decision, User $actor, array $data): WeeklyReportDecisionRequest
    {
        $report = $decision->report;
        if ($report->employee_id === $actor->id && ! $actor->isSystemAdmin()) {
            throw ValidationException::withMessages(['permission' => 'Employee cannot record management decision on own item.']);
        }

        return DB::transaction(function () use ($decision, $actor, $data, $report) {
            $decision->update([
                'decision_recorded' => $data['decision_recorded'],
                'decided_by' => $actor->id,
                'decided_at' => now(),
                'status' => 'decided',
            ]);

            $assignment = null;
            if (! empty($data['create_assignment'])) {
                $assignment = $this->createAssignmentFromDecision($decision, $actor, $data);
                $decision->update(['follow_up_assignment_id' => $assignment->id]);
            }

            if (! empty($data['create_risk'])) {
                $risk = Risk::create([
                    'tenant_id' => $actor->tenant_id,
                    'title' => 'Weekly decision: '.$decision->decision_requested,
                    'description' => $decision->impact_if_delayed ?? $data['decision_recorded'],
                    'category' => 'operational',
                    'department_id' => $report->department_id,
                    'risk_owner_id' => $actor->id,
                    'submitted_by' => $actor->id,
                    'likelihood' => (int) ($data['likelihood'] ?? 3),
                    'impact' => (int) ($data['impact'] ?? 3),
                    'status' => 'draft',
                ]);
                $decision->update(['follow_up_risk_id' => $risk->id]);
            }

            $this->audit->record($report, $actor, 'decision.recorded', [
                'decision_id' => $decision->id,
                'assignment_id' => $assignment?->id,
            ]);

            return $decision->fresh();
        });
    }

    public function createAssignmentFromDecision(WeeklyReportDecisionRequest $decision, User $actor, array $data = []): Assignment
    {
        $purpose = 'weekly_decision_followup';
        $existing = Assignment::query()
            ->where('tenant_id', $actor->tenant_id)
            ->where('source_type', 'weekly_summary')
            ->where('source_id', $decision->id)
            ->where('source_purpose', $purpose)
            ->first();

        if ($existing) {
            return $existing;
        }

        return Assignment::create([
            'tenant_id' => $actor->tenant_id,
            'reference_number' => 'ASN-WS-'.strtoupper(substr(uniqid(), -8)),
            'title' => $data['title'] ?? ('Follow-up: '.$decision->decision_requested),
            'description' => $data['description'] ?? ($decision->decision_recorded ?? $decision->decision_requested),
            'due_date' => $decision->deadline ?? now()->addDays(7)->toDateString(),
            'status' => 'draft',
            'priority' => 'high',
            'created_by' => $actor->id,
            'assigned_to' => $data['assigned_to'] ?? $decision->requested_from_user_id,
            'department_id' => $decision->report->department_id,
            'source_type' => 'weekly_summary',
            'source_id' => $decision->id,
            'source_reference' => $decision->report->reference,
            'source_title' => $decision->decision_requested,
            'source_purpose' => $purpose,
        ]);
    }

    public function createAssignmentFromItem(WeeklyReportItem $item, User $actor, array $data = []): Assignment
    {
        $purpose = 'weekly_item_followup';
        $existing = Assignment::query()
            ->where('tenant_id', $actor->tenant_id)
            ->where('source_type', 'weekly_summary')
            ->where('source_id', $item->id)
            ->where('source_purpose', $purpose)
            ->first();

        if ($existing) {
            return $existing;
        }

        return Assignment::create([
            'tenant_id' => $actor->tenant_id,
            'reference_number' => 'ASN-WS-'.strtoupper(substr(uniqid(), -8)),
            'title' => $data['title'] ?? $item->title,
            'description' => $data['description'] ?? ($item->narrative ?? $item->title),
            'due_date' => $item->due_date?->toDateString() ?? now()->addDays(7)->toDateString(),
            'status' => 'draft',
            'priority' => $item->priority ?? 'medium',
            'created_by' => $actor->id,
            'assigned_to' => $data['assigned_to'] ?? $item->report->employee_id,
            'department_id' => $item->report->department_id,
            'source_type' => 'weekly_summary',
            'source_id' => $item->id,
            'source_reference' => $item->report->reference,
            'source_title' => $item->title,
            'source_purpose' => $purpose,
            'is_confidential' => $item->confidentiality === 'confidential',
        ]);
    }

    public function snapshotVersion(WeeklyReport $report, User $actor, string $reason): WeeklyReportVersion
    {
        $report->load($this->detailRelations());
        $version = $report->version;

        // bump after accept/publish; submit keeps current until accept
        if (in_array($reason, ['accept', 'publish', 'correction'], true)) {
            $version = $report->version + ($reason === 'submit' ? 0 : 0);
            if (in_array($reason, ['accept', 'publish', 'correction'], true)) {
                $report->increment('version');
                $version = $report->version;
            }
        }

        return WeeklyReportVersion::create([
            'weekly_report_id' => $report->id,
            'version' => $version,
            'reason' => $reason,
            'created_by' => $actor->id,
            'snapshot' => [
                'report' => $report->toArray(),
                'items' => $report->items->toArray(),
                'blockers' => $report->blockers->toArray(),
                'decisions' => $report->decisionRequests->toArray(),
                'priorities' => $report->priorities->toArray(),
                'risks' => $report->risks->toArray(),
                'support' => $report->supportRequests->toArray(),
            ],
        ]);
    }

    public function nextReference(int $tenantId, string $prefix): string
    {
        $seq = WeeklyReport::withTrashed()->where('tenant_id', $tenantId)->count() + 1;

        return sprintf('%s-%s-%05d', $prefix, now()->format('Y'), $seq);
    }

    public function detailRelations(): array
    {
        return [
            'period', 'employee', 'department', 'supervisor',
            'items', 'blockers', 'decisionRequests', 'priorities', 'risks', 'supportRequests',
            'reviews.reviewer', 'versions', 'consolidationLinks', 'suggestionDecisions',
        ];
    }

    private function assertCanView(WeeklyReport $report, User $viewer): void
    {
        if ($viewer->isSystemAdmin() || $viewer->can('weekly-reports.admin') || $viewer->can('weekly-reports.audit')) {
            return;
        }
        if ($report->employee_id === $viewer->id || $report->owner_id === $viewer->id) {
            return;
        }
        if ($report->supervisor_id === $viewer->id) {
            return;
        }
        if ($report->report_type === WeeklyReport::TYPE_DEPARTMENT
            && $report->department_id
            && $viewer->department_id === $report->department_id
            && ($viewer->can('weekly-reports.view-department') || $viewer->hasRole('HOD'))) {
            return;
        }
        if ($report->report_type === WeeklyReport::TYPE_INSTITUTIONAL
            && ($viewer->can('weekly-reports.view-management') || $viewer->isSecretaryGeneral())) {
            return;
        }
        if ($viewer->can('weekly-reports.view-team') && $report->department_id === $viewer->department_id) {
            return;
        }

        abort(403, 'Not authorised to view this weekly report.');
    }

    private function assertCanEdit(WeeklyReport $report, User $actor): void
    {
        if ($actor->isSystemAdmin() || $actor->can('weekly-reports.admin')) {
            return;
        }
        if (in_array($actor->id, array_filter([$report->employee_id, $report->owner_id, $report->prepared_by_id]), true)) {
            return;
        }
        if ($report->report_type !== WeeklyReport::TYPE_INDIVIDUAL
            && ($actor->can('weekly-reports.consolidate-department') || $actor->can('weekly-reports.publish-institutional'))) {
            return;
        }

        abort(403, 'Not authorised to edit this weekly report.');
    }

    private function assertCanReview(WeeklyReport $report, User $reviewer): void
    {
        if ($reviewer->isSystemAdmin() || $reviewer->can('weekly-reports.admin') || $reviewer->can('weekly-reports.accept')) {
            return;
        }
        if ($report->supervisor_id === $reviewer->id) {
            return;
        }
        if ($reviewer->can('weekly-reports.review-team') && $report->department_id === $reviewer->department_id) {
            return;
        }
        if ($reviewer->hasRole('HOD') && $report->department_id === $reviewer->department_id) {
            return;
        }

        abort(403, 'Not authorised to review this weekly report.');
    }

    private function assertNotSelfReview(WeeklyReport $report, User $reviewer): void
    {
        if ($report->employee_id === $reviewer->id) {
            throw ValidationException::withMessages(['reviewer' => 'You cannot review or accept your own weekly report.']);
        }
    }
}
