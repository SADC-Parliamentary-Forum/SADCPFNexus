<?php

namespace App\Http\Controllers\Api\V1\Assignments;

use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Modules\Assignments\Services\AssignmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AssignmentController extends Controller
{
    public function __construct(private readonly AssignmentService $service) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->only(['status', 'priority', 'assigned_to', 'department_id', 'overdue', 'search', 'per_page']);
        return response()->json($this->service->list($filters, $request->user()));
    }

    public function stats(Request $request): JsonResponse
    {
        return response()->json($this->service->stats($request->user()));
    }

    public function show(Assignment $assignment): JsonResponse
    {
        return response()->json(
            $assignment->load(['creator', 'assignee', 'department', 'updates.submitter', 'attachments.uploader'])
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title'               => ['required', 'string', 'max:255'],
            'description'         => ['required', 'string'],
            'objective'           => ['nullable', 'string'],
            'expected_output'     => ['nullable', 'string'],
            'type'                => ['sometimes', 'in:individual,sector,collaborative'],
            'priority'            => ['sometimes', 'in:low,medium,high,critical'],
            'assigned_to'         => ['nullable', 'integer', 'exists:users,id'],
            'department_id'       => ['nullable', 'integer', 'exists:departments,id'],
            'due_date'            => ['required', 'date', 'after_or_equal:today'],
            'start_date'          => ['nullable', 'date'],
            'checkin_frequency'   => ['nullable', 'in:daily,weekly,biweekly,monthly'],
            'linked_programme_id' => ['nullable', 'integer'],
            'linked_event_id'     => ['nullable', 'integer'],
            'is_confidential'     => ['sometimes', 'boolean'],
        ]);

        $assignment = $this->service->create($data, $request->user());
        return response()->json(['message' => 'Assignment created.', 'data' => $assignment], 201);
    }

    public function update(Request $request, Assignment $assignment): JsonResponse
    {
        $data = $request->validate([
            'title'               => ['sometimes', 'string', 'max:255'],
            'description'         => ['sometimes', 'string'],
            'objective'           => ['nullable', 'string'],
            'expected_output'     => ['nullable', 'string'],
            'type'                => ['sometimes', 'in:individual,sector,collaborative'],
            'priority'            => ['sometimes', 'in:low,medium,high,critical'],
            'assigned_to'         => ['nullable', 'integer', 'exists:users,id'],
            'department_id'       => ['nullable', 'integer', 'exists:departments,id'],
            'due_date'            => ['sometimes', 'date'],
            'start_date'          => ['nullable', 'date'],
            'checkin_frequency'   => ['nullable', 'in:daily,weekly,biweekly,monthly'],
            'linked_programme_id' => ['nullable', 'integer'],
            'linked_event_id'     => ['nullable', 'integer'],
            'is_confidential'     => ['sometimes', 'boolean'],
        ]);

        $updated = $this->service->update($assignment, $data, $request->user());
        return response()->json(['message' => 'Assignment updated.', 'data' => $updated]);
    }

    public function destroy(Request $request, Assignment $assignment): JsonResponse
    {
        $this->service->delete($assignment, $request->user());
        return response()->json(['message' => 'Assignment deleted.']);
    }

    // ── Workflow actions ───────────────────────────────────────────────────────

    public function issue(Request $request, Assignment $assignment): JsonResponse
    {
        $result = $this->service->issue($assignment, $request->user());
        return response()->json(['message' => 'Assignment issued to assignee.', 'data' => $result]);
    }

    public function accept(Request $request, Assignment $assignment): JsonResponse
    {
        $data = $request->validate([
            'decision'          => ['required', 'in:accepted,clarification_requested,deadline_proposed,rejected'],
            'notes'             => ['nullable', 'string', 'max:2000'],
            'proposed_deadline' => ['nullable', 'date'],
        ]);

        $result = $this->service->accept($assignment, $data, $request->user());
        return response()->json(['message' => 'Acceptance response recorded.', 'data' => $result]);
    }

    public function start(Request $request, Assignment $assignment): JsonResponse
    {
        $result = $this->service->start($assignment, $request->user());
        return response()->json(['message' => 'Assignment marked as active.', 'data' => $result]);
    }

    public function addUpdate(Request $request, Assignment $assignment): JsonResponse
    {
        $data = $request->validate([
            'type'             => ['sometimes', 'in:update,comment,feedback,escalation,closure_request'],
            'progress_percent' => ['nullable', 'integer', 'min:0', 'max:100'],
            'notes'            => ['required', 'string', 'max:5000'],
            'blocker_type'     => ['nullable', 'in:awaiting_approval,awaiting_funds,awaiting_information,external_dependency'],
            'blocker_details'  => ['nullable', 'string', 'max:2000'],
        ]);

        $update = $this->service->addUpdate($assignment, $data, $request->user());
        return response()->json(['message' => 'Update posted.', 'data' => $update], 201);
    }

    public function complete(Request $request, Assignment $assignment): JsonResponse
    {
        $data = $request->validate([
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);

        $result = $this->service->complete($assignment, $data, $request->user());
        return response()->json(['message' => 'Assignment submitted for closure.', 'data' => $result]);
    }

    public function close(Request $request, Assignment $assignment): JsonResponse
    {
        $data = $request->validate([
            'notes'  => ['nullable', 'string', 'max:5000'],
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
}
