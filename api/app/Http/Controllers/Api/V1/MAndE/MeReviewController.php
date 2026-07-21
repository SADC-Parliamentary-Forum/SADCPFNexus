<?php

namespace App\Http\Controllers\Api\V1\MAndE;

use App\Http\Controllers\Controller;
use App\Models\MeActivityReport;
use App\Modules\MAndE\Services\MeReviewService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeReviewController extends Controller
{
    /** Roles permitted to perform M&E reviewer actions. */
    private const REVIEWER_ROLES = [
        'Governance Officer', 'Internal Auditor', 'Director',
        'Secretary General', 'System Admin', 'super-admin',
    ];

    public function __construct(private readonly MeReviewService $service) {}

    public function submit(Request $request, MeActivityReport $activityReport): JsonResponse
    {
        $this->ensureTenant($request, $activityReport);

        $user = $request->user();
        $canSubmit = (int) $activityReport->created_by === (int) $user->id
            || (int) $activityReport->responsible_officer_id === (int) $user->id
            || $user->hasAnyRole(['System Admin', 'super-admin']);

        if (!$canSubmit) {
            abort(403, 'You are not allowed to submit this report.');
        }

        $report = $this->service->submit($activityReport, $user);
        return response()->json(['message' => 'Report submitted for M&E review.', 'data' => $report]);
    }

    public function review(Request $request, MeActivityReport $activityReport): JsonResponse
    {
        $this->ensureReviewer($request, $activityReport);
        $data = $request->validate(['review_notes' => ['nullable', 'string', 'max:5000']]);
        $report = $this->service->review($activityReport, $data, $request->user());
        return response()->json(['message' => 'Report marked as reviewed.', 'data' => $report]);
    }

    public function requestCorrection(Request $request, MeActivityReport $activityReport): JsonResponse
    {
        $this->ensureReviewer($request, $activityReport);
        $data = $request->validate(['review_notes' => ['required', 'string', 'max:5000']]);
        $report = $this->service->requestCorrection($activityReport, $data, $request->user());
        return response()->json(['message' => 'Report returned for correction.', 'data' => $report]);
    }

    public function accept(Request $request, MeActivityReport $activityReport): JsonResponse
    {
        $this->ensureReviewer($request, $activityReport);
        $data = $request->validate(['review_notes' => ['nullable', 'string', 'max:5000']]);
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

    // ── Helpers ────────────────────────────────────────────────────────────────

    private function ensureTenant(Request $request, MeActivityReport $report): void
    {
        if ((int) $report->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
    }

    private function ensureReviewer(Request $request, MeActivityReport $report): void
    {
        $this->ensureTenant($request, $report);
        if (!$request->user()->hasAnyRole(self::REVIEWER_ROLES)) {
            abort(403, 'You are not allowed to review M&E reports.');
        }
    }
}
