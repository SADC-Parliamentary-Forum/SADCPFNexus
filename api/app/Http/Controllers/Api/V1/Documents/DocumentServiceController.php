<?php

namespace App\Http\Controllers\Api\V1\Documents;

use App\Http\Controllers\Controller;
use App\Models\Documents\DocumentAuditEvent;
use App\Models\Documents\DocumentGovernanceDecision;
use App\Models\Documents\DocumentUploadSession;
use App\Models\Documents\DocumentVersion;
use App\Models\Documents\ManagedDocument;
use App\Modules\Documents\Services\DocumentGovernanceService;
use App\Modules\Documents\Services\DocumentPhase23Service;
use App\Modules\Documents\Services\DocumentStorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DocumentServiceController extends Controller
{
    public function __construct(
        private readonly DocumentStorageService $documents,
        private readonly DocumentPhase23Service $phase23,
        private readonly DocumentGovernanceService $governance,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorizeAdminOrView($request);
        $filters = $request->validate([
            'module' => ['nullable', 'string', 'max:64'],
            'q' => ['nullable', 'string', 'max:255'],
            'legal_hold' => ['nullable'],
            'classification' => ['nullable', 'string', 'max:32'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        return response()->json($this->documents->listRegister($request->user(), $filters));
    }

    public function search(Request $request): JsonResponse
    {
        $this->authorizeAdminOrView($request);
        $data = $request->validate(['q' => ['required', 'string', 'max:255'], 'per_page' => ['nullable', 'integer']]);

        return response()->json($this->documents->listRegister($request->user(), [
            'q' => $data['q'],
            'per_page' => $data['per_page'] ?? 25,
        ]));
    }

    public function upload(Request $request): JsonResponse
    {
        $this->authorizeUpload($request);
        $data = $request->validate([
            'file' => ['required', 'file', 'max:51200'],
            'title' => ['nullable', 'string', 'max:255'],
            'module' => ['nullable', 'string', 'max:64'],
            'document_type' => ['nullable', 'string', 'max:64'],
            'subject_type' => ['nullable', 'string', 'max:255'],
            'subject_id' => ['nullable', 'integer'],
            'classification' => ['nullable', 'string', 'max:32'],
            'notes' => ['nullable', 'string'],
            'document_id' => ['nullable', 'integer'],
        ]);
        $result = $this->documents->upload($request->user(), $request->file('file'), $data);

        return response()->json([
            'message' => 'Document uploaded.',
            'data' => ['document' => $result['document'], 'version' => $result['version']],
        ], 201);
    }

    public function show(Request $request, ManagedDocument $document): JsonResponse
    {
        $this->assertTenant($request, $document->tenant_id);

        return response()->json(['data' => $this->documents->metadata($request->user(), $document)]);
    }

    public function versions(Request $request, ManagedDocument $document): JsonResponse
    {
        $this->assertTenant($request, $document->tenant_id);

        return response()->json(['data' => $this->documents->listVersions($request->user(), $document)]);
    }

    public function download(Request $request, DocumentVersion $version): StreamedResponse|JsonResponse
    {
        $this->assertTenant($request, $version->tenant_id);

        return $this->documents->streamDownload($request->user(), $version);
    }

    public function issueToken(Request $request, DocumentVersion $version): JsonResponse
    {
        $this->assertTenant($request, $version->tenant_id);
        $data = $request->validate([
            'ttl_seconds' => ['nullable', 'integer', 'min:30', 'max:3600'],
            'max_uses' => ['nullable', 'integer', 'min:1', 'max:10'],
        ]);

        return response()->json(['data' => $this->documents->issueDownloadToken(
            $request->user(),
            $version,
            (int) ($data['ttl_seconds'] ?? 300),
            (int) ($data['max_uses'] ?? 1),
        )]);
    }

    public function downloadViaToken(Request $request, string $token): StreamedResponse|JsonResponse
    {
        return $this->documents->streamViaToken($token, $request->user());
    }

    public function markFinal(Request $request, DocumentVersion $version): JsonResponse
    {
        $this->assertTenant($request, $version->tenant_id);
        if (! $request->user()->can('documents.admin') && ! $request->user()->can('documents.finalize') && ! $request->user()->isSystemAdmin()) {
            abort(403);
        }

        return response()->json([
            'message' => 'Document version marked final.',
            'data' => $this->documents->markFinal($request->user(), $version),
        ]);
    }

    public function placeLegalHold(Request $request, ManagedDocument $document): JsonResponse
    {
        $this->assertTenant($request, $document->tenant_id);
        $this->authorizeLegalHold($request);
        $data = $request->validate(['legal_hold_reason' => ['required', 'string', 'max:2000']]);

        return response()->json([
            'message' => 'Legal hold placed.',
            'data' => $this->documents->placeLegalHold($request->user(), $document, $data['legal_hold_reason']),
        ]);
    }

    public function releaseLegalHold(Request $request, ManagedDocument $document): JsonResponse
    {
        $this->assertTenant($request, $document->tenant_id);
        $this->authorizeLegalHold($request);

        return response()->json([
            'message' => 'Legal hold released.',
            'data' => $this->documents->releaseLegalHold($request->user(), $document),
        ]);
    }

    public function setRetention(Request $request, ManagedDocument $document): JsonResponse
    {
        $this->assertTenant($request, $document->tenant_id);
        $this->authorizeLegalHold($request);
        $data = $request->validate([
            'retention_policy' => ['nullable', 'string', 'max:64'],
            'retain_until' => ['nullable', 'date'],
        ]);

        return response()->json([
            'message' => 'Retention updated.',
            'data' => $this->documents->setRetention($request->user(), $document, $data),
        ]);
    }

    public function purge(Request $request, ManagedDocument $document): JsonResponse
    {
        $this->assertTenant($request, $document->tenant_id);
        if (! $request->user()->can('documents.admin') && ! $request->user()->isSystemAdmin()) {
            abort(403);
        }

        return response()->json([
            'message' => 'Document purged.',
            'data' => $this->documents->purge($request->user(), $document),
        ]);
    }

    public function verify(Request $request, string $hash): JsonResponse
    {
        return response()->json(['data' => $this->documents->verifyByHash($hash, $request->user(), false)]);
    }

    public function publicVerify(Request $request, string $hash): JsonResponse
    {
        return response()->json(['data' => $this->documents->verifyByHash($hash, null, true)]);
    }

    public function audit(Request $request): JsonResponse
    {
        if (! $request->user()->can('documents.admin') && ! $request->user()->can('documents.view-audit') && ! $request->user()->isSystemAdmin()) {
            abort(403);
        }
        $rows = DocumentAuditEvent::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->latest('id')
            ->limit(200)
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function backupStatus(Request $request): JsonResponse
    {
        $this->authorizeAdminOrView($request);

        return response()->json([
            'data' => [
                'hook_enabled' => (bool) config('documents.backup.hook_enabled'),
                'last_verified_at' => config('documents.backup.last_verified_at'),
                'rpo_hours' => (int) config('documents.backup.rpo_hours', 24),
                'note' => 'Backup schedules are ops-owned; this endpoint exposes configuration hooks only.',
            ],
        ]);
    }

    // Phase 2
    public function initiateUpload(Request $request): JsonResponse
    {
        $this->authorizeUpload($request);
        $data = $request->validate([
            'original_filename' => ['required', 'string', 'max:255'],
            'mime_type' => ['nullable', 'string', 'max:128'],
            'declared_size' => ['nullable', 'integer', 'min:1'],
            'chunk_size' => ['nullable', 'integer', 'min:65536'],
            'total_chunks' => ['nullable', 'integer', 'min:1'],
            'meta' => ['nullable', 'array'],
        ]);

        return response()->json(['data' => $this->phase23->initiateUpload($request->user(), $data)], 201);
    }

    public function appendChunk(Request $request, string $sessionUuid): JsonResponse
    {
        $this->authorizeUpload($request);
        $session = DocumentUploadSession::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->where('session_uuid', $sessionUuid)
            ->firstOrFail();
        $data = $request->validate([
            'chunk' => ['required', 'file', 'max:10240'],
            'index' => ['required', 'integer', 'min:0'],
        ]);

        return response()->json([
            'data' => $this->phase23->appendChunk($request->user(), $session, $request->file('chunk'), (int) $data['index']),
        ]);
    }

    public function completeUpload(Request $request, string $sessionUuid): JsonResponse
    {
        $this->authorizeUpload($request);
        $session = DocumentUploadSession::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->where('session_uuid', $sessionUuid)
            ->firstOrFail();
        $meta = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'module' => ['nullable', 'string', 'max:64'],
            'document_type' => ['nullable', 'string', 'max:64'],
            'classification' => ['nullable', 'string', 'max:32'],
        ]);
        $result = $this->phase23->completeUpload($request->user(), $session, $meta);

        return response()->json([
            'message' => 'Upload session completed.',
            'data' => ['document' => $result['document'], 'version' => $result['version']],
        ]);
    }

    public function externalShare(Request $request, DocumentVersion $version): JsonResponse
    {
        $this->assertTenant($request, $version->tenant_id);
        $this->authorizeAdminOrView($request);
        $data = $request->validate([
            'recipient_email' => ['nullable', 'email'],
            'ttl_seconds' => ['nullable', 'integer', 'min:60', 'max:604800'],
            'max_uses' => ['nullable', 'integer', 'min:1', 'max:50'],
            'watermark' => ['nullable', 'boolean'],
        ]);

        return response()->json(['data' => $this->phase23->createExternalShare($request->user(), $version, $data)], 201);
    }

    public function publicShare(Request $request, string $token): StreamedResponse|JsonResponse
    {
        return $this->phase23->streamExternalShare($token);
    }

    public function queueOcr(Request $request, DocumentVersion $version): JsonResponse
    {
        $this->assertTenant($request, $version->tenant_id);

        return response()->json(['data' => $this->phase23->queueOcr($request->user(), $version)], 201);
    }

    public function redact(Request $request, DocumentVersion $version): JsonResponse
    {
        $this->assertTenant($request, $version->tenant_id);
        $this->authorizeUpload($request);
        $request->validate(['file' => ['required', 'file', 'max:51200'], 'notes' => ['nullable', 'string']]);
        $result = $this->phase23->createRedactionVersion(
            $request->user(),
            $version,
            $request->file('file'),
            $request->input('notes')
        );

        return response()->json([
            'message' => 'Redaction stored as new version (original unchanged).',
            'data' => ['document' => $result['document'], 'version' => $result['version']],
        ], 201);
    }

    public function duplicates(Request $request, string $hash): JsonResponse
    {
        $this->authorizeAdminOrView($request);

        return response()->json(['data' => $this->phase23->duplicateSuggestions($request->user(), $hash)]);
    }

    public function retentionDashboard(Request $request): JsonResponse
    {
        $this->authorizeLegalHold($request);

        return response()->json(['data' => $this->phase23->retentionDashboard($request->user())]);
    }

    public function createRetentionCampaign(Request $request): JsonResponse
    {
        $this->authorizeLegalHold($request);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'cutoff_date' => ['nullable', 'date'],
            'filters' => ['nullable', 'array'],
        ]);

        return response()->json(['data' => $this->phase23->createRetentionCampaign($request->user(), $data)], 201);
    }

    public function requestDisposal(Request $request, ManagedDocument $document): JsonResponse
    {
        $this->assertTenant($request, $document->tenant_id);
        $this->authorizeLegalHold($request);
        $data = $request->validate(['reason' => ['required', 'string', 'max:2000']]);

        return response()->json([
            'data' => $this->phase23->requestDisposal($request->user(), $document, $data['reason']),
        ], 201);
    }

    public function updatePhysicalArchive(Request $request, ManagedDocument $document): JsonResponse
    {
        $this->assertTenant($request, $document->tenant_id);
        $this->authorizeAdminOrView($request);
        $data = $request->validate([
            'archive_class' => ['nullable', 'string', 'in:hot,warm,cold,archive'],
            'archive_status' => ['nullable', 'string', 'in:active,archived,pending_disposal,disposed'],
            'physical_barcode' => ['nullable', 'string', 'max:128'],
            'physical_location' => ['nullable', 'string', 'max:255'],
            'has_physical_original' => ['nullable', 'boolean'],
        ]);

        return response()->json([
            'data' => $this->phase23->updatePhysicalAndArchive($request->user(), $document, $data),
        ]);
    }

    public function migrationStatus(Request $request): JsonResponse
    {
        $this->authorizeAdminOrView($request);

        return response()->json(['data' => $this->phase23->migrationUtilityStatus()]);
    }

    public function bulkRescan(Request $request): JsonResponse
    {
        $this->authorizeLegalHold($request);
        $data = $request->validate(['version_ids' => ['required', 'array', 'min:1'], 'version_ids.*' => ['integer']]);

        return response()->json(['data' => $this->phase23->bulkRescan($request->user(), $data['version_ids'])]);
    }

    public function aiSuggest(Request $request, ManagedDocument $document): JsonResponse
    {
        $this->assertTenant($request, $document->tenant_id);
        $data = $request->validate(['action' => ['required', 'string']]);

        return response()->json(['data' => $this->phase23->aiSuggest($request->user(), $document, $data['action'])]);
    }

    public function governanceIndex(Request $request): JsonResponse
    {
        $this->authorizeAdminOrView($request);
        $rows = $this->governance->listForTenant((int) $request->user()->tenant_id);

        return response()->json([
            'data' => $rows,
            'meta' => [
                'prd_section' => 125,
                'note' => 'All items default to Pending. Do not invent institutional answers in code.',
                'av_driver' => config('documents.av_driver', 'null'),
                'ocr_driver' => config('documents.ocr_driver', 'null'),
            ],
        ]);
    }

    public function governanceUpdate(Request $request, DocumentGovernanceDecision $decision): JsonResponse
    {
        $this->authorizeAdminOrView($request);
        $this->assertTenant($request, (int) $decision->tenant_id);
        $data = $request->validate([
            'status' => ['required', 'string', 'in:pending,decided,not_applicable'],
            'decision_notes' => ['nullable', 'string', 'max:5000'],
        ]);

        return response()->json([
            'message' => 'Governance decision updated.',
            'data' => $this->governance->update($request->user(), $decision, $data),
        ]);
    }

    private function authorizeUpload(Request $request): void
    {
        $user = $request->user();
        if (
            $user->can('documents.upload')
            || $user->can('documents.admin')
            || $user->can('documents.sign')
            || $user->can('workflows.sign')
            || $user->isSystemAdmin()
        ) {
            return;
        }
        abort(403);
    }

    private function authorizeAdminOrView(Request $request): void
    {
        $user = $request->user();
        if (
            $user->can('documents.admin')
            || $user->can('documents.view')
            || $user->can('documents.view-audit')
            || $user->isSystemAdmin()
        ) {
            return;
        }
        abort(403);
    }

    private function authorizeLegalHold(Request $request): void
    {
        $user = $request->user();
        if (
            $user->can('documents.admin')
            || $user->can('documents.legal-hold')
            || $user->isSystemAdmin()
        ) {
            return;
        }
        abort(403);
    }

    private function assertTenant(Request $request, int $tenantId): void
    {
        if ((int) $request->user()->tenant_id !== (int) $tenantId) {
            abort(404);
        }
    }
}
