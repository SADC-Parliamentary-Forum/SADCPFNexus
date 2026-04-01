<?php
namespace App\Http\Controllers\Api\V1\Hr;

use App\Http\Controllers\Controller;
use App\Models\PerformanceTracker;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;

class PerformanceTrackerController extends Controller
{
    private function hasHrAdmin(Request $request): bool
    {
        $user = $request->user();
        try {
            return $user->isSystemAdmin() || $user->hasPermissionTo('hr.admin');
        } catch (\Throwable $e) {
            return false;
        }
    }

    private function hasHrSupervisor(Request $request): bool
    {
        try {
            return $request->user()->hasPermissionTo('hr.supervisor');
        } catch (\Throwable $e) {
            return false;
        }
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $tenantId = $user->tenant_id ?? 0;

        try {
            $query = PerformanceTracker::where('tenant_id', $tenantId)
                ->with(['employee:id,name,email', 'supervisor:id,name,email']);

            if (! $this->hasHrAdmin($request)) {
                if ($this->hasHrSupervisor($request)) {
                    $query->where(function ($q) use ($user) {
                        $q->where('employee_id', $user->id)
                          ->orWhere('supervisor_id', $user->id);
                    });
                } else {
                    $query->where('employee_id', $user->id);
                }
            }

            $perPage = min((int) $request->input('per_page', 20), 100);
            if ($request->input('status')) {
                $query->where('status', $request->input('status'));
            }
            if ($request->input('employee_id')) {
                $query->where('employee_id', (int) $request->input('employee_id'));
            }

            return response()->json($query->orderByDesc('cycle_start')->paginate($perPage));
        } catch (QueryException $e) {
            $paginator = new LengthAwarePaginator([], 0, 20, 1);
            return response()->json($paginator);
        }
    }

    public function show(Request $request, PerformanceTracker $performanceTracker): JsonResponse
    {
        $user = $request->user();
        abort_unless($performanceTracker->tenant_id === $user->tenant_id, 403);

        $canView = $this->hasHrAdmin($request)
            || $performanceTracker->employee_id === $user->id
            || $performanceTracker->supervisor_id === $user->id;
        abort_unless($canView, 403);

        $performanceTracker->load(['employee:id,name,email', 'supervisor:id,name,email']);
        return response()->json($performanceTracker);
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless(
            $this->hasHrAdmin($request) || $this->hasHrSupervisor($request),
            403
        );
        $user = $request->user();

        $validated = $request->validate([
            'employee_id' => ['required', 'integer', 'exists:users,id'],
            'cycle_start' => ['required', 'date'],
            'cycle_end' => ['required', 'date', 'after:cycle_start'],
            'status' => ['nullable', 'string', 'in:excellent,strong,satisfactory,watchlist,at_risk,critical_review_required'],
            'trend' => ['nullable', 'string', 'in:improving,stable,declining,inconsistent,insufficient_data'],
            'output_score' => ['nullable', 'integer', 'min:1', 'max:10'],
            'timeliness_score' => ['nullable', 'integer', 'min:1', 'max:10'],
            'quality_score' => ['nullable', 'integer', 'min:1', 'max:10'],
            'workload_score' => ['nullable', 'integer', 'min:1', 'max:10'],
            'update_compliance_score' => ['nullable', 'integer', 'min:1', 'max:10'],
            'development_progress_score' => ['nullable', 'integer', 'min:1', 'max:10'],
            'recognition_indicator' => ['nullable', 'boolean'],
            'conduct_risk_indicator' => ['nullable', 'boolean'],
            'overdue_task_count' => ['nullable', 'integer', 'min:0'],
            'blocked_task_count' => ['nullable', 'integer', 'min:0'],
            'completed_task_count' => ['nullable', 'integer', 'min:0'],
            'assignment_completion_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'average_closure_delay_days' => ['nullable', 'numeric', 'min:0'],
            'timesheet_hours_logged' => ['nullable', 'numeric', 'min:0'],
            'commendation_count' => ['nullable', 'integer', 'min:0'],
            'disciplinary_case_count' => ['nullable', 'integer', 'min:0'],
            'active_warning_flag' => ['nullable', 'boolean'],
            'active_development_action_count' => ['nullable', 'integer', 'min:0'],
            'probation_flag' => ['nullable', 'boolean'],
            'hr_attention_required' => ['nullable', 'boolean'],
            'management_attention_required' => ['nullable', 'boolean'],
            'supervisor_summary' => ['nullable', 'string', 'max:5000'],
            'hr_summary' => ['nullable', 'string', 'max:5000'],
        ]);

        $supervisorId = $this->hasHrSupervisor($request) && ! $this->hasHrAdmin($request)
            ? $user->id
            : ($validated['supervisor_id'] ?? null);

        $tracker = PerformanceTracker::create(array_merge($validated, [
            'tenant_id' => $user->tenant_id,
            'supervisor_id' => $supervisorId,
            'last_recalculated_at' => now(),
        ]));

        $tracker->load(['employee:id,name,email', 'supervisor:id,name,email']);
        return response()->json($tracker, 201);
    }

