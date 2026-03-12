<?php
namespace App\Http\Controllers\Api\V1\Hr;

use App\Http\Controllers\Controller;
use App\Models\WorkAssignment;
use App\Models\WorkAssignmentUpdate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WorkAssignmentController extends Controller
{
    /**
     * List work assignments with role-based visibility.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $tenantId = $user->tenant_id;

        $query = WorkAssignment::with([
            'assignedTo:id,name,email',
            'assignedBy:id,name,email',
            'department:id,name',
        ])->where('tenant_id', $tenantId);

        // Role-based filtering
        $isHrAdmin = $user->isSystemAdmin() || $user->hasPermissionTo('hr.admin');
        $isSupervisor = $user->hasPermissionTo('hr.supervisor');

        if (! $isHrAdmin) {
            if ($isSupervisor) {
                // Supervisor sees assignments they created AND assignments assigned to them
                $query->where(function ($q) use ($user) {
                    $q->where('assigned_by', $user->id)
                      ->orWhere('assigned_to', $user->id);
                });
            } else {
                // Regular employee sees only their own assignments
                $query->where('assigned_to', $user->id);
            }
        }

        // Filters
        if ($request->filled('assigned_to')) {
            $query->where('assigned_to', $request->input('assigned_to'));
        }
        if ($request->filled('assigned_by')) {
            $query->where('assigned_by', $request->input('assigned_by'));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }
        if ($request->filled('priority')) {
            $query->where('priority', $request->input('priority'));
        }
        if ($request->boolean('overdue')) {
            $query->where('due_date', '<', now())
                  ->whereNotIn('status', ['completed', 'cancelled']);
        }

        $query->orderByDesc('created_at');
        $perPage = (int) $request->input('per_page', 20);
        $results = $query->paginate($perPage);

        return response()->json($results);
    }

    /**
     * Show a single assignment with its update history.
     */
    public function show(Request $request, WorkAssignment $workAssignment): JsonResponse
    {
        $user = $request->user();

        if ($workAssignment->tenant_id !== $user->tenant_id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $isHrAdmin = $user->isSystemAdmin() || $user->hasPermissionTo('hr.admin');
        $isSupervisor = $user->hasPermissionTo('hr.supervisor');

        $canView = $isHrAdmin
            || $workAssignment->assigned_to === $user->id
            || ($isSupervisor && $workAssignment->assigned_by === $user->id);

        if (! $canView) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $workAssignment->load([
            'assignedTo:id,name,email',
            'assignedBy:id,name,email',
            'department:id,name',
            'updates' => fn ($q) => $q->orderBy('created_at'),
            'updates.user:id,name,email',
        ]);

        $workAssignment->append('is_overdue');

        return response()->json($workAssignment);
    }

    /**
     * Create a new work assignment. Requires hr.admin or hr.supervisor.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $isHrAdmin = $user->isSystemAdmin() || $user->hasPermissionTo('hr.admin');
        $isSupervisor = $user->hasPermissionTo('hr.supervisor');

        if (! $isHrAdmin && ! $isSupervisor) {
            return response()->json(['message' => 'Forbidden. Requires hr.admin or hr.supervisor permission.'], 403);
        }

        $validated = $request->validate([
            'title'           => 'required|string|max:255',
            'assigned_to'     => 'required|integer|exists:users,id',
            'description'     => 'nullable|string',
            'priority'        => 'nullable|in:low,medium,high,critical',
            'due_date'        => 'nullable|date',
            'estimated_hours' => 'nullable|numeric|min:0',
            'department_id'   => 'nullable|integer|exists:departments,id',
            'status'          => 'nullable|in:draft,assigned,in_progress,pending_review,completed,overdue,cancelled',
            'linked_module'   => 'nullable|string|max:64',
            'linked_id'       => 'nullable|integer',
        ]);

        $assignment = WorkAssignment::create([
            'tenant_id'   => $user->tenant_id,
            'assigned_by' => $user->id,
            ...$validated,
            'status'      => $validated['status'] ?? 'assigned',
        ]);

        $assignment->load(['assignedTo:id,name,email', 'assignedBy:id,name,email']);

        return response()->json($assignment, 201);
    }

    /**
     * Update a work assignment. Gate: HR admin OR the assigning user.
     */
    public function update(Request $request, WorkAssignment $workAssignment): JsonResponse
    {
        $user = $request->user();

        if ($workAssignment->tenant_id !== $user->tenant_id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $isHrAdmin = $user->isSystemAdmin() || $user->hasPermissionTo('hr.admin');

        if (! $isHrAdmin && $workAssignment->assigned_by !== $user->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $validated = $request->validate([
            'title'            => 'sometimes|string|max:255',
            'description'      => 'nullable|string',
            'priority'         => 'nullable|in:low,medium,high,critical',
            'status'           => 'nullable|in:draft,assigned,in_progress,pending_review,completed,overdue,cancelled',
            'due_date'         => 'nullable|date',
            'estimated_hours'  => 'nullable|numeric|min:0',
            'actual_hours'     => 'nullable|numeric|min:0',
            'department_id'    => 'nullable|integer|exists:departments,id',
            'assigned_to'      => 'sometimes|integer|exists:users,id',
            'timesheet_linked' => 'nullable|boolean',
            'linked_module'    => 'nullable|string|max:64',
            'linked_id'        => 'nullable|integer',
            'completion_notes' => 'nullable|string',
        ]);

        $workAssignment->update($validated);

        $workAssignment->load(['assignedTo:id,name,email', 'assignedBy:id,name,email']);
        $workAssignment->append('is_overdue');

        return response()->json($workAssignment);
    }

    /**
     * Post a progress update to an assignment.
     */
    public function addUpdate(Request $request, WorkAssignment $workAssignment): JsonResponse
    {
        $user = $request->user();

        if ($workAssignment->tenant_id !== $user->tenant_id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $isHrAdmin = $user->isSystemAdmin() || $user->hasPermissionTo('hr.admin');
        $isSupervisor = $user->hasPermissionTo('hr.supervisor');

        $canUpdate = $isHrAdmin
            || $workAssignment->assigned_to === $user->id
            || ($isSupervisor && $workAssignment->assigned_by === $user->id);

        if (! $canUpdate) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $validated = $request->validate([
            'update_type'  => 'required|in:progress,blocker,completion,comment,review',
            'content'      => 'required|string',
            'hours_logged' => 'nullable|numeric|min:0',
        ]);

        $newStatus = null;

        DB::transaction(function () use ($workAssignment, $validated, $user, &$newStatus) {
            if ($validated['update_type'] === 'completion') {
                $newStatus = 'pending_review';
                $workAssignment->update([
                    'status'       => 'pending_review',
                    'completed_at' => now(),
                ]);
            }

            if (! empty($validated['hours_logged'])) {
                $workAssignment->increment('actual_hours', $validated['hours_logged']);
            }
        });

        $update = WorkAssignmentUpdate::create([
            'tenant_id'    => $user->tenant_id,
            'assignment_id'=> $workAssignment->id,
            'user_id'      => $user->id,
            'update_type'  => $validated['update_type'],
            'content'      => $validated['content'],
            'hours_logged' => $validated['hours_logged'] ?? null,
            'new_status'   => $newStatus,
        ]);

        $update->load('user:id,name,email');

        return response()->json($update, 201);
    }

    /**
     * Start an assignment (set status to in_progress).
     */
    public function start(Request $request, WorkAssignment $workAssignment): JsonResponse
    {
        $user = $request->user();

        if ($workAssignment->tenant_id !== $user->tenant_id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $isHrAdmin = $user->isSystemAdmin() || $user->hasPermissionTo('hr.admin');
        $isSupervisor = $user->hasPermissionTo('hr.supervisor');

        $canAct = $isHrAdmin
            || $workAssignment->assigned_to === $user->id
            || ($isSupervisor && $workAssignment->assigned_by === $user->id);

        if (! $canAct) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if ($workAssignment->status === 'in_progress') {
            return response()->json(['message' => 'Assignment is already in progress.'], 422);
        }

        $workAssignment->update([
            'status'     => 'in_progress',
            'started_at' => $workAssignment->started_at ?? now(),
        ]);

        $workAssignment->load(['assignedTo:id,name,email', 'assignedBy:id,name,email']);
        $workAssignment->append('is_overdue');

        return response()->json($workAssignment);
    }

    /**
     * Mark an assignment as completed.
     */
    public function complete(Request $request, WorkAssignment $workAssignment): JsonResponse
    {
        $user = $request->user();

        if ($workAssignment->tenant_id !== $user->tenant_id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $isHrAdmin = $user->isSystemAdmin() || $user->hasPermissionTo('hr.admin');
        $isSupervisor = $user->hasPermissionTo('hr.supervisor');

        $canAct = $isHrAdmin
            || $workAssignment->assigned_to === $user->id
            || ($isSupervisor && $workAssignment->assigned_by === $user->id);

        if (! $canAct) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $validated = $request->validate([
            'completion_notes' => 'nullable|string',
        ]);

        $workAssignment->update([
            'status'           => 'completed',
            'completed_at'     => now(),
            'started_at'       => $workAssignment->started_at ?? now(),
            'completion_notes' => $validated['completion_notes'] ?? $workAssignment->completion_notes,
        ]);

        $workAssignment->load(['assignedTo:id,name,email', 'assignedBy:id,name,email']);
        $workAssignment->append('is_overdue');

        return response()->json($workAssignment);
    }

    /**
     * Return assignment statistics for the authenticated user's context.
     */
    public function stats(Request $request): JsonResponse
    {
        $user = $request->user();
        $tenantId = $user->tenant_id;

        $isHrAdmin = $user->isSystemAdmin() || $user->hasPermissionTo('hr.admin');
        $isSupervisor = $user->hasPermissionTo('hr.supervisor');

        // Base query scoped to tenant
        $base = WorkAssignment::where('tenant_id', $tenantId);

        $total = (clone $base)->count();

        $byStatus = (clone $base)
            ->selectRaw('status, count(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();

        $overdue = (clone $base)
            ->where('due_date', '<', now())
            ->whereNotIn('status', ['completed', 'cancelled'])
            ->count();

        $myAssignments = (clone $base)
            ->where('assigned_to', $user->id)
            ->count();

        $stats = [
            'total'         => $total,
            'by_status'     => $byStatus,
            'overdue'       => $overdue,
            'my_assignments'=> $myAssignments,
        ];

        // Supervisor / HR: also include team stats
        if ($isHrAdmin || $isSupervisor) {
            $teamBase = (clone $base)->where('assigned_by', $user->id);

            $stats['team'] = [
                'total'     => (clone $teamBase)->count(),
                'overdue'   => (clone $teamBase)
                    ->where('due_date', '<', now())
                    ->whereNotIn('status', ['completed', 'cancelled'])
                    ->count(),
                'completed' => (clone $teamBase)->where('status', 'completed')->count(),
                'in_progress'=> (clone $teamBase)->where('status', 'in_progress')->count(),
            ];
        }

        return response()->json($stats);
    }
}
