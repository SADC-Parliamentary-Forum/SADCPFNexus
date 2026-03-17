<?php

namespace App\Http\Controllers\Api\V1\Hr;

use App\Http\Controllers\Controller;
use App\Models\ConductRecord;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;

class ConductRecordController extends Controller
{
    private function canViewAll($user): bool
    {
        try {
            return $user->isSystemAdmin() || $user->hasPermissionTo('hr.admin') || $user->hasPermissionTo('hr.supervisor');
        } catch (\Throwable $e) {
            return false;
        }
    }

    /**
     * List conduct records. HR/admin/supervisor see all; others see own.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $tenantId = $user->tenant_id ?? 0;

        try {
            $query = ConductRecord::where('tenant_id', $tenantId)
                ->with([
                    'employee:id,name,email',
                    'recordedBy:id,name,email',
                ])
                ->orderByDesc('issue_date');

            if (! $this->canViewAll($user)) {
                $query->where('employee_id', $user->id);
            }

            if ($request->filled('employee_id')) {
                $query->where('employee_id', (int) $request->input('employee_id'));
            }
            if ($request->filled('record_type')) {
                $query->where('record_type', $request->input('record_type'));
            }
            if ($request->filled('status')) {
                $query->where('status', $request->input('status'));
            }

            $perPage = min((int) $request->input('per_page', 20), 100);
            return response()->json($query->paginate($perPage));
        } catch (\Throwable $e) {
            $paginator = new LengthAwarePaginator([], 0, 20, 1);
            return response()->json($paginator);
        }
    }

    /**
     * Show a single conduct record.
     */
    public function show(Request $request, ConductRecord $conductRecord): JsonResponse
    {
        $user = $request->user();

        if ($conductRecord->tenant_id !== $user->tenant_id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        if (! $this->canViewAll($user) && $conductRecord->employee_id !== $user->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $conductRecord->load([
            'employee:id,name,email',
            'recordedBy:id,name,email',
            'reviewedBy:id,name,email',
        ]);

        return response()->json($conductRecord);
    }

    /**
     * Create a conduct record. HR/admin/supervisor only.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $this->canViewAll($user)) {
            return response()->json(['message' => 'Forbidden. Requires HR or supervisor role.'], 403);
        }

        $validated = $request->validate([
            'employee_id'      => 'required|integer|exists:users,id',
            'record_type'      => 'required|string|in:commendation,verbal_counseling,written_warning,final_warning,suspension,dismissal,performance_improvement',
            'status'           => 'nullable|string|in:open,acknowledged,under_appeal,resolved,closed',
            'title'            => 'required|string|max:255',
            'description'      => 'required|string',
            'incident_date'    => 'nullable|date',
            'issue_date'       => 'required|date',
            'outcome'          => 'nullable|string',
            'appeal_notes'     => 'nullable|string',
            'resolution_date'  => 'nullable|date',
            'is_confidential'  => 'nullable|boolean',
            'hr_file_id'       => 'nullable|integer|exists:hr_personal_files,id',
        ]);

        $record = ConductRecord::create([
            'tenant_id'     => $user->tenant_id,
            'recorded_by'   => $user->id,
            ...$validated,
            'status' => $validated['status'] ?? 'open',
        ]);

        $record->load(['employee:id,name,email', 'recordedBy:id,name,email']);

        return response()->json($record, 201);
    }
}
