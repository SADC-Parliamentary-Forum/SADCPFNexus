<?php

namespace App\Http\Controllers\Api\V1\Workplan;

use App\Http\Controllers\Controller;
use App\Models\WorkplanEvent;
use App\Modules\Workplan\Services\WorkplanService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkplanController extends Controller
{
    public function __construct(private readonly WorkplanService $service) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->only(['type', 'month', 'year']);
        return response()->json($this->service->list($filters, $request->user()));
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'title'                 => ['required', 'string', 'max:255'],
            'type'                  => ['required', 'string', 'in:meeting,travel,leave,milestone,deadline'],
            'meeting_type_id'       => ['nullable', 'integer', 'exists:meeting_types,id'],
            'date'                  => ['required', 'date'],
            'end_date'              => ['nullable', 'date', 'after_or_equal:date'],
            'description'           => ['nullable', 'string', 'max:2000'],
            'responsible'           => ['nullable', 'string', 'max:255'],
            'responsible_user_ids'  => ['nullable', 'array'],
            'responsible_user_ids.*'=> ['integer', 'exists:users,id'],
            'linked_module'         => ['nullable', 'string', 'max:50'],
            'linked_id'             => ['nullable', 'integer'],
        ]);
        if (! empty($data['meeting_type_id']) && \App\Models\MeetingType::where('id', $data['meeting_type_id'])->where('tenant_id', $user->tenant_id)->doesntExist()) {
            abort(422, 'Meeting type not found or does not belong to your tenant.');
        }
        if (! empty($data['responsible_user_ids'])) {
            $data['responsible_user_ids'] = array_values(array_filter(
                $data['responsible_user_ids'],
                fn ($id) => \App\Models\User::where('id', $id)->where('tenant_id', $user->tenant_id)->exists()
            ));
        }
        $event = $this->service->create($data, $user);
        return response()->json(['message' => 'Event created.', 'data' => $event], 201);
    }

    public function update(Request $request, WorkplanEvent $event): JsonResponse
    {
        if ((int) $event->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
        $user = $request->user();
        $data = $request->validate([
            'title'                 => ['sometimes', 'string', 'max:255'],
            'type'                  => ['sometimes', 'string', 'in:meeting,travel,leave,milestone,deadline'],
            'meeting_type_id'       => ['nullable', 'integer', 'exists:meeting_types,id'],
            'date'                  => ['sometimes', 'date'],
            'end_date'              => ['nullable', 'date'],
            'description'           => ['nullable', 'string', 'max:2000'],
            'responsible'           => ['nullable', 'string', 'max:255'],
            'responsible_user_ids'  => ['nullable', 'array'],
            'responsible_user_ids.*'=> ['integer', 'exists:users,id'],
            'linked_module'         => ['nullable', 'string', 'max:50'],
            'linked_id'             => ['nullable', 'integer'],
        ]);
        if (array_key_exists('meeting_type_id', $data) && $data['meeting_type_id'] !== null
            && \App\Models\MeetingType::where('id', $data['meeting_type_id'])->where('tenant_id', $user->tenant_id)->doesntExist()) {
            abort(422, 'Meeting type not found or does not belong to your tenant.');
        }
        if (array_key_exists('responsible_user_ids', $data) && is_array($data['responsible_user_ids'])) {
            $data['responsible_user_ids'] = array_values(array_filter(
                $data['responsible_user_ids'],
                fn ($id) => \App\Models\User::where('id', $id)->where('tenant_id', $user->tenant_id)->exists()
            ));
        }
        $event = $this->service->update($event, $data);
        return response()->json(['message' => 'Event updated.', 'data' => $event]);
    }

    public function destroy(Request $request, WorkplanEvent $event): JsonResponse
    {
        if ((int) $event->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
        $this->service->delete($event);
        return response()->json(['message' => 'Event deleted.']);
    }

    public function show(Request $request, WorkplanEvent $event): JsonResponse
    {
        if ((int) $event->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
        return response()->json($event->load(['creator', 'meetingType', 'responsibleUsers:id,name,email', 'attachments']));
    }
}
