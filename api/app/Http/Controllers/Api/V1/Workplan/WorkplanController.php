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
        $data = $request->validate([
            'title'         => ['required', 'string', 'max:255'],
            'type'          => ['required', 'string', 'in:meeting,travel,leave,milestone,deadline'],
            'date'          => ['required', 'date'],
            'end_date'      => ['nullable', 'date', 'after_or_equal:date'],
            'description'   => ['nullable', 'string', 'max:2000'],
            'responsible'   => ['nullable', 'string', 'max:255'],
            'linked_module' => ['nullable', 'string', 'max:50'],
            'linked_id'     => ['nullable', 'integer'],
        ]);

        $event = $this->service->create($data, $request->user());
        return response()->json(['message' => 'Event created.', 'data' => $event], 201);
    }

    public function update(Request $request, WorkplanEvent $event): JsonResponse
    {
        $data = $request->validate([
            'title'         => ['sometimes', 'string', 'max:255'],
            'type'          => ['sometimes', 'string', 'in:meeting,travel,leave,milestone,deadline'],
            'date'          => ['sometimes', 'date'],
            'end_date'      => ['nullable', 'date'],
            'description'   => ['nullable', 'string', 'max:2000'],
            'responsible'   => ['nullable', 'string', 'max:255'],
            'linked_module' => ['nullable', 'string', 'max:50'],
            'linked_id'     => ['nullable', 'integer'],
        ]);

        $event = $this->service->update($event, $data);
        return response()->json(['message' => 'Event updated.', 'data' => $event]);
    }

    public function destroy(WorkplanEvent $event): JsonResponse
    {
        $this->service->delete($event);
        return response()->json(['message' => 'Event deleted.']);
    }

    public function show(WorkplanEvent $event): JsonResponse
    {
        return response()->json($event->load('creator'));
    }
}
