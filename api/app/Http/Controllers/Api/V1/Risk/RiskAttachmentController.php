<?php

namespace App\Http\Controllers\Api\V1\Risk;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\AuditLog;
use App\Models\Risk;
use App\Support\AttachmentFiles;
use App\Support\UploadContentSniffer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class RiskAttachmentController extends Controller
{
    public function index(Request $request, Risk $risk): JsonResponse
    {
        $this->ensureCanAccess($request, $risk);
        $attachments = $risk->attachments()->with('uploader:id,name')->orderByDesc('created_at')->get();

        return response()->json(['data' => $attachments]);
    }

    public function store(Request $request, Risk $risk): JsonResponse
    {
        $this->ensureCanAccess($request, $risk);
        $request->validate([
            'file' => ['required', 'file', 'max:25600'], // 25 MB
            'document_type' => ['nullable', 'string', 'in:'.implode(',', Attachment::RISK_DOCUMENT_TYPES)],
        ]);
        $file = $request->file('file');
        $mime = UploadContentSniffer::assertAllowed($file);
        $attachment = AttachmentFiles::store($file, 'attachments/risks/'.$risk->id, fn (string $path) => $risk->attachments()->create([
            'tenant_id' => $risk->tenant_id,
            'uploaded_by' => $request->user()->id,
            'document_type' => $request->input('document_type', Attachment::DOCUMENT_TYPE_RISK_EVIDENCE),
            'original_filename' => $file->getClientOriginalName(),
            'storage_path' => $path,
            'mime_type' => $mime,
            'size_bytes' => $file->getSize(),
        ]));
        $attachment->load('uploader:id,name');

        return response()->json(['message' => 'Attachment uploaded.', 'data' => $attachment], 201);
    }

    public function destroy(Request $request, Risk $risk, Attachment $attachment): JsonResponse
    {
        $this->ensureCanAccess($request, $risk);
        if ($attachment->attachable_type !== Risk::class || (int) $attachment->attachable_id !== (int) $risk->id) {
            abort(404);
        }

        // Evidence on a risk that has left draft/proposed (Risk::isEditable) is
        // part of the reviewed record: only risk administrators may remove it,
        // and the removal is audited. Adding new evidence remains allowed.
        if (! $risk->isEditable()) {
            $user = $request->user();
            if (! $user->isSystemAdmin() && ! $user->hasAnyPermission(['risk.admin'])) {
                return response()->json([
                    'message' => 'Evidence on a submitted or approved risk cannot be removed.',
                ], 422);
            }
            AuditLog::record('risk.attachment_removed_after_submission', [
                'auditable_type' => Risk::class,
                'auditable_id' => $risk->id,
                'tags' => 'risk',
                'new_values' => ['attachment_id' => $attachment->id, 'original_filename' => $attachment->original_filename],
            ]);
        }

        AttachmentFiles::delete($attachment);

        return response()->json(['message' => 'Attachment deleted.']);
    }

    public function download(Request $request, Risk $risk, Attachment $attachment): StreamedResponse|JsonResponse
    {
        $this->ensureCanAccess($request, $risk);
        if ($attachment->attachable_type !== Risk::class || (int) $attachment->attachable_id !== (int) $risk->id) {
            abort(404);
        }

        return AttachmentFiles::download($attachment);
    }

    private function ensureCanAccess(Request $request, Risk $risk): void
    {
        if ($risk->tenant_id !== $request->user()->tenant_id) {
            abort(404);
        }
    }
}
