<?php

namespace App\Http\Controllers\Api\V1\MAndE;

use App\Http\Controllers\Controller;
use App\Models\MeActivityReport;
use App\Modules\MAndE\Services\MeReviewService;
use App\Services\WorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeReviewController extends Controller
{
    /** Roles permitted to perform M&E reviewer actions. */
    private const REVIEWER_ROLES = [
        'Governance Officer', 'Internal Auditor', 'Director',
        'Secretary General', 'System Admin', 'super-admin',
    ];

    public function __construct(
        private readonly MeReviewService $service,
        private readonly WorkflowService $workflowService,
    ) {}

    public function submit(Request $request, MeActivityReport $activityReport): JsonResponse
    {
        $this->ensureTenant($request, $activityReport);

        $user = $request->user();
        $canSubmit = (int) $activityReport->created_by === (int) $user->id
            || (int) $activityReport->responsible_officer_id === (int) $user->id
            || $user->hasAnyRole(['System Admin', 'super-admin']);

        if (! $canSubmit) {
            abort(403, 'You are not allowed to submit this report.');
        }

        $report = $this->service->submit($activityReport, $user);

        return response()->json(['message' => 'Report submitted for M&E review.', 'data' => $report]);
    }

    public function review(Request $request, MeActivityReport $activityReport): JsonResponse
    {
        $this->ensureTenant($request, $activityReport);
        $data = $request->validate(['review_notes' => ['nullable', 'string', 'max:5000']]);

        $approvalRequest = $activityReport->approvalRequest;
        if ($approvalRequest) {
            $this->workflowService->approve($approvalRequest, $request->user(), $data['review_notes'] ?? null);
            $activityReport->refresh();
            if ($activityReport->review_status === MeActivityReport::STATUS_SUBMITTED) {
                // Not yet the final step — perform the actual reviewed-status
                // transition now that the engine has authorised this actor.
                $report = $this->service->review($activityReport, $data, $request->user());

                return response()->json(['message' => 'Report marked as reviewed.', 'data' => $report]);
            }

            return response()->json(['message' => 'Report marked as reviewed.', 'data' => $activityReport->fresh()]);
        }

        $this->ensureReviewer($request, $activityReport);
        $report = $this->service->review($activityReport, $data, $request->user());

        return response()->json(['message' => 'Report marked as reviewed.', 'data' => $report]);
    }

    public function requestCorrection(Request $request, MeActivityReport $activityReport): JsonResponse
    {
        $this->ensureTenant($request, $activityReport);
        $data = $request->validate([
            'review_notes' => ['required', 'string', 'max:5000'],
            'section' => ['nullable', 'string', 'max:100'],
            'return_section' => ['nullable', 'string', 'max:100'],
            'required_action' => ['nullable', 'string', 'max:2000'],
            'return_required_action' => ['nullable', 'string', 'max:2000'],
            'correction_due_at' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date'],
        ]);

        $approvalRequest = $activityReport->approvalRequest;
        if ($approvalRequest) {
            $this->workflowService->returnForCorrection($approvalRequest, $request->user(), $data['review_notes']);

            return response()->json(['message' => 'Report returned for correction.', 'data' => $activityReport->fresh()]);
        }

        $this->ensureReviewer($request, $activityReport);
        $report = $this->service->requestCorrection($activityReport, $data, $request->user());

        return response()->json(['message' => 'Report returned for correction.', 'data' => $report]);
    }

    public function accept(Request $request, MeActivityReport $activityReport): JsonResponse
    {
        $this->ensureTenant($request, $activityReport);
        $data = $request->validate(['review_notes' => ['nullable', 'string', 'max:5000']]);

        $approvalRequest = $activityReport->approvalRequest;
        if ($approvalRequest) {
            $this->workflowService->approve($approvalRequest, $request->user(), $data['review_notes'] ?? null);

            return response()->json(['message' => 'Report accepted.', 'data' => $activityReport->fresh()]);
        }

        $this->ensureReviewer($request, $activityReport);
        $report = $this->service->accept($activityReport, $data, $request->user());

        return response()->json(['message' => 'Report accepted.', 'data' => $report]);
    }

    public function close(Request $request, MeActivityReport $activityReport): JsonResponse
    {
        $this->ensureReviewer($request, $activityReport);
        $data = $request->validate(['notes' => ['nullable', 'string', 'max:5000']]);
        $report = $this->service->close($activityReport, $data, $request->user());

        return response()->json(['message' => 'Report closed.', 'data' => $report]);
    }

    public function programmeReviewQueue(Request $request): JsonResponse
    {
        $this->ensureProgrammeReviewerRole($request);
        $rows = $this->service->programmeReviewQueue($request->user());

        return response()->json(['data' => $rows]);
    }

    public function clearProgrammeReview(Request $request, MeActivityReport $activityReport): JsonResponse
    {
        $this->ensureProgrammeReviewer($request, $activityReport);
        $data = $request->validate([
            'notes' => ['nullable', 'string', 'max:5000'],
            'review_notes' => ['nullable', 'string', 'max:5000'],
        ]);
        $report = $this->service->clearProgrammeReview($activityReport, $data, $request->user());

        return response()->json(['message' => 'Programme review cleared.', 'data' => $report]);
    }

    public function returnProgrammeReview(Request $request, MeActivityReport $activityReport): JsonResponse
    {
        $this->ensureProgrammeReviewer($request, $activityReport);
        $data = $request->validate([
            'notes' => ['required_without:review_notes', 'nullable', 'string', 'max:5000'],
            'review_notes' => ['required_without:notes', 'nullable', 'string', 'max:5000'],
        ]);
        $report = $this->service->returnProgrammeReview($activityReport, $data, $request->user());

        return response()->json(['message' => 'Returned to officer by programme manager.', 'data' => $report]);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private function ensureTenant(Request $request, MeActivityReport $report): void
    {
        if ((int) $report->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
    }

    private function ensureReviewerRole(Request $request): void
    {
        if (! $request->user()->hasAnyRole(self::REVIEWER_ROLES)
            && ! $request->user()->can('mande.review')) {
            abort(403, 'You are not allowed to review M&E reports.');
        }
    }

    private function ensureProgrammeReviewerRole(Request $request): void
    {
        $user = $request->user();
        if ($user->hasAnyRole(self::REVIEWER_ROLES)
            || $user->can('mande.review')
            || $user->can('programme.manager_review.act.assigned')) {
            return;
        }

        abort(403, 'You are not allowed to perform programme manager review.');
    }

    private function ensureReviewer(Request $request, MeActivityReport $report): void
    {
        $this->ensureTenant($request, $report);
        $this->ensureReviewerRole($request);
    }

    private function ensureProgrammeReviewer(Request $request, MeActivityReport $report): void
    {
        $this->ensureTenant($request, $report);
        $this->ensureProgrammeReviewerRole($request);
    }
}
