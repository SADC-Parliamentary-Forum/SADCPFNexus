<?php

namespace App\Http\Controllers\Api\V1\Decisions;

use App\Http\Controllers\Controller;
use App\Models\MeetingAgendaItem;
use App\Models\MeetingDecision;
use App\Modules\Decisions\Services\DecisionAssignmentPromoteService;
use App\Modules\Decisions\Services\MeetingAgendaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeetingAgendaController extends Controller
{
    public function __construct(
        private readonly MeetingAgendaService $agenda,
        private readonly DecisionAssignmentPromoteService $promote,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'workplan_event_id' => ['sometimes', 'integer'],
            'meeting_minutes_id' => ['sometimes', 'integer'],
            'status' => ['sometimes', 'string'],
        ]);

        return response()->json(['data' => $this->agenda->list($request->user(), $filters)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:500'],
            'description' => ['nullable', 'string'],
            'sequence' => ['sometimes', 'integer', 'min:1', 'max:999'],
            'status' => ['sometimes', 'in:open,discussed,deferred,closed'],
            'workplan_event_id' => ['nullable', 'integer', 'exists:workplan_events,id'],
            'meeting_minutes_id' => ['nullable', 'integer', 'exists:meeting_minutes,id'],
            'meeting_decision_id' => ['nullable', 'integer', 'exists:meeting_decisions,id'],
            'presenter_id' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        $item = $this->agenda->create($data, $request->user());

        return response()->json(['message' => 'Agenda item created.', 'data' => $item], 201);
    }

    public function linkDecision(Request $request, MeetingAgendaItem $agendaItem): JsonResponse
    {
        $data = $request->validate([
            'meeting_decision_id' => ['required', 'integer', 'exists:meeting_decisions,id'],
        ]);

        $decision = MeetingDecision::findOrFail($data['meeting_decision_id']);
        $item = $this->agenda->linkDecision($agendaItem, $decision, $request->user());

        return response()->json(['message' => 'Agenda item linked to decision.', 'data' => $item]);
    }

    public function ownerOptions(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->agenda->listOwnerOptions($request->user())]);
    }

    public function minutesOptions(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->agenda->listMinutesOptions($request->user())]);
    }

    public function promoteWeekly(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless(
            $user->can('decisions.manage')
            || $user->hasAnyRole(['System Admin', 'Governance Officer', 'Director']),
            403
        );

        $result = $this->promote->promoteTenant((int) $user->tenant_id);

        return response()->json(['message' => 'Weekly decision promotion complete.', 'data' => $result]);
    }

    public function promoteRisks(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless(
            $user->can('decisions.manage')
            || $user->hasAnyRole(['System Admin', 'Governance Officer', 'Director']),
            403
        );

        $result = app(\App\Modules\Decisions\Services\DecisionRiskPromoteService::class)
            ->promoteTenant((int) $user->tenant_id);

        return response()->json(['message' => 'Risk promotion complete. Draft risks only; decisions stay open.', 'data' => $result]);
    }

    public function promoteMeetingPack(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless(
            $user->can('decisions.manage')
            || $user->hasAnyRole(['System Admin', 'Governance Officer', 'Director']),
            403
        );

        $tenantId = (int) $user->tenant_id;

        return response()->json([
            'message' => 'Meeting pack promotion complete. Assignments and risks stay human-owned.',
            'data' => [
                'assignments' => $this->promote->promoteTenant($tenantId),
                'risks' => app(\App\Modules\Decisions\Services\DecisionRiskPromoteService::class)->promoteTenant($tenantId),
                'auto_complete' => false,
                'auto_close_decisions' => false,
            ],
        ]);
    }

    public function promoteFromMinutes(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless(
            $user->can('decisions.manage')
            || $user->hasAnyRole(['System Admin', 'Governance Officer', 'Director']),
            403
        );

        $data = $request->validate([
            'meeting_minutes_id' => ['required', 'integer'],
        ]);

        $minutes = \App\Models\MeetingMinutes::query()
            ->where('tenant_id', $user->tenant_id)
            ->findOrFail((int) $data['meeting_minutes_id']);

        $tenantId = (int) $user->tenant_id;
        $minutesId = (int) $minutes->id;

        return response()->json([
            'message' => 'Minutes promotion complete. Decisions stay open.',
            'data' => [
                'meeting_minutes_id' => $minutesId,
                'assignments' => $this->promote->promoteTenant($tenantId, $minutesId),
                'risks' => app(\App\Modules\Decisions\Services\DecisionRiskPromoteService::class)->promoteTenant($tenantId, $minutesId),
                'auto_complete' => false,
                'auto_close_decisions' => false,
            ],
        ]);
    }
}
