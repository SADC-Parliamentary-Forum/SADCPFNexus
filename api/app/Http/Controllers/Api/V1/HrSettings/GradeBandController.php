<?php

namespace App\Http\Controllers\Api\V1\HrSettings;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\HrGradeBand;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GradeBandController extends Controller
{
    // ── List ──────────────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', HrGradeBand::class);

        $query = HrGradeBand::with('jobFamily')
            ->withCount('positions')
            ->where('tenant_id', $request->user()->tenant_id);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('band_group')) {
            $query->where('band_group', $request->band_group);
        }
        if ($request->filled('employment_category')) {
            $query->where('employment_category', $request->employment_category);
        }
        if ($request->filled('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('code', 'ilike', "%{$request->search}%")
                  ->orWhere('label', 'ilike', "%{$request->search}%");
            });
        }

        $results = $query->orderBy('band_group')->orderBy('code')
            ->paginate($request->integer('per_page', 25));

        return response()->json($results);
    }

    // ── Create ────────────────────────────────────────────────────────────────

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', HrGradeBand::class);

        $data = $request->validate([
            'code'                      => ['required', 'string', 'max:10'],
            'label'                     => ['required', 'string', 'max:100'],
            'band_group'                => ['required', 'in:A,B,C,D'],
            'employment_category'       => ['required', 'in:local,regional,researcher'],
            'min_notch'                 => ['nullable', 'integer', 'min:1', 'max:12'],
            'max_notch'                 => ['nullable', 'integer', 'min:1', 'max:12'],
            'probation_months'          => ['nullable', 'integer', 'min:0', 'max:24'],
            'notice_period_days'        => ['nullable', 'integer', 'min:0'],
            'leave_days_per_year'       => ['nullable', 'numeric', 'min:0'],
            'overtime_eligible'         => ['nullable', 'boolean'],
            'acting_allowance_rate'     => ['nullable', 'numeric', 'min:0', 'max:1'],
            'travel_class'              => ['nullable', 'in:economy,business,first'],
            'medical_aid_eligible'      => ['nullable', 'boolean'],
            'housing_allowance_eligible'=> ['nullable', 'boolean'],
            'job_family_id'             => ['nullable', 'exists:hr_job_families,id'],
            'effective_from'            => ['required', 'date'],
            'effective_to'              => ['nullable', 'date', 'after:effective_from'],
            'notes'                     => ['nullable', 'string'],
        ]);

        $grade = HrGradeBand::create([
            'tenant_id'  => $request->user()->tenant_id,
            'status'     => 'draft',
            'created_by' => $request->user()->id,
            ...$data,
        ]);

        AuditLog::record('hr_settings.grade_band.created', [
            'auditable_type' => HrGradeBand::class,
            'auditable_id'   => $grade->id,
            'new_values'     => $data,
            'tags'           => 'hr_settings',
        ]);

        return response()->json(['message' => 'Grade band created.', 'data' => $grade->load('jobFamily')], 201);
    }

    // ── Show ──────────────────────────────────────────────────────────────────

    public function show(Request $request, HrGradeBand $gradeBand): JsonResponse
    {
        $this->authorize('view', $gradeBand);

        $gradeBand->load(['jobFamily', 'salaryScales', 'reviewer', 'approver', 'publisher'])
            ->loadCount('positions');

        $gradeBand->setAttribute('staff_count', $gradeBand->activeStaffCount());

        return response()->json(['data' => $gradeBand]);
    }

    // ── Update ────────────────────────────────────────────────────────────────

    public function update(Request $request, HrGradeBand $gradeBand): JsonResponse
    {
        $this->authorize('update', $gradeBand);

        // Published records cannot be edited in-place — create a new version instead
        if ($gradeBand->status === 'published') {
            return response()->json([
                'message' => 'Published grades cannot be edited directly. Use "New Version" to create a draft revision.',
            ], 422);
        }

        $data = $request->validate([
            'code'                      => ['sometimes', 'string', 'max:10'],
            'label'                     => ['sometimes', 'string', 'max:100'],
            'band_group'                => ['sometimes', 'in:A,B,C,D'],
            'employment_category'       => ['sometimes', 'in:local,regional,researcher'],
            'min_notch'                 => ['nullable', 'integer', 'min:1', 'max:12'],
            'max_notch'                 => ['nullable', 'integer', 'min:1', 'max:12'],
            'probation_months'          => ['nullable', 'integer', 'min:0', 'max:24'],
            'notice_period_days'        => ['nullable', 'integer', 'min:0'],
            'leave_days_per_year'       => ['nullable', 'numeric', 'min:0'],
            'overtime_eligible'         => ['nullable', 'boolean'],
            'acting_allowance_rate'     => ['nullable', 'numeric', 'min:0', 'max:1'],
            'travel_class'              => ['nullable', 'in:economy,business,first'],
            'medical_aid_eligible'      => ['nullable', 'boolean'],
            'housing_allowance_eligible'=> ['nullable', 'boolean'],
            'job_family_id'             => ['nullable', 'exists:hr_job_families,id'],
            'effective_from'            => ['sometimes', 'date'],
            'effective_to'              => ['nullable', 'date'],
            'notes'                     => ['nullable', 'string'],
        ]);

        $old = $gradeBand->only(array_keys($data));
        $gradeBand->update($data);

        AuditLog::record('hr_settings.grade_band.updated', [
            'auditable_type' => HrGradeBand::class,
            'auditable_id'   => $gradeBand->id,
            'old_values'     => $old,
            'new_values'     => $data,
            'tags'           => 'hr_settings',
        ]);

        return response()->json(['message' => 'Grade band updated.', 'data' => $gradeBand->fresh()->load('jobFamily')]);
    }

    // ── Lifecycle transitions ─────────────────────────────────────────────────

    public function submit(Request $request, HrGradeBand $gradeBand): JsonResponse
    {
        $this->authorize('update', $gradeBand);

        if ($gradeBand->status !== 'draft') {
            return response()->json(['message' => 'Only draft grades can be submitted for review.'], 422);
        }

        $gradeBand->update(['status' => 'review']);

        AuditLog::record('hr_settings.grade_band.submitted', [
            'auditable_type' => HrGradeBand::class,
            'auditable_id'   => $gradeBand->id,
            'new_values'     => ['status' => 'review'],
            'tags'           => 'hr_settings',
        ]);

        return response()->json(['message' => 'Grade band submitted for review.', 'data' => $gradeBand->fresh()]);
    }

    public function approve(Request $request, HrGradeBand $gradeBand): JsonResponse
    {
        $this->authorize('approve', $gradeBand);

        if ($gradeBand->status !== 'review') {
            return response()->json(['message' => 'Only grades in review can be approved.'], 422);
        }

        $gradeBand->update([
            'status'      => 'approved',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
        ]);

        AuditLog::record('hr_settings.grade_band.approved', [
            'auditable_type' => HrGradeBand::class,
            'auditable_id'   => $gradeBand->id,
            'new_values'     => ['status' => 'approved', 'approved_by' => $request->user()->id],
            'tags'           => 'hr_settings',
        ]);

        return response()->json(['message' => 'Grade band approved.', 'data' => $gradeBand->fresh()]);
    }

    public function publish(Request $request, HrGradeBand $gradeBand): JsonResponse
    {
        $this->authorize('publish', $gradeBand);

        if ($gradeBand->status !== 'approved') {
            return response()->json(['message' => 'Only approved grades can be published.'], 422);
        }

        // Archive any previously published version of the same code
        HrGradeBand::where('tenant_id', $gradeBand->tenant_id)
            ->where('code', $gradeBand->code)
            ->where('status', 'published')
            ->where('id', '!=', $gradeBand->id)
            ->update(['status' => 'archived']);

        $gradeBand->update([
            'status'       => 'published',
            'published_by' => $request->user()->id,
            'published_at' => now(),
        ]);

        AuditLog::record('hr_settings.grade_band.published', [
            'auditable_type' => HrGradeBand::class,
            'auditable_id'   => $gradeBand->id,
            'new_values'     => ['status' => 'published', 'published_by' => $request->user()->id],
            'tags'           => 'hr_settings',
        ]);

        return response()->json(['message' => 'Grade band published.', 'data' => $gradeBand->fresh()]);
    }

    public function archive(Request $request, HrGradeBand $gradeBand): JsonResponse
    {
        $this->authorize('update', $gradeBand);

        $gradeBand->update(['status' => 'archived']);

        AuditLog::record('hr_settings.grade_band.archived', [
            'auditable_type' => HrGradeBand::class,
            'auditable_id'   => $gradeBand->id,
            'tags'           => 'hr_settings',
        ]);

        return response()->json(['message' => 'Grade band archived.', 'data' => $gradeBand->fresh()]);
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    public function destroy(HrGradeBand $gradeBand): JsonResponse
    {
        $this->authorize('delete', $gradeBand);

        $gradeBand->delete();

        AuditLog::record('hr_settings.grade_band.deleted', [
            'auditable_type' => HrGradeBand::class,
            'auditable_id'   => $gradeBand->id,
            'tags'           => 'hr_settings',
        ]);

        return response()->json(['message' => 'Grade band deleted.']);
    }

    // ── Impact check ──────────────────────────────────────────────────────────

    public function impactCheck(HrGradeBand $gradeBand): JsonResponse
    {
        $this->authorize('view', $gradeBand);

        $positions = $gradeBand->positions()
            ->with('department:id,name')
            ->get(['id', 'title', 'department_id']);

        return response()->json([
            'data' => [
                'positions_count'    => $gradeBand->positions()->count(),
                'active_staff_count' => $gradeBand->activeStaffCount(),
                'positions'          => $positions->map(fn ($p) => [
                    'id'         => $p->id,
                    'title'      => $p->title,
                    'department' => $p->department?->name,
                ]),
            ],
        ]);
    }

    // ── New version ───────────────────────────────────────────────────────────

    public function newVersion(Request $request, HrGradeBand $gradeBand): JsonResponse
    {
        $this->authorize('create', HrGradeBand::class);

        if ($gradeBand->status !== 'published') {
            return response()->json(['message' => 'Only published grades can be versioned.'], 422);
        }

        $nextVersion = HrGradeBand::where('tenant_id', $gradeBand->tenant_id)
            ->where('code', $gradeBand->code)
            ->max('version_number') + 1;

        $newGrade = $gradeBand->replicate();
        $newGrade->status         = 'draft';
        $newGrade->version_number = $nextVersion;
        $newGrade->created_by     = $request->user()->id;
        $newGrade->reviewed_by    = null;
        $newGrade->approved_by    = null;
        $newGrade->published_by   = null;
        $newGrade->reviewed_at    = null;
        $newGrade->approved_at    = null;
        $newGrade->published_at   = null;
        $newGrade->deleted_at     = null;
        $newGrade->save();

        AuditLog::record('hr_settings.grade_band.versioned', [
            'auditable_type' => HrGradeBand::class,
            'auditable_id'   => $newGrade->id,
            'new_values'     => ['source_id' => $gradeBand->id, 'version_number' => $nextVersion],
            'tags'           => 'hr_settings',
        ]);

        return response()->json(['message' => 'New draft version created.', 'data' => $newGrade->load('jobFamily')], 201);
    }
}
