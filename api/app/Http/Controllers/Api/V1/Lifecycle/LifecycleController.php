<?php

namespace App\Http\Controllers\Api\V1\Lifecycle;

use App\Http\Controllers\Controller;
use App\Models\Lifecycle\LifecycleCase;
use App\Models\Lifecycle\LifecycleException;
use App\Models\Lifecycle\LifecycleJourneyTemplateVersion;
use App\Models\Lifecycle\LifecycleTaskInstance;
use App\Modules\Lifecycle\Services\LifecycleCaseService;
use App\Modules\Lifecycle\Services\LifecycleClearanceService;
use App\Modules\Lifecycle\Services\LifecycleTemplateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LifecycleController extends Controller
{
    public function __construct(
        private readonly LifecycleCaseService $cases,
        private readonly LifecycleClearanceService $clearance,
        private readonly LifecycleTemplateService $templates,
    ) {}

    public function dashboard(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->cases->dashboard($request->user())]);
    }

    public function listCases(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'lifecycle_type' => ['nullable', 'in:onboarding,separation'],
            'status' => ['nullable', 'string'],
        ]);

        return response()->json(['data' => $this->cases->listCases($request->user(), $filters)]);
    }

    public function myTasks(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->cases->myTasks($request->user())]);
    }

    public function initiateOnboarding(Request $request): JsonResponse
    {
        $data = $request->validate([
            'employee_id' => ['required', 'integer', 'exists:users,id'],
            'person_id' => ['nullable', 'integer'],
            'template_code' => ['nullable', 'string', 'max:64'],
            'template_version_id' => ['nullable', 'integer'],
            'employment_category' => ['nullable', 'string', 'max:32'],
            'employee_category' => ['nullable', 'string', 'max:32'],
            'start_date' => ['nullable', 'date'],
            'target_start_date' => ['nullable', 'date'],
            'initiate_appointment_workflow' => ['nullable', 'boolean'],
        ]);

        $case = $this->cases->initiateOnboarding($request->user(), $data);

        return response()->json(['data' => $this->cases->show($case, $request->user())], 201);
    }

    public function initiateSeparation(Request $request): JsonResponse
    {
        $data = $request->validate([
            'employee_id' => ['required', 'integer', 'exists:users,id'],
            'person_id' => ['nullable', 'integer'],
            'separation_reason' => ['nullable', 'string', 'max:64'],
            'template_code' => ['nullable', 'string', 'max:64'],
            'template_version_id' => ['nullable', 'integer'],
            'grade_band_id' => ['nullable', 'integer'],
            'contract_type_id' => ['nullable', 'integer'],
            'employment_category' => ['nullable', 'string', 'max:32'],
            'last_working_day' => ['nullable', 'date'],
            'initiated_at' => ['nullable', 'date'],
        ]);

        $case = $this->cases->initiateSeparation($request->user(), $data);

        return response()->json(['data' => $this->cases->show($case, $request->user())], 201);
    }

    public function show(Request $request, LifecycleCase $lifecycleCase): JsonResponse
    {
        $this->assertTenantCase($request, $lifecycleCase);

        return response()->json(['data' => $this->cases->show($lifecycleCase, $request->user())]);
    }

    public function tasks(Request $request, LifecycleCase $lifecycleCase): JsonResponse
    {
        $this->assertTenantCase($request, $lifecycleCase);
        $payload = $this->cases->show($lifecycleCase, $request->user());

        return response()->json(['data' => collect($payload['stages'] ?? [])->flatMap(fn ($s) => $s['tasks'] ?? [])->values()]);
    }

    public function timeline(Request $request, LifecycleCase $lifecycleCase): JsonResponse
    {
        $this->assertTenantCase($request, $lifecycleCase);

        return response()->json(['data' => $this->cases->timeline($lifecycleCase, $request->user())]);
    }

    public function completeTask(Request $request, LifecycleTaskInstance $lifecycleTask): JsonResponse
    {
        $this->assertTenantTask($request, $lifecycleTask);
        $data = $request->validate(['revision' => ['required', 'integer']]);

        $task = $this->cases->completeTask($lifecycleTask, $request->user(), (int) $data['revision']);

        return response()->json(['data' => $task]);
    }

    public function reopenTask(Request $request, LifecycleTaskInstance $lifecycleTask): JsonResponse
    {
        $this->assertTenantTask($request, $lifecycleTask);
        $data = $request->validate(['revision' => ['required', 'integer']]);

        $task = $this->cases->reopenTask($lifecycleTask, $request->user(), (int) $data['revision']);

        return response()->json(['data' => $task]);
    }

    public function updateClearance(Request $request, LifecycleTaskInstance $lifecycleTask): JsonResponse
    {
        $this->assertTenantTask($request, $lifecycleTask);
        $data = $request->validate([
            'clearance_status' => ['required', 'in:pending,cleared,not_cleared'],
            'revision' => ['required', 'integer'],
        ]);

        $task = $this->clearance->updateClearance(
            $lifecycleTask,
            $request->user(),
            $data['clearance_status'],
            (int) $data['revision']
        );

        return response()->json(['data' => $task]);
    }

    public function requestException(Request $request, LifecycleTaskInstance $lifecycleTask): JsonResponse
    {
        $this->assertTenantTask($request, $lifecycleTask);
        $data = $request->validate([
            'reason' => ['required', 'string', 'max:2000'],
            'exception_type' => ['nullable', 'string', 'max:64'],
        ]);

        $exception = $this->clearance->requestException(
            $lifecycleTask,
            $request->user(),
            $data['reason'],
            $data['exception_type'] ?? 'clearance_override'
        );

        return response()->json(['data' => $exception], 201);
    }

    public function approveException(Request $request, LifecycleException $lifecycleException): JsonResponse
    {
        if ($lifecycleException->tenant_id !== $request->user()->tenant_id) {
            abort(404);
        }

        $data = $request->validate(['resolution_notes' => ['nullable', 'string', 'max:2000']]);

        $exception = $this->clearance->approveException(
            $lifecycleException,
            $request->user(),
            $data['resolution_notes'] ?? null
        );

        return response()->json(['data' => $exception]);
    }

    public function approveTerminalPayment(Request $request, LifecycleCase $lifecycleCase): JsonResponse
    {
        $this->assertTenantCase($request, $lifecycleCase);
        $data = $request->validate(['revision' => ['required', 'integer']]);

        $this->clearance->assertTerminalPaymentAllowed($lifecycleCase);
        $case = $this->clearance->approveTerminalPayment($lifecycleCase, $request->user(), (int) $data['revision']);

        return response()->json(['data' => $case]);
    }

    public function assertTerminalPayment(Request $request, LifecycleCase $lifecycleCase): JsonResponse
    {
        $this->assertTenantCase($request, $lifecycleCase);

        try {
            $this->clearance->assertTerminalPaymentAllowed($lifecycleCase);

            return response()->json(['allowed' => true]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['allowed' => false, 'message' => $e->getMessage()], 422);
        }
    }

    public function finaliseSeparation(Request $request, LifecycleCase $lifecycleCase): JsonResponse
    {
        $this->assertTenantCase($request, $lifecycleCase);
        $data = $request->validate(['revision' => ['required', 'integer']]);

        $case = $this->cases->finaliseSeparation($lifecycleCase, $request->user(), (int) $data['revision']);

        return response()->json(['data' => $case]);
    }

    private function assertTenantCase(Request $request, LifecycleCase $case): void
    {
        if ($case->tenant_id !== $request->user()->tenant_id) {
            abort(404);
        }
    }

    private function assertTenantTask(Request $request, LifecycleTaskInstance $task): void
    {
        if ($task->tenant_id !== $request->user()->tenant_id) {
            abort(404);
        }
    }
}
