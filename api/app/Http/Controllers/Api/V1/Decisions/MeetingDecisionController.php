<?php

namespace App\Http\Controllers\Api\V1\Decisions;

use App\Http\Controllers\Controller;
use App\Models\MeetingDecision;
use App\Models\MeetingDecisionAction;
use App\Modules\Decisions\Services\MeetingDecisionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeetingDecisionController extends Controller
{
    public function __construct(private readonly MeetingDecisionService $service) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['sometimes', 'string'],
            'decision_type' => ['sometimes', 'string'],
            'owner_id' => ['sometimes', 'integer'],
            'meeting_minutes_id' => ['sometimes', 'integer'],
            'q' => ['sometimes', 'string', 'max:200'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:200'],
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);

        return response()->json($this->service->list($request->user(), $filters));
    }

    public function dashboard(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->service->dashboard($request->user())]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'decision_type' => ['required', 'in:resolution,management_decision'],
            'title' => ['required', 'string', 'max:500'],
            'body' => ['nullable', 'string'],
            'owner_id' => ['nullable', 'exists:users,id'],
            'due_date' => ['nullable', 'date'],
            'meeting_minutes_id' => ['nullable', 'exists:meeting_minutes,id'],
            'workplan_event_id' => ['nullable', 'integer'],
            'is_confidential' => ['sometimes', 'boolean'],
            'source_type' => ['nullable', 'string', 'max:40'],
            'source_id' => ['nullable', 'integer'],
            'source_purpose' => ['nullable', 'string', 'max:60'],
        ]);

        $decision = $this->service->create($data, $request->user());

        return response()->json(['message' => 'Decision created.', 'data' => $decision], 201);
    }

    public function show(Request $request, MeetingDecision $decision): JsonResponse
    {
        return response()->json(['data' => $this->service->show($decision, $request->user())]);
    }

    public function update(Request $request, MeetingDecision $decision): JsonResponse
    {
        $data = $request->validate([
            'decision_type' => ['sometimes', 'in:resolution,management_decision'],
            'title' => ['sometimes', 'string', 'max:500'],
            'body' => ['nullable', 'string'],
            'owner_id' => ['nullable', 'exists:users,id'],
            'due_date' => ['nullable', 'date'],
            'meeting_minutes_id' => ['nullable', 'exists:meeting_minutes,id'],
            'workplan_event_id' => ['nullable', 'integer'],
            'is_confidential' => ['sometimes', 'boolean'],
        ]);

        $updated = $this->service->update($decision, $data, $request->user());

        return response()->json(['message' => 'Decision updated.', 'data' => $updated]);
    }

    public function destroy(Request $request, MeetingDecision $decision): JsonResponse
    {
        $this->service->delete($decision, $request->user());

        return response()->json(['message' => 'Decision deleted.']);
    }

    public function adopt(Request $request, MeetingDecision $decision): JsonResponse
    {
        $data = $request->validate([
            'adoption_notes' => ['nullable', 'string'],
            'owner_id' => ['nullable', 'exists:users,id'],
            'due_date' => ['nullable', 'date'],
        ]);

        $adopted = $this->service->adopt($decision, $data, $request->user());

        return response()->json(['message' => 'Decision adopted.', 'data' => $adopted]);
    }

    public function startProgress(Request $request, MeetingDecision $decision): JsonResponse
    {
        $updated = $this->service->startProgress($decision, $request->user());

        return response()->json(['message' => 'Decision marked in progress.', 'data' => $updated]);
    }

    public function markImplemented(Request $request, MeetingDecision $decision): JsonResponse
    {
        $data = $request->validate([
            'notes' => ['nullable', 'string'],
        ]);

        $updated = $this->service->markImplemented($decision, $data, $request->user());

        return response()->json(['message' => 'Decision marked implemented.', 'data' => $updated]);
    }

    public function close(Request $request, MeetingDecision $decision): JsonResponse
    {
        $data = $request->validate([
            'closure_notes' => ['nullable', 'string'],
        ]);

        $updated = $this->service->close($decision, $data, $request->user());

        return response()->json(['message' => 'Decision closed.', 'data' => $updated]);
    }

    public function supersede(Request $request, MeetingDecision $decision): JsonResponse
    {
        $data = $request->validate([
            'superseded_by_id' => ['required', 'integer', 'exists:meeting_decisions,id'],
            'notes' => ['nullable', 'string'],
        ]);

        $updated = $this->service->supersede($decision, $data, $request->user());

        return response()->json(['message' => 'Decision superseded.', 'data' => $updated]);
    }

    public function history(Request $request, MeetingDecision $decision): JsonResponse
    {
        $this->service->show($decision, $request->user());

        $rows = $decision->history()
            ->with('actor:id,name')
            ->orderByDesc('id')
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function listActions(Request $request, MeetingDecision $decision): JsonResponse
    {
        $this->service->show($decision, $request->user());

        return response()->json([
            'data' => $decision->actions()->with(['owner:id,name', 'assignment:id,reference_number,status'])->orderBy('id')->get(),
        ]);
    }

    public function storeAction(Request $request, MeetingDecision $decision): JsonResponse
    {
        $data = $request->validate([
            'description' => ['required', 'string', 'max:1000'],
            'notes' => ['nullable', 'string'],
            'priority' => ['sometimes', 'in:low,medium,high,critical'],
            'owner_id' => ['nullable', 'exists:users,id'],
            'due_date' => ['nullable', 'date'],
            'create_assignment' => ['sometimes', 'boolean'],
        ]);

        $action = $this->service->addAction($decision, $data, $request->user());

        return response()->json(['message' => 'Action added.', 'data' => $action], 201);
    }

    public function updateAction(Request $request, MeetingDecision $decision, MeetingDecisionAction $action): JsonResponse
    {
        abort_if((int) $action->meeting_decision_id !== (int) $decision->id, 404);

        $data = $request->validate([
            'description' => ['sometimes', 'string', 'max:1000'],
            'notes' => ['nullable', 'string'],
            'priority' => ['sometimes', 'in:low,medium,high,critical'],
            'status' => ['sometimes', 'in:open,in_progress,completed,cancelled'],
            'owner_id' => ['nullable', 'exists:users,id'],
            'due_date' => ['nullable', 'date'],
        ]);

        $updated = $this->service->updateAction($action, $data, $request->user());

        return response()->json(['message' => 'Action updated.', 'data' => $updated]);
    }

    public function createAssignment(Request $request, MeetingDecision $decision): JsonResponse
    {
        $data = $request->validate([
            'title' => ['nullable', 'string', 'max:500'],
            'description' => ['nullable', 'string'],
            'assigned_to' => ['nullable', 'exists:users,id'],
            'due_date' => ['nullable', 'date'],
            'priority' => ['sometimes', 'in:low,medium,high,critical'],
            'source_purpose' => ['nullable', 'string', 'max:120'],
        ]);

        $assignment = $this->service->createAssignmentForDecision($decision, $request->user(), $data);

        return response()->json(['message' => 'Assignment linked from decision.', 'data' => $assignment], 201);
    }

    public function createActionAssignment(Request $request, MeetingDecision $decision, MeetingDecisionAction $action): JsonResponse
    {
        abort_if((int) $action->meeting_decision_id !== (int) $decision->id, 404);

        $data = $request->validate([
            'assigned_to' => ['nullable', 'exists:users,id'],
            'assignment_title' => ['nullable', 'string', 'max:500'],
            'assignment_description' => ['nullable', 'string'],
        ]);

        $assignment = $this->service->createAssignmentForAction($action, $request->user(), $data);
        $action->update(['assignment_id' => $assignment->id, 'status' => 'in_progress']);

        return response()->json([
            'message' => 'Assignment linked from decision action.',
            'data' => $action->fresh(['owner:id,name', 'assignment:id,reference_number,status']),
            'assignment' => $assignment,
        ], 201);
    }
}
