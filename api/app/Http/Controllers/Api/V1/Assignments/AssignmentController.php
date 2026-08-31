<?php

namespace App\Http\Controllers\Api\V1\Assignments;

use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\AssignmentChecklistItem;
use App\Modules\Assignments\Services\AssignmentCapacityService;
use App\Modules\Assignments\Services\AssignmentDependencyService;
use App\Modules\Assignments\Services\AssignmentHandoverPackService;
use App\Modules\Assignments\Services\AssignmentIcsExportService;
use App\Modules\Assignments\Services\AssignmentIcsImportService;
use App\Modules\Assignments\Services\AssignmentNlSearchService;
use App\Modules\Assignments\Services\AssignmentService;
use App\Modules\Assignments\Services\AssignmentTimesheetCouplingService;
use App\Modules\Assignments\Services\AssignmentWorkloadForecastService;
use App\Models\AssignmentDependency;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class AssignmentController extends Controller
{
    public function __construct(
        private readonly AssignmentService $service,
        private readonly AssignmentIcsExportService $ics,
        private readonly AssignmentCapacityService $capacity,
        private readonly AssignmentWorkloadForecastService $workload,
        private readonly AssignmentDependencyService $dependencies,
        private readonly AssignmentIcsImportService $icsImport,
        private readonly AssignmentHandoverPackService $handover,
        private readonly AssignmentNlSearchService $nlSearch,
        private readonly AssignmentTimesheetCouplingService $timesheetHours,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->only([
            'status', 'priority', 'assigned_to', 'department_id', 'overdue', 'blocked',
            'escalated', 'unassigned', 'search', 'per_page', 'source_type', 'review_status', 'scope',
            'templates_only', 'created_by',
        ]);

        return response()->json($this->service->list($filters, $request->user()));
    }

    public function mine(Request $request): JsonResponse
    {
        $filters = $request->only(['status', 'priority', 'overdue', 'search', 'per_page']);

        return response()->json($this->service->mine($filters, $request->user()));
    }

    public function team(Request $request): JsonResponse
    {
        $filters = $request->only(['status', 'priority', 'overdue', 'department_id', 'search', 'per_page']);

        return response()->json($this->service->team($filters, $request->user()));
    }

    public function reviewQueue(Request $request): JsonResponse
    {
        $filters = $request->only(['status', 'search', 'per_page', 'review_status']);

        return response()->json($this->service->reviewQueue($filters, $request->user()));
    }

    public function register(Request $request): JsonResponse
    {
        $filters = $request->only([
            'status', 'priority', 'assigned_to', 'department_id', 'overdue', 'blocked',
            'escalated', 'unassigned', 'search', 'per_page', 'source_type', 'review_status',
        ]);
        $filters['scope'] = 'register';

        return response()->json($this->service->list($filters, $request->user()));
    }

    /**
     * In-app deadline calendar (not external Google sync).
     */
    public function calendar(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'scope' => ['nullable', 'string', 'in:mine,team,register'],
        ]);
        $from = $data['from'] ?? now()->startOfMonth()->toDateString();
        $to = $data['to'] ?? now()->endOfMonth()->toDateString();
        $scope = $data['scope'] ?? 'mine';

        $query = Assignment::query()
            ->with(['assignee:id,name'])
            ->where('tenant_id', $user->tenant_id)
            ->where('is_template', false)
            ->whereNotNull('due_date')
            ->whereDate('due_date', '>=', $from)
            ->whereDate('due_date', '<=', $to)
            ->orderBy('due_date');

        if ($scope === 'mine') {
            $query->where('assigned_to', $user->id);
        } elseif ($scope === 'team' && $user->department_id) {
            $query->where('department_id', $user->department_id);
        }

        $items = $query->limit(500)->get()->map(fn (Assignment $a) => [
            'id' => $a->id,
            'title' => $a->title,
            'status' => $a->status,
            'priority' => $a->priority,
            'start_date' => $a->start_date?->toDateString(),
            'due_date' => $a->due_date?->toDateString(),
            'assigned_to' => $a->assignee?->name,
        ]);

        return response()->json([
            'from' => $from,
            'to' => $to,
            'scope' => $scope,
            'data' => $items,
        ]);
    }

    /**
     * Google-ready ICS feed (works without Google OAuth credentials).
     */
    public function calendarIcs(Request $request): Response
    {
        $user = $request->user();
        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'scope' => ['nullable', 'string', 'in:mine,team,register'],
        ]);
        $from = $data['from'] ?? now()->startOfMonth()->toDateString();
        $to = $data['to'] ?? now()->addMonths(3)->endOfMonth()->toDateString();
        $scope = $data['scope'] ?? 'mine';

        $assignments = $this->ics->buildCalendarQuery($user, $scope, $from, $to)->limit(500)->get();
        $ics = $this->ics->toIcs($assignments);

        return response($ics, 200, [
            'Content-Type' => 'text/calendar; charset=utf-8',
            'Content-Disposition' => 'attachment; filename="assignments.ics"',
        ]);
    }

    public function calendarFeed(Request $request): JsonResponse
    {
        $sync = app(\App\Modules\Assignments\Services\AssignmentGoogleCalendarSyncService::class);
        $googlePresent = $sync->credentialsPresent();

        return response()->json([
            'data' => array_merge(
                $this->ics->feedMeta($request->user(), $googlePresent),
                ['sync_status' => $sync->syncStatus()]
            ),
        ]);
    }

    public function rotateCalendarFeed(Request $request): JsonResponse
    {
        $this->ics->rotateFeed($request->user());
        $sync = app(\App\Modules\Assignments\Services\AssignmentGoogleCalendarSyncService::class);
        $googlePresent = $sync->credentialsPresent();

        return response()->json([
            'data' => array_merge(
                $this->ics->feedMeta($request->user(), $googlePresent),
                ['sync_status' => $sync->syncStatus()]
            ),
        ]);
    }

    /**
     * Public ICS subscribe for calendar clients. Auth is the opaque feed token.
     * Invalid, revoked, or disabled-user tokens 404 (do not leak 401).
     */
    public function calendarSubscribe(string $token): Response
    {
        $ics = $this->ics->icsForSubscribeToken($token);
        if ($ics === null) {
            abort(404);
        }

        return response($ics, 200, [
            'Content-Type' => 'text/calendar; charset=utf-8',
            'Content-Disposition' => 'inline; filename="assignments.ics"',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    public function capacity(Request $request): JsonResponse
    {
        $data = $request->validate([
            'department_id' => ['nullable', 'integer'],
        ]);

        return response()->json([
            'data' => $this->capacity->capacity($request->user(), $data['department_id'] ?? null),
        ]);
    }

    public function workloadForecast(Request $request): JsonResponse
    {
        $data = $request->validate([
            'weeks' => ['nullable', 'integer', 'min:1', 'max:26'],
            'department_id' => ['nullable', 'integer'],
        ]);

        return response()->json([
            'data' => $this->workload->forecast(
                $request->user(),
                (int) ($data['weeks'] ?? 4),
                $data['department_id'] ?? null
            ),
        ]);
    }

    public function handoverPack(Request $request): JsonResponse
    {
        $data = $request->validate([
            'from_user_id' => ['required', 'integer'],
            'to_user_id' => ['nullable', 'integer'],
        ]);

        return response()->json([
            'data' => $this->handover->pack(
                $request->user(),
                (int) $data['from_user_id'],
                isset($data['to_user_id']) ? (int) $data['to_user_id'] : null
            ),
        ]);
    }

    public function handoverPackDocx(Request $request): Response
    {
        $data = $request->validate([
            'from_user_id' => ['required', 'integer'],
            'to_user_id' => ['nullable', 'integer'],
        ]);

        return $this->handover->docx(
            $request->user(),
            (int) $data['from_user_id'],
            isset($data['to_user_id']) ? (int) $data['to_user_id'] : null
        );
    }

    public function nlSearch(Request $request): JsonResponse
    {
        $data = $request->validate([
            'q' => ['required', 'string', 'max:500'],
        ]);

        return response()->json(['data' => $this->nlSearch->suggest($data['q'])]);
    }

    public function timesheetHours(Request $request, Assignment $assignment): JsonResponse
    {
        return response()->json(['data' => $this->timesheetHours->hours($assignment, $request->user())]);
    }

    public function importIcs(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ics' => ['nullable', 'string'],
            'file' => ['nullable', 'file', 'max:2048'],
        ]);

        $ics = $data['ics'] ?? null;
        if (! $ics && $request->hasFile('file')) {
            $ics = file_get_contents($request->file('file')->getRealPath()) ?: '';
        }
        if (! $ics) {
            return response()->json(['message' => 'Provide ics text or file.'], 422);
        }

        $result = $this->icsImport->import($ics, $request->user());

        return response()->json(['message' => 'ICS import complete.', 'data' => $result], 201);
    }

    public function dependencies(Request $request, Assignment $assignment): JsonResponse
    {
        return response()->json(['data' => $this->dependencies->listFor($assignment, $request->user())]);
    }

    public function addDependency(Request $request, Assignment $assignment): JsonResponse
    {
        $data = $request->validate([
            'depends_on_assignment_id' => ['required', 'integer'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $dep = $this->dependencies->add(
            $assignment,
            (int) $data['depends_on_assignment_id'],
            $request->user(),
            $data['notes'] ?? null
        );

        return response()->json(['message' => 'Dependency added.', 'data' => $dep], 201);
    }

    public function removeDependency(Request $request, Assignment $assignment, AssignmentDependency $dependency): JsonResponse
    {
        $this->dependencies->remove($assignment, $dependency, $request->user());

        return response()->json(['message' => 'Dependency removed.']);
    }

    public function stats(Request $request): JsonResponse
    {
        return response()->json($this->service->stats($request->user()));
    }

    public function reportsSummary(Request $request): JsonResponse
    {
        return response()->json($this->service->reportsSummary($request->user()));
    }

    public function weeklySummaryFeed(Request $request): JsonResponse
    {
        return response()->json($this->service->weeklySummaryFeed(
            $request->user(),
            $request->query('period_start'),
            $request->query('period_end')
        ));
    }

    public function show(Request $request, Assignment $assignment): JsonResponse
    {
        return response()->json($this->service->show($assignment, $request->user()));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->createRules());
        $assignment = $this->service->create($data, $request->user());

        return response()->json(['message' => 'Assignment created.', 'data' => $assignment], 201);
    }

    public function fromSource(Request $request): JsonResponse
    {
        $data = $request->validate(array_merge($this->createRules(), [
            'source_type' => ['required', 'string'],
            'source_id' => ['required', 'integer'],
            'source_purpose' => ['nullable', 'string', 'max:120'],
            'source_confidential' => ['sometimes', 'boolean'],
        ]));

        $assignment = $this->service->createFromSource($data, $request->user());

        return response()->json(['message' => 'Assignment linked from source.', 'data' => $assignment], 201);
    }

    public function update(Request $request, Assignment $assignment): JsonResponse
    {
        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['sometimes', 'string'],
            'objective' => ['nullable', 'string'],
            'expected_output' => ['nullable', 'string'],
            'acceptance_criteria' => ['nullable', 'string'],
            'evidence_required' => ['sometimes', 'boolean'],
            'completion_instructions' => ['nullable', 'string'],
            'type' => ['sometimes', 'in:individual,sector,collaborative'],
            'priority' => ['sometimes', 'in:low,medium,high,urgent,critical'],
            'assigned_to' => ['nullable', 'integer', 'exists:users,id'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'department_claim_due_at' => ['nullable', 'date'],
            'due_date' => ['sometimes', 'date'],
            'start_date' => ['nullable', 'date'],
            'checkin_frequency' => ['nullable', 'in:daily,weekly,biweekly,monthly'],
            'linked_programme_id' => ['nullable', 'integer'],
            'linked_event_id' => ['nullable', 'integer'],
            'is_confidential' => ['sometimes', 'boolean'],
            'review_required' => ['sometimes', 'boolean'],
            'reviewer_id' => ['nullable', 'integer', 'exists:users,id'],
            'contributor_ids' => ['sometimes', 'array'],
            'contributor_ids.*' => ['integer', 'exists:users,id'],
            'watcher_ids' => ['sometimes', 'array'],
            'watcher_ids.*' => ['integer', 'exists:users,id'],
        ]);

        $updated = $this->service->update($assignment, $data, $request->user());

        return response()->json(['message' => 'Assignment updated.', 'data' => $updated]);
    }

    public function destroy(Request $request, Assignment $assignment): JsonResponse
    {
        $this->service->delete($assignment, $request->user());

        return response()->json(['message' => 'Assignment deleted.']);
    }

    public function issue(Request $request, Assignment $assignment): JsonResponse
    {
        $result = $this->service->issue($assignment, $request->user());

        return response()->json(['message' => 'Assignment issued to assignee.', 'data' => $result]);
    }

    public function accept(Request $request, Assignment $assignment): JsonResponse
    {
        $data = $request->validate([
            'decision' => ['required', 'in:accepted,clarification_requested,deadline_proposed,rejected'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'proposed_deadline' => ['nullable', 'date'],
        ]);

        $result = $this->service->accept($assignment, $data, $request->user());

        return response()->json(['message' => 'Acceptance response recorded.', 'data' => $result]);
    }

    public function claim(Request $request, Assignment $assignment): JsonResponse
    {
        $data = $request->validate([
            'assigned_to' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        $result = $this->service->claim($assignment, $data, $request->user());

        return response()->json(['message' => 'Assignment claimed.', 'data' => $result]);
    }

    public function start(Request $request, Assignment $assignment): JsonResponse
    {
        $result = $this->service->start($assignment, $request->user());

        return response()->json(['message' => 'Assignment marked as active.', 'data' => $result]);
    }

    public function addUpdate(Request $request, Assignment $assignment): JsonResponse
    {
        $data = $request->validate([
            'type' => ['sometimes', 'in:update,comment,feedback,escalation,closure_request'],
            'progress_percent' => ['nullable', 'integer', 'min:0', 'max:100'],
            'notes' => ['required', 'string', 'max:5000'],
            'blocker_type' => ['nullable', 'string', 'max:64'],
            'blocker_details' => ['nullable', 'string', 'max:2000'],
            'blocker_owner_id' => ['nullable', 'integer', 'exists:users,id'],
            'blocker_expected_resolution_at' => ['nullable', 'date'],
        ]);

        $update = $this->service->addUpdate($assignment, $data, $request->user());

        return response()->json(['message' => 'Update posted.', 'data' => $update], 201);
    }

    public function block(Request $request, Assignment $assignment): JsonResponse
    {
        $data = $request->validate([
            'blocker_type' => ['required', 'string', 'max:64'],
            'blocker_details' => ['nullable', 'string', 'max:2000'],
            'blocker_owner_id' => ['required', 'integer', 'exists:users,id'],
            'blocker_expected_resolution_at' => ['nullable', 'date'],
        ]);

        $result = $this->service->block($assignment, $data, $request->user());

        return response()->json(['message' => 'Assignment blocked.', 'data' => $result]);
    }

    public function unblock(Request $request, Assignment $assignment): JsonResponse
    {
        $data = $request->validate([
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $result = $this->service->unblock($assignment, $data, $request->user());

        return response()->json(['message' => 'Assignment unblocked.', 'data' => $result]);
    }

    public function complete(Request $request, Assignment $assignment): JsonResponse
    {
        $data = $request->validate([
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);

        $result = $this->service->complete($assignment, $data, $request->user());

        return response()->json(['message' => 'Assignment submitted for closure/review.', 'data' => $result]);
    }

    public function verify(Request $request, Assignment $assignment): JsonResponse
    {
        $data = $request->validate([
            'decision' => ['required', 'in:accepted,returned,request_evidence,accepted_with_follow_up'],
            'comments' => ['nullable', 'string', 'max:5000'],
            'follow_up_required' => ['sometimes', 'boolean'],
            'acceptance_criteria_results' => ['nullable', 'array'],
        ]);

        $result = $this->service->verify($assignment, $data, $request->user());

        return response()->json(['message' => 'Review decision recorded.', 'data' => $result]);
    }

    public function close(Request $request, Assignment $assignment): JsonResponse
    {
        $data = $request->validate([
            'notes' => ['nullable', 'string', 'max:5000'],
            'rating' => ['nullable', 'integer', 'min:1', 'max:5'],
        ]);

        $result = $this->service->close($assignment, $data, $request->user());

        return response()->json(['message' => 'Assignment closed.', 'data' => $result]);
    }

    public function returnAssignment(Request $request, Assignment $assignment): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['required', 'string', 'max:2000'],
        ]);

        $result = $this->service->returnAssignment($assignment, $data, $request->user());

        return response()->json(['message' => 'Assignment returned to assignee.', 'data' => $result]);
    }

    public function cancel(Request $request, Assignment $assignment): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:2000'],
        ]);

        $result = $this->service->cancel($assignment, $data, $request->user());

        return response()->json(['message' => 'Assignment cancelled.', 'data' => $result]);
    }

    public function reassign(Request $request, Assignment $assignment): JsonResponse
    {
        $data = $request->validate([
            'assigned_to' => ['required', 'integer', 'exists:users,id'],
            'reason' => ['required', 'string', 'max:2000'],
            'acted_via_delegation_id' => ['nullable', 'integer'],
        ]);

        $result = $this->service->reassign($assignment, $data, $request->user());

        return response()->json(['message' => 'Assignment reassigned.', 'data' => $result]);
    }

    public function changeDueDate(Request $request, Assignment $assignment): JsonResponse
    {
        $data = $request->validate([
            'due_date' => ['required', 'date'],
            'reason' => ['required', 'string', 'max:2000'],
        ]);

        $result = $this->service->changeDueDate($assignment, $data, $request->user());

        return response()->json(['message' => 'Due date updated.', 'data' => $result]);
    }

    public function addParticipant(Request $request, Assignment $assignment): JsonResponse
    {
        $data = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'role' => ['required', 'in:contributor,watcher,reviewer'],
        ]);

        $participant = $this->service->addParticipant($assignment, $data, $request->user());

        return response()->json(['message' => 'Participant added.', 'data' => $participant], 201);
    }

    public function addChecklistItem(Request $request, Assignment $assignment): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'sequence' => ['nullable', 'integer'],
            'mandatory' => ['sometimes', 'boolean'],
            'assignee_id' => ['nullable', 'integer', 'exists:users,id'],
            'due_at' => ['nullable', 'date'],
        ]);

        $item = $this->service->addChecklistItem($assignment, $data, $request->user());

        return response()->json(['message' => 'Checklist item added.', 'data' => $item], 201);
    }

    public function toggleChecklistItem(Request $request, Assignment $assignment, AssignmentChecklistItem $checklistItem): JsonResponse
    {
        abort_if($checklistItem->assignment_id !== $assignment->id, 404);
        $data = $request->validate([
            'completed' => ['required', 'boolean'],
        ]);

        $item = $this->service->toggleChecklistItem($checklistItem, $request->user(), (bool) $data['completed']);

        return response()->json(['message' => 'Checklist updated.', 'data' => $item]);
    }

    public function createSubtask(Request $request, Assignment $assignment): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string'],
            'assigned_to' => ['nullable', 'integer', 'exists:users,id'],
            'due_date' => ['nullable', 'date'],
            'priority' => ['sometimes', 'in:low,medium,high,urgent,critical'],
        ]);

        $sub = $this->service->createSubtask($assignment, $data, $request->user());

        return response()->json(['message' => 'Subtask created.', 'data' => $sub], 201);
    }

    public function storeTemplate(Request $request): JsonResponse
    {
        $data = $request->validate(array_merge($this->createRules(), [
            'recurrence_rule' => ['nullable', 'array'],
            'recurrence_next_run_at' => ['nullable', 'date'],
        ]));

        $template = $this->service->createTemplate($data, $request->user());

        return response()->json(['message' => 'Recurring template created.', 'data' => $template], 201);
    }

    public function generateFromTemplate(Request $request, Assignment $assignment): JsonResponse
    {
        $data = $request->validate([
            'due_date' => ['nullable', 'date'],
        ]);

        $instance = $this->service->generateFromTemplate($assignment, $request->user(), $data['due_date'] ?? null);

        return response()->json(['message' => 'Recurring instance generated.', 'data' => $instance], 201);
    }

    private function createRules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string'],
            'objective' => ['nullable', 'string'],
            'expected_output' => ['nullable', 'string'],
            'acceptance_criteria' => ['nullable', 'string'],
            'evidence_required' => ['sometimes', 'boolean'],
            'completion_instructions' => ['nullable', 'string'],
            'type' => ['sometimes', 'in:individual,sector,collaborative'],
            'priority' => ['sometimes', 'in:low,medium,high,urgent,critical'],
            'assigned_to' => ['nullable', 'integer', 'exists:users,id'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'department_claim_due_at' => ['nullable', 'date'],
            'due_date' => ['required', 'date', 'after_or_equal:today'],
            'start_date' => ['nullable', 'date'],
            'checkin_frequency' => ['nullable', 'in:daily,weekly,biweekly,monthly'],
            'linked_programme_id' => ['nullable', 'integer'],
            'linked_event_id' => ['nullable', 'integer'],
            'meeting_minutes_id' => ['nullable', 'integer'],
            'source_type' => ['nullable', 'string', 'max:64'],
            'source_id' => ['nullable', 'integer'],
            'source_reference' => ['nullable', 'string', 'max:255'],
            'source_title' => ['nullable', 'string', 'max:255'],
            'source_purpose' => ['nullable', 'string', 'max:120'],
            'is_confidential' => ['sometimes', 'boolean'],
            'review_required' => ['sometimes', 'boolean'],
            'reviewer_id' => ['nullable', 'integer', 'exists:users,id'],
            'contributor_ids' => ['sometimes', 'array'],
            'contributor_ids.*' => ['integer', 'exists:users,id'],
            'watcher_ids' => ['sometimes', 'array'],
            'watcher_ids.*' => ['integer', 'exists:users,id'],
            'parent_id' => ['nullable', 'integer', 'exists:assignments,id'],
            'is_template' => ['sometimes', 'boolean'],
            'recurrence_rule' => ['nullable', 'array'],
            'recurrence_next_run_at' => ['nullable', 'date'],
        ];
    }
}
