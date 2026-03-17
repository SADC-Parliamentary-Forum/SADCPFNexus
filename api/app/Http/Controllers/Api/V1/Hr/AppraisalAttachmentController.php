<?php

namespace App\Http\Controllers\Api\V1\Hr;

use App\Http\Controllers\Controller;
use App\Models\Appraisal;
use App\Models\Attachment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AppraisalAttachmentController extends Controller
{
    public function index(Request $request, Appraisal $appraisal): JsonResponse
    {
        $this->ensureCanView($request, $appraisal);
        $attachments = $appraisal->attachments()->with('uploader:id,name')->orderByDesc('created_at')->get();
        return response()->json(['data' => $attachments]);
    }

    public function store(Request $request, Appraisal $appraisal): JsonResponse
    {
        $this->ensureCanView($request, $appraisal);
        $request->validate([
            'file'          => ['required', 'file', 'max:25600'], // 25 MB
            'document_type' => ['nullable', 'string', 'in:' . implode(',', Attachment::APPRAISAL_DOCUMENT_TYPES)],
        ]);
        $file = $request->file('file');
        $path = $file->store(
            'attachments/appraisals/' . $appraisal->id,
            ['disk' => 'local']
        );
        $attachment = $appraisal->attachments()->create([
            'tenant_id'          => $appraisal->tenant_id,
            'uploaded_by'        => $request->user()->id,
            'document_type'     => $request->input('document_type', Attachment::DOCUMENT_TYPE_APPRAISAL_EVIDENCE),
            'original_filename'  => $file->getClientOriginalName(),
            'storage_path'       => $path,
            'mime_type'          => $file->getMimeType(),
            'size_bytes'         => $file->getSize(),
        ]);
        $attachment->load('uploader:id,name');
        return response()->json(['message' => 'Attachment uploaded.', 'data' => $attachment], 201);
    }

    public function destroy(Request $request, Appraisal $appraisal, Attachment $attachment): JsonResponse
    {
        $this->ensureCanView($request, $appraisal);
        if ($attachment->attachable_type !== Appraisal::class || (int) $attachment->attachable_id !== (int) $appraisal->id) {
            abort(404);
        }
        if ($attachment->storage_path && Storage::disk('local')->exists($attachment->storage_path)) {
            Storage::disk('local')->delete($attachment->storage_path);
        }
        $attachment->delete();
        return response()->json(['message' => 'Attachment deleted.']);
    }

    public function download(Request $request, Appraisal $appraisal, Attachment $attachment): StreamedResponse|JsonResponse
    {
        $this->ensureCanView($request, $appraisal);
        if ($attachment->attachable_type !== Appraisal::class || (int) $attachment->attachable_id !== (int) $appraisal->id) {
            abort(404);
        }
        if (! $attachment->storage_path || ! Storage::disk('local')->exists($attachment->storage_path)) {
            return response()->json(['message' => 'File not found.'], 404);
        }
        return response()->streamDownload(
            function () use ($attachment) {
                $stream = Storage::disk('local')->readStream($attachment->storage_path);
                if (is_resource($stream)) {
                    fpassthru($stream);
                    fclose($stream);
                }
            },
            $attachment->original_filename,
            [
                'Content-Type' => $attachment->mime_type ?: 'application/octet-stream',
            ]
        );
    }

    private function ensureCanView(Request $request, Appraisal $appraisal): void
    {
        $user = $request->user();
        if ($appraisal->tenant_id !== $user->tenant_id) {
            abort(404);
        }
        $isHrAdmin = $user->isSystemAdmin() || $user->hasPermissionTo('hr.admin');
        $canView = $isHrAdmin
            || $appraisal->employee_id === $user->id
            || $appraisal->supervisor_id === $user->id
            || $appraisal->hod_id === $user->id;
        if (! $canView) {
            abort(403);
        }
    }
}
