<?php

namespace App\Http\Controllers\Api\V1\Documents;

use App\Http\Controllers\Controller;
use App\Models\Documents\DocumentAuditEvent;
use App\Models\Documents\DocumentVersion;
use App\Models\Documents\ManagedDocument;
use App\Modules\Documents\Services\DocumentStorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DocumentServiceController extends Controller
{
    public function __construct(
        private readonly DocumentStorageService $documents,
    ) {}

    public function upload(Request $request): JsonResponse
    {
        $this->authorizeUpload($request);

        $data = $request->validate([
            'file' => ['required', 'file', 'max:51200'],
            'title' => ['nullable', 'string', 'max:255'],
            'module' => ['nullable', 'string', 'max:64'],
            'subject_type' => ['nullable', 'string', 'max:255'],
            'subject_id' => ['nullable', 'integer'],
            'classification' => ['nullable', 'string', 'max:32'],
            'notes' => ['nullable', 'string'],
            'document_id' => ['nullable', 'integer'],
        ]);

        $result = $this->documents->upload($request->user(), $request->file('file'), $data);

        return response()->json([
            'message' => 'Document uploaded.',
            'data' => [
                'document' => $result['document'],
                'version' => $result['version'],
            ],
        ], 201);
    }

    public function show(Request $request, ManagedDocument $document): JsonResponse
    {
        $this->assertTenant($request, $document->tenant_id);

        return response()->json([
            'data' => $this->documents->metadata($request->user(), $document),
        ]);
    }

    public function versions(Request $request, ManagedDocument $document): JsonResponse
    {
        $this->assertTenant($request, $document->tenant_id);

        return response()->json([
            'data' => $this->documents->listVersions($request->user(), $document),
        ]);
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

        $issued = $this->documents->issueDownloadToken(
            $request->user(),
            $version,
            (int) ($data['ttl_seconds'] ?? 300),
            (int) ($data['max_uses'] ?? 1),
        );

        return response()->json(['data' => $issued]);
    }

    public function downloadViaToken(Request $request, string $token): StreamedResponse|JsonResponse
    {
        // Authenticated user preferred; token still scoped + short-lived.
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

    public function audit(Request $request): JsonResponse
    {
        if (! $request->user()->can('documents.admin') && ! $request->user()->can('documents.view-audit') && ! $request->user()->isSystemAdmin()) {
            abort(403);
        }

        $rows = DocumentAuditEvent::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->latest('id')
            ->limit(100)
            ->get();

        return response()->json(['data' => $rows]);
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

    private function assertTenant(Request $request, int $tenantId): void
    {
        if ((int) $request->user()->tenant_id !== (int) $tenantId) {
            abort(404);
        }
    }
}
