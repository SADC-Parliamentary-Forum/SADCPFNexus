<?php

namespace App\Http\Controllers\Api\V1\MAndE;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\MeActivityReport;
use App\Models\MeEvidence;
use App\Modules\MAndE\Services\MeEvidenceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MeEvidenceController extends Controller
{
    private const REVIEWER_ROLES = [
        'Governance Officer', 'Internal Auditor', 'Director',
        'Secretary General', 'System Admin', 'super-admin',
    ];

    public function __construct(private readonly MeEvidenceService $service) {}

    public function index(Request $request, MeActivityReport $activityReport): JsonResponse
    {
        $this->ensureReportTenant($request, $activityReport);
        $evidence = $activityReport->evidence()
            ->with(['attachments', 'uploader:id,name', 'indicator:id,name,code'])
            ->orderByDesc('created_at')
            ->get();
        return response()->json(['data' => $evidence]);
    }

    public function store(Request $request, MeActivityReport $activityReport): JsonResponse
    {
        $this->ensureReportTenant($request, $activityReport);
        $request->validate([
            'file'          => ['required', 'file', 'max:25600'], // 25 MB
            'evidence_type' => ['nullable', 'string', 'in:' . implode(',', MeEvidence::TYPES)],
            'indicator_id'  => ['nullable', 'integer', 'exists:indicators,id'],
            'title'         => ['nullable', 'string', 'max:300'],
        ]);

        $evidence = $this->service->upload(
            $activityReport,
            $request->file('file'),
            $request->only(['evidence_type', 'indicator_id', 'title']),
            $request->user()
        );

        return response()->json(['message' => 'Evidence uploaded.', 'data' => $evidence], 201);
    }

    public function review(Request $request, MeActivityReport $activityReport, MeEvidence $evidence): JsonResponse
    {
        $this->ensureEvidence($request, $activityReport, $evidence);
        if (!$request->user()->hasAnyRole(self::REVIEWER_ROLES)) {
            abort(403, 'You are not allowed to validate evidence.');
        }
        $data = $request->validate([
            'review_status' => ['required', 'string', 'in:validated,rejected'],
            'review_notes'  => ['nullable', 'string', 'max:2000'],
        ]);
        $updated = $this->service->validateEvidence($evidence, $data['review_status'], $data['review_notes'] ?? null, $request->user());
        return response()->json(['message' => 'Evidence reviewed.', 'data' => $updated]);
    }

    public function destroy(Request $request, MeActivityReport $activityReport, MeEvidence $evidence): JsonResponse
    {
        $this->ensureEvidence($request, $activityReport, $evidence);
        $this->service->delete($evidence, $request->user());
        return response()->json(['message' => 'Evidence deleted.']);
    }

    public function download(Request $request, MeActivityReport $activityReport, MeEvidence $evidence, Attachment $attachment): StreamedResponse|JsonResponse
    {
        $this->ensureEvidence($request, $activityReport, $evidence);
        if ($attachment->attachable_type !== MeEvidence::class || (int) $attachment->attachable_id !== (int) $evidence->id) {
            abort(404);
        }
        if (!$attachment->storage_path || !Storage::disk('local')->exists($attachment->storage_path)) {
            return response()->json(['message' => 'File not found.'], 404);
        }
        return response()->streamDownload(function () use ($attachment) {
            $stream = Storage::disk('local')->readStream($attachment->storage_path);
            if (is_resource($stream)) {
                fpassthru($stream);
                fclose($stream);
            }
        }, $attachment->original_filename, ['Content-Type' => $attachment->mime_type ?: 'application/octet-stream']);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private function ensureReportTenant(Request $request, MeActivityReport $report): void
    {
        if ((int) $report->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
    }

    private function ensureEvidence(Request $request, MeActivityReport $report, MeEvidence $evidence): void
    {
        $this->ensureReportTenant($request, $report);
        if ((int) $evidence->me_activity_report_id !== (int) $report->id
            || (int) $evidence->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
    }
}