    public function update(Request $request, PerformanceTracker $performanceTracker): JsonResponse
    {
        $user = $request->user();
        abort_unless($performanceTracker->tenant_id === $user->tenant_id, 403);

        $canEdit = $this->hasHrAdmin($request)
            || $performanceTracker->supervisor_id === $user->id;
        abort_unless($canEdit, 403);

        $validated = $request->validate([
            'status' => ['nullable', 'string', 'in:excellent,strong,satisfactory,watchlist,at_risk,critical_review_required'],
            'trend' => ['nullable', 'string', 'in:improving,stable,declining,inconsistent,insufficient_data'],
            'output_score' => ['nullable', 'integer', 'min:1', 'max:10'],
            'timeliness_score' => ['nullable', 'integer', 'min:1', 'max:10'],
            'quality_score' => ['nullable', 'integer', 'min:1', 'max:10'],
            'workload_score' => ['nullable', 'integer', 'min:1', 'max:10'],
            'update_compliance_score' => ['nullable', 'integer', 'min:1', 'max:10'],
            'development_progress_score' => ['nullable', 'integer', 'min:1', 'max:10'],
            'recognition_indicator' => ['nullable', 'boolean'],
            'conduct_risk_indicator' => ['nullable', 'boolean'],
            'overdue_task_count' => ['nullable', 'integer', 'min:0'],
            'blocked_task_count' => ['nullable', 'integer', 'min:0'],
            'completed_task_count' => ['nullable', 'integer', 'min:0'],
            'assignment_completion_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'average_closure_delay_days' => ['nullable', 'numeric', 'min:0'],
            'timesheet_hours_logged' => ['nullable', 'numeric', 'min:0'],
            'commendation_count' => ['nullable', 'integer', 'min:0'],
            'disciplinary_case_count' => ['nullable', 'integer', 'min:0'],
            'active_warning_flag' => ['nullable', 'boolean'],
            'active_development_action_count' => ['nullable', 'integer', 'min:0'],
            'probation_flag' => ['nullable', 'boolean'],
            'hr_attention_required' => ['nullable', 'boolean'],
            'management_attention_required' => ['nullable', 'boolean'],
            'supervisor_summary' => ['nullable', 'string', 'max:5000'],
            'hr_summary' => ['nullable', 'string', 'max:5000'],
        ]);

        $performanceTracker->update(array_merge($validated, ['last_recalculated_at' => now()]));
        $performanceTracker->load(['employee:id,name,email', 'supervisor:id,name,email']);
        return response()->json($performanceTracker);
    }

    public function destroy(Request $request, PerformanceTracker $performanceTracker): JsonResponse
    {
        $user = $request->user();
        abort_unless($performanceTracker->tenant_id === $user->tenant_id, 403);
        abort_unless($this->hasHrAdmin($request), 403);

        $performanceTracker->delete();
        return response()->json(['message' => 'Performance tracker deleted.']);
    }

    public function team(Request $request): JsonResponse
    {
        $user = $request->user();
        try {
            $trackers = PerformanceTracker::where('tenant_id', $user->tenant_id ?? 0)
                ->where('supervisor_id', $user->id)
                ->with(['employee:id,name,email'])
                ->orderByDesc('cycle_start')
                ->get();
            return response()->json(['data' => $trackers]);
        } catch (QueryException $e) {
            return response()->json(['data' => []]);
        }
    }

    public function overview(Request $request): JsonResponse
    {
        abort_unless($this->hasHrAdmin($request), 403);

        $user = $request->user();
        $tenantId = $user->tenant_id ?? 0;

        try {
            $base = PerformanceTracker::where('tenant_id', $tenantId);

            $statusCounts = (clone $base)->selectRaw('status, count(*) as count')
                ->groupBy('status')
                ->pluck('count', 'status');

            $watchlist = (clone $base)->whereIn('status', ['watchlist', 'at_risk', 'critical_review_required'])
                ->with(['employee:id,name,email'])
                ->orderByDesc('cycle_start')
                ->limit(20)
                ->get();

            $attentionRequired = (clone $base)->where('hr_attention_required', true)
                ->with(['employee:id,name,email'])
                ->orderByDesc('cycle_start')
                ->limit(20)
                ->get();

            return response()->json([
                'status_counts' => $statusCounts ?: (object) [],
                'watchlist' => $watchlist,
                'attention_required' => $attentionRequired,
            ]);
        } catch (QueryException $e) {
            return response()->json([
                'status_counts' => (object) [],
                'watchlist' => [],
                'attention_required' => [],
            ]);
        }
    }
}
