<?php

namespace App\Http\Controllers\Api\V1\Risk;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\Risk;
use App\Models\RiskAction;
use App\Modules\Risk\Services\RiskActionService;
use App\Support\UploadContentSniffer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class RiskActionController extends Controller
{
    public function __construct(private readonly RiskActionService $actionService) {}

    private function resolveRisk(int $riskId, Request $request): Risk
    {
        return Risk::where('id', $riskId)
            ->where('tenant_id', $request->user()->tenant_id)
            ->firstOrFail();
    }

    public function index(Request $request, Risk $risk): JsonResponse
    {
        // Tenant isolation
        if ((int) $risk->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $actions = $this->actionService->list($risk, $request->user());
        return response()->json(['data' => $actions]);
    }

    public function store(Request $request, Risk $risk): JsonResponse
    {
        if ((int) $risk->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $data = $request->validate([
            'description'    => ['required', 'string', 'max:2000'],
            'action_plan'    => ['nullable', 'string', 'max:5000'],
            'treatment_type' => ['nullable', 'string', 'in:mitigate,accept,transfer,avoid,share'],
            'due_date'       => ['nullable', 'date'],
            'owner_id'       => ['nullable', 'integer', 'exists:users,id'],
            'notes'          => ['nullable', 'string', 'max:2000'],
            'create_assignment' => ['nullable', 'boolean'],
        ]);

        $action = $this->actionService->create($risk, $data, $request->user());
        return response()->json(['message' => 'Action added.', 'data' => $action], 201);
    }

    public function update(Request $request, Risk $risk, RiskAction $action): JsonResponse
    {
        if ((int) $risk->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        // Ensure the action belongs to the risk
        if ((int) $action->risk_id !== (int) $risk->id) {
            abort(404);
        }

        $data = $request->validate([
            'description'    => ['sometimes', 'string', 'max:2000'],
            'action_plan'    => ['nullable', 'string', 'max:5000'],
            'treatment_type' => ['nullable', 'string', 'in:mitigate,accept,transfer,avoid'],
            'due_date'       => ['nullable', 'date'],
            'status'         => ['nullable', 'string', 'in:planned,in_progress,completed,overdue'],
            'progress'       => ['nullable', 'integer', 'min:0', 'max:100'],
            'owner_id'       => ['nullable', 'integer', 'exists:users,id'],
            'notes'          => ['nullable', 'string', 'max:2000'],
        ]);

        $updated = $this->actionService->update($action, $data, $request->user());
        return response()->json(['message' => 'Action updated.', 'data' => $updated]);
    }

    public function markComplete(Request $request, Risk $risk, RiskAction $action): JsonResponse
    {
        if ((int) $risk->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        if ((int) $action->risk_id !== (int) $risk->id) {
            abort(404);
        }

        $data = $request->validate([
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $updated = $this->actionService->markComplete($action, $data, $request->user());
        return response()->json(['message' => 'Action marked complete.', 'data' => $updated]);
    }

    public function destroy(Request $request, Risk $risk, RiskAction $action): JsonResponse
    {
        if ((int) $risk->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        if ((int) $action->risk_id !== (int) $risk->id) {
            abort(404);
        }

        $this->actionService->destroy($action, $request->user());
        return response()->json(['message' => 'Action deleted.']);
    }

    public function createAssignment(Request $request, Risk $risk, RiskAction $action): JsonResponse
    {
        if ((int) $risk->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
        if ((int) $action->risk_id !== (int) $risk->id) {
            abort(404);
        }

        $assignment = $this->actionService->createAssignmentForAction($action, $request->user(), $request->all());
        $action->update(['assignment_id' => $assignment->id]);

        return response()->json(['message' => 'Assignment linked.', 'data' => $action->fresh(['assignment'])], 201);
    }

    /**
     * Apply one mitigation (action + optional evidence file) to one or more risks.
     */
    public function applyToRisks(Request $request): JsonResponse
    {
        $data = $request->validate([
            'risk_ids' => ['required', 'array', 'min:1', 'max:50'],
            'risk_ids.*' => ['integer'],
            'description' => ['required', 'string', 'max:2000'],
            'treatment_type' => ['nullable', 'string', 'in:mitigate,accept,transfer,avoid,share'],
            'due_date' => ['nullable', 'date'],
            'file' => ['nullable', 'file', 'max:25600'],
            'document_type' => ['nullable', 'string', 'in:'.implode(',', Attachment::RISK_DOCUMENT_TYPES)],
        ]);

        $ids = array_values(array_unique(array_map('intval', $data['risk_ids'])));
        $user = $request->user();

        $risks = Risk::query()
            ->where('tenant_id', $user->tenant_id)
            ->whereIn('id', $ids)
            ->get();

        if ($risks->count() !== count($ids)) {
            abort(404);
        }

        $file = $request->file('file');
        $mime = $file ? UploadContentSniffer::assertAllowed($file) : null;
        $binary = $file ? $file->get() : null;
        $originalName = $file?->getClientOriginalName();
        $safeName = $originalName
            ? preg_replace('/[^A-Za-z0-9._-]+/', '_', basename(str_replace("\0", '', $originalName))) ?: 'mitigation.bin'
            : 'mitigation.bin';
        $size = $file?->getSize();

        $applied = DB::transaction(function () use ($risks, $data, $user, $file, $mime, $binary, $originalName, $safeName, $size) {
            $count = 0;
            foreach ($risks as $risk) {
                $this->actionService->create($risk, [
                    'description' => $data['description'],
                    'treatment_type' => $data['treatment_type'] ?? 'mitigate',
                    'due_date' => $data['due_date'] ?? null,
                    'owner_id' => $risk->risk_owner_id ?: $user->id,
                    'create_assignment' => false,
                ], $user, false);

                if ($file && $binary !== null && $originalName) {
                    $path = 'attachments/risks/'.$risk->id.'/'.uniqid('mitigation_', true).'_'.$safeName;
                    Storage::disk('local')->put($path, $binary);
                    $risk->attachments()->create([
                        'tenant_id' => $risk->tenant_id,
                        'uploaded_by' => $user->id,
                        'document_type' => $data['document_type'] ?? Attachment::DOCUMENT_TYPE_RISK_MITIGATION_PLAN,
                        'original_filename' => $originalName,
                        'storage_path' => $path,
                        'mime_type' => $mime,
                        'size_bytes' => $size,
                    ]);
                }
                $count++;
            }

            return $count;
        });

        return response()->json([
            'message' => 'Mitigation applied.',
            'applied' => $applied,
        ], 201);
    }
}
