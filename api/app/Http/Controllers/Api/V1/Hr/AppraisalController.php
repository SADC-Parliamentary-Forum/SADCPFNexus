<?php
namespace App\Http\Controllers\Api\V1\Hr;

use App\Http\Controllers\Controller;
use App\Models\Appraisal;
use App\Models\AppraisalCycle;
use App\Models\AppraisalKra;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AppraisalController extends Controller
{
    // ─── Helpers ────────────────────────────────────────────────────────────────

    private function isHrAdmin($user): bool
    {
        return $user->isSystemAdmin() || $user->hasPermissionTo('hr.admin');
    }

    private function isSupervisor($user): bool
    {
        return $user->hasPermissionTo('hr.supervisor');
    }

    private function canViewAppraisal($user, Appraisal $appraisal): bool
    {
        return $this->isHrAdmin($user)
            || $appraisal->employee_id === $user->id
            || $appraisal->supervisor_id === $user->id
            || $appraisal->hod_id === $user->id;
    }

    // ─── Cycles ─────────────────────────────────────────────────────────────────

    /**
     * List appraisal cycles.
     * HR sees all; others see active/closed only.
     */
    public function cycles(Request $request): JsonResponse
    {
        $user = $request->user();
        $tenantId = $user->tenant_id;

        $query = AppraisalCycle::where('tenant_id', $tenantId)
            ->with('createdBy:id,name,email')
            ->orderByDesc('period_start');

        if (! $this->isHrAdmin($user)) {
            $query->whereIn('status', ['active', 'closed']);
        }

        return response()->json($query->get());
    }

    /**
     * Create a new appraisal cycle. HR/admin only.
     */
    public function storeCycle(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $this->isHrAdmin($user)) {
            return response()->json(['message' => 'Forbidden. Requires hr.admin permission.'], 403);
        }

        $validated = $request->validate([
            'title'               => 'required|string|max:255',
            'description'         => 'nullable|string',
            'period_start'        => 'required|date',
            'period_end'          => 'required|date|after:period_start',
            'submission_deadline' => 'nullable|date',
            'status'              => 'nullable|in:draft,active,closed',
        ]);

        $cycle = AppraisalCycle::create([
            'tenant_id'  => $user->tenant_id,
            'created_by' => $user->id,
            ...$validated,
            'status' => $validated['status'] ?? 'draft',
        ]);

        $cycle->load('createdBy:id,name,email');

        return response()->json($cycle, 201);
    }

    /**
     * Update an appraisal cycle. HR only.
     */
    public function updateCycle(Request $request, AppraisalCycle $appraisalCycle): JsonResponse
    {
        $user = $request->user();

        if ($appraisalCycle->tenant_id !== $user->tenant_id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        if (! $this->isHrAdmin($user)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $validated = $request->validate([
            'title'               => 'sometimes|string|max:255',
            'description'         => 'nullable|string',
            'period_start'        => 'sometimes|date',
            'period_end'          => 'sometimes|date',
            'submission_deadline' => 'nullable|date',
            'status'              => 'nullable|in:draft,active,closed',
        ]);

        $appraisalCycle->update($validated);
        $appraisalCycle->load('createdBy:id,name,email');

        return response()->json($appraisalCycle);
    }

    // ─── Appraisals ─────────────────────────────────────────────────────────────

    /**
     * List appraisals with role-based visibility.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $tenantId = $user->tenant_id;

        $query = Appraisal::where('tenant_id', $tenantId)
            ->with([
                'cycle:id,title,period_start,period_end,status',
                'employee:id,name,email',
                'supervisor:id,name,email',
            ])
            ->orderByDesc('created_at');

        if (! $this->isHrAdmin($user)) {
            $query->where(function ($q) use ($user) {
                $q->where('employee_id', $user->id)
                  ->orWhere('supervisor_id', $user->id)
                  ->orWhere('hod_id', $user->id);
            });
        }

        // Filters
        if ($request->filled('cycle_id')) {
            $query->where('cycle_id', $request->input('cycle_id'));
        }
        if ($request->filled('employee_id')) {
            $query->where('employee_id', $request->input('employee_id'));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        $perPage = (int) $request->input('per_page', 20);
        return response()->json($query->paginate($perPage));
    }

    /**
     * Show a single appraisal with KRAs.
     */
    public function show(Request $request, Appraisal $appraisal): JsonResponse
    {
        $user = $request->user();

        if ($appraisal->tenant_id !== $user->tenant_id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        if (! $this->canViewAppraisal($user, $appraisal)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $appraisal->load([
            'cycle:id,title,period_start,period_end,submission_deadline,status',
            'employee:id,name,email',
            'supervisor:id,name,email',
            'hod:id,name,email',
            'kras' => fn ($q) => $q->orderBy('sort_order'),
            'attachments:id,attachable_type,attachable_id,original_filename,mime_type,size_bytes,created_at,uploaded_by',
        ]);

        return response()->json($appraisal);
    }

    /**
     * Create an appraisal record. HR/admin only.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $this->isHrAdmin($user)) {
            return response()->json(['message' => 'Forbidden. Requires hr.admin permission.'], 403);
        }

        $validated = $request->validate([
            'cycle_id'       => 'required|integer|exists:appraisal_cycles,id',
            'employee_id'    => 'required|integer|exists:users,id',
            'supervisor_id'  => 'nullable|integer|exists:users,id',
            'hod_id'         => 'nullable|integer|exists:users,id',
            'status'         => 'nullable|in:draft,employee_submitted,supervisor_reviewed,hod_reviewed,hr_reviewed,finalized',
            'evidence_links' => 'nullable|array',
            'evidence_links.*.url'   => 'required_with:evidence_links|string|url|max:2000',
            'evidence_links.*.title' => 'nullable|string|max:255',
            'kras'           => 'nullable|array',
            'kras.*.title'       => 'required_with:kras|string|max:255',
            'kras.*.description' => 'nullable|string',
            'kras.*.weight'      => 'nullable|numeric|min:0|max:100',
            'kras.*.sort_order'  => 'nullable|integer',
        ]);

        $appraisal = DB::transaction(function () use ($validated, $user) {
            $krasData = $validated['kras'] ?? null;
            $evidenceLinks = $validated['evidence_links'] ?? null;
            unset($validated['kras'], $validated['evidence_links']);

            $appraisal = Appraisal::create([
                'tenant_id'       => $user->tenant_id,
                'cycle_id'        => $validated['cycle_id'],
                'employee_id'     => $validated['employee_id'],
                'supervisor_id'   => $validated['supervisor_id'] ?? null,
                'hod_id'          => $validated['hod_id'] ?? null,
                'status'          => $validated['status'] ?? 'draft',
                'evidence_links'  => $evidenceLinks,
            ]);

            if ($krasData) {
                foreach ($krasData as $i => $kra) {
                    AppraisalKra::create([
                        'appraisal_id' => $appraisal->id,
                        'title'        => $kra['title'],
                        'description'  => $kra['description'] ?? null,
                        'weight'       => $kra['weight'] ?? 0,
                        'sort_order'   => $kra['sort_order'] ?? $i,
                    ]);
                }
            }

            return $appraisal;
        });

        $appraisal->load([
            'cycle:id,title',
            'employee:id,name,email',
            'supervisor:id,name,email',
            'kras' => fn ($q) => $q->orderBy('sort_order'),
        ]);

        return response()->json($appraisal, 201);
    }

    /**
     * General update of an appraisal. HR/admin. Can update KRAs via nested array.
     */
    public function update(Request $request, Appraisal $appraisal): JsonResponse
    {
        $user = $request->user();

        if ($appraisal->tenant_id !== $user->tenant_id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        if (! $this->isHrAdmin($user)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $validated = $request->validate([
            'supervisor_id'        => 'nullable|integer|exists:users,id',
            'hod_id'               => 'nullable|integer|exists:users,id',
            'status'               => 'nullable|in:draft,employee_submitted,supervisor_reviewed,hod_reviewed,hr_reviewed,finalized',
            'hr_comments'          => 'nullable|string',
            'overall_rating'       => 'nullable|integer|min:1|max:5',
            'overall_rating_label' => 'nullable|string|max:64',
            'development_plan'     => 'nullable|string',
            'sg_decision'          => 'nullable|string',
            'probation_outcome'    => 'nullable|string|max:32',
            'promotion_recommendation' => 'nullable|boolean',
            'evidence_links'       => 'nullable|array',
            'evidence_links.*.url'   => 'required_with:evidence_links|string|url|max:2000',
            'evidence_links.*.title' => 'nullable|string|max:255',
            'kras'                 => 'nullable|array',
            'kras.*.id'            => 'nullable|integer|exists:appraisal_kras,id',
            'kras.*.title'         => 'required_with:kras|string|max:255',
            'kras.*.description'   => 'nullable|string',
            'kras.*.weight'        => 'nullable|numeric|min:0|max:100',
            'kras.*.sort_order'    => 'nullable|integer',
        ]);

        DB::transaction(function () use ($appraisal, $validated) {
            $krasData = $validated['kras'] ?? null;
            unset($validated['kras']);

            $appraisal->update($validated);

            if ($krasData !== null) {
                foreach ($krasData as $i => $kraData) {
                    if (! empty($kraData['id'])) {
                        AppraisalKra::where('id', $kraData['id'])
                            ->where('appraisal_id', $appraisal->id)
                            ->update([
                                'title'       => $kraData['title'],
                                'description' => $kraData['description'] ?? null,
                                'weight'      => $kraData['weight'] ?? 0,
                                'sort_order'  => $kraData['sort_order'] ?? $i,
                            ]);
                    } else {
                        AppraisalKra::create([
                            'appraisal_id' => $appraisal->id,
                            'title'        => $kraData['title'],
                            'description'  => $kraData['description'] ?? null,
                            'weight'       => $kraData['weight'] ?? 0,
                            'sort_order'   => $kraData['sort_order'] ?? $i,
                        ]);
                    }
                }
            }
        });

        $appraisal->refresh()->load([
            'cycle:id,title',
            'employee:id,name,email',
            'supervisor:id,name,email',
            'hod:id,name,email',
            'kras' => fn ($q) => $q->orderBy('sort_order'),
        ]);

        return response()->json($appraisal);
    }

    /**
     * Employee submits their self-assessment.
     */
    public function submitSelfAssessment(Request $request, Appraisal $appraisal): JsonResponse
    {
        $user = $request->user();

        if ($appraisal->tenant_id !== $user->tenant_id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        if ($appraisal->employee_id !== $user->id) {
            return response()->json(['message' => 'Forbidden. Only the employee can submit their self-assessment.'], 403);
        }

        if ($appraisal->status !== 'draft') {
            return response()->json(['message' => 'Self-assessment can only be submitted when the appraisal is in draft status.'], 422);
        }

        $validated = $request->validate([
            'self_assessment'     => 'required|string',
            'self_overall_rating' => 'required|integer|min:1|max:5',
            'evidence_links'      => 'nullable|array',
            'evidence_links.*.url'   => 'required_with:evidence_links|string|url|max:2000',
            'evidence_links.*.title' => 'nullable|string|max:255',
            'kras'                => 'nullable|array',
            'kras.*.id'           => 'required_with:kras|integer|exists:appraisal_kras,id',
            'kras.*.self_rating'  => 'nullable|integer|min:1|max:5',
            'kras.*.self_comments'=> 'nullable|string',
        ]);

        DB::transaction(function () use ($appraisal, $validated) {
            $update = [
                'self_assessment'     => $validated['self_assessment'],
                'self_overall_rating' => $validated['self_overall_rating'],
                'status'              => 'employee_submitted',
                'submitted_at'        => now(),
            ];
            if (array_key_exists('evidence_links', $validated)) {
                $update['evidence_links'] = $validated['evidence_links'];
            }
            $appraisal->update($update);

            if (! empty($validated['kras'])) {
                foreach ($validated['kras'] as $kraData) {
                    AppraisalKra::where('id', $kraData['id'])
                        ->where('appraisal_id', $appraisal->id)
                        ->update([
                            'self_rating'   => $kraData['self_rating'] ?? null,
                            'self_comments' => $kraData['self_comments'] ?? null,
                        ]);
                }
            }
        });

        $appraisal->refresh()->load([
            'cycle:id,title',
            'employee:id,name,email',
            'kras' => fn ($q) => $q->orderBy('sort_order'),
        ]);

        return response()->json($appraisal);
    }

    /**
     * Supervisor reviews the appraisal.
     */
    public function supervisorReview(Request $request, Appraisal $appraisal): JsonResponse
    {
        $user = $request->user();

        if ($appraisal->tenant_id !== $user->tenant_id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $isHrAdmin = $this->isHrAdmin($user);

        if (! $isHrAdmin && $appraisal->supervisor_id !== $user->id) {
            return response()->json(['message' => 'Forbidden. Only the assigned supervisor can review.'], 403);
        }

        if ($appraisal->status !== 'employee_submitted') {
            return response()->json(['message' => 'Appraisal must be in employee_submitted status for supervisor review.'], 422);
        }

        $validated = $request->validate([
            'supervisor_comments' => 'required|string',
            'supervisor_rating'   => 'required|integer|min:1|max:5',
            'kras'                => 'nullable|array',
            'kras.*.id'               => 'required_with:kras|integer|exists:appraisal_kras,id',
            'kras.*.supervisor_rating'   => 'nullable|integer|min:1|max:5',
            'kras.*.supervisor_comments' => 'nullable|string',
        ]);

        DB::transaction(function () use ($appraisal, $validated) {
            $appraisal->update([
                'supervisor_comments'    => $validated['supervisor_comments'],
                'supervisor_rating'      => $validated['supervisor_rating'],
                'status'                 => 'supervisor_reviewed',
                'supervisor_reviewed_at' => now(),
            ]);

            if (! empty($validated['kras'])) {
                foreach ($validated['kras'] as $kraData) {
                    AppraisalKra::where('id', $kraData['id'])
                        ->where('appraisal_id', $appraisal->id)
                        ->update([
                            'supervisor_rating'   => $kraData['supervisor_rating'] ?? null,
                            'supervisor_comments' => $kraData['supervisor_comments'] ?? null,
                        ]);
                }
            }
        });

        $appraisal->refresh()->load([
            'cycle:id,title',
            'employee:id,name,email',
            'supervisor:id,name,email',
            'kras' => fn ($q) => $q->orderBy('sort_order'),
        ]);

        return response()->json($appraisal);
    }

    /**
     * HOD reviews the appraisal.
     */
    public function hodReview(Request $request, Appraisal $appraisal): JsonResponse
    {
        $user = $request->user();

        if ($appraisal->tenant_id !== $user->tenant_id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $isHrAdmin = $this->isHrAdmin($user);

        if (! $isHrAdmin && $appraisal->hod_id !== $user->id) {
            return response()->json(['message' => 'Forbidden. Only the assigned HOD can review.'], 403);
        }

        if ($appraisal->status !== 'supervisor_reviewed') {
            return response()->json(['message' => 'Appraisal must be in supervisor_reviewed status for HOD review.'], 422);
        }

        $validated = $request->validate([
            'hod_comments' => 'required|string',
            'hod_rating'   => 'required|integer|min:1|max:5',
        ]);

        $appraisal->update([
            'hod_comments'     => $validated['hod_comments'],
            'hod_rating'       => $validated['hod_rating'],
            'status'           => 'hod_reviewed',
            'hod_reviewed_at'  => now(),
        ]);

        $appraisal->load([
            'cycle:id,title',
            'employee:id,name,email',
            'supervisor:id,name,email',
            'hod:id,name,email',
            'kras' => fn ($q) => $q->orderBy('sort_order'),
        ]);

        return response()->json($appraisal);
    }

    /**
     * HR finalizes the appraisal.
     */
    public function finalize(Request $request, Appraisal $appraisal): JsonResponse
    {
        $user = $request->user();

        if ($appraisal->tenant_id !== $user->tenant_id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        if (! $this->isHrAdmin($user)) {
            return response()->json(['message' => 'Forbidden. Requires hr.admin permission.'], 403);
        }

        $validated = $request->validate([
            'overall_rating'           => 'required|integer|min:1|max:5',
            'overall_rating_label'     => 'required|string|max:64',
            'hr_comments'              => 'nullable|string',
            'development_plan'         => 'nullable|string',
            'probation_outcome'        => 'nullable|string|max:32',
            'promotion_recommendation' => 'nullable|boolean',
            'sg_decision'              => 'nullable|string',
        ]);

        $appraisal->update([
            ...$validated,
            'status'       => 'finalized',
            'finalized_at' => now(),
        ]);

        $appraisal->load([
            'cycle:id,title',
            'employee:id,name,email',
            'supervisor:id,name,email',
            'hod:id,name,email',
            'kras' => fn ($q) => $q->orderBy('sort_order'),
        ]);

        return response()->json($appraisal);
    }

    /**
     * Employee acknowledges receipt of their finalized appraisal.
     */
    public function acknowledge(Request $request, Appraisal $appraisal): JsonResponse
    {
        $user = $request->user();

        if ($appraisal->tenant_id !== $user->tenant_id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        if ($appraisal->employee_id !== $user->id) {
            return response()->json(['message' => 'Forbidden. Only the employee can acknowledge their appraisal.'], 403);
        }

        if ($appraisal->status !== 'finalized') {
            return response()->json(['message' => 'Appraisal must be finalized before it can be acknowledged.'], 422);
        }

        if ($appraisal->employee_acknowledged) {
            return response()->json(['message' => 'Appraisal has already been acknowledged.'], 422);
        }

        $appraisal->update([
            'employee_acknowledged'    => true,
            'employee_acknowledged_at' => now(),
        ]);

        return response()->json($appraisal->fresh([
            'cycle:id,title',
            'employee:id,name,email',
        ]));
    }

    /**
     * Delete a draft appraisal. HR/admin only. Cannot delete submitted/finalized appraisals.
     */
    public function destroy(Request $request, Appraisal $appraisal): JsonResponse
    {
        $user = $request->user();

        if ($appraisal->tenant_id !== $user->tenant_id) {
            return response()->json(['message' => 'Not found.'], 404);
        }
        if (! $this->isHrAdmin($user)) {
            return response()->json(['message' => 'Forbidden. Requires hr.admin permission.'], 403);
        }
        if ($appraisal->status !== 'draft') {
            return response()->json(['message' => 'Only draft appraisals can be deleted.'], 422);
        }

        $appraisal->kras()->delete();
        $appraisal->delete();

        return response()->json(['message' => 'Appraisal deleted.']);
    }
}
