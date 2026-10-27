<?php

namespace App\Http\Controllers\Api\V1\Hr;

use App\Http\Controllers\Controller;
use App\Models\Appraisal;
use App\Models\Attachment;
use App\Support\AttachmentFiles;
use App\Support\UploadContentSniffer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
            'file' => ['required', 'file', 'max:25600'], // 25 MB
            'document_type' => ['nullable', 'string', 'in:'.implode(',', Attachment::APPRAISAL_DOCUMENT_TYPES)],
        ]);
        $file = $request->file('file');
        $mime = UploadContentSniffer::assertAllowed($file);
        $attachment = AttachmentFiles::store(
            $file,
            'attachments/appraisals/'.$appraisal->id,
            fn (string $path) => $appraisal->attachments()->create([
                'tenant_id' => $appraisal->tenant_id,
                'uploaded_by' => $request->user()->id,
                'document_type' => $request->input('document_type', Attachment::DOCUMENT_TYPE_APPRAISAL_EVIDENCE),
                'original_filename' => $file->getClientOriginalName(),
                'storage_path' => $path,
                'mime_type' => $mime,
                'size_bytes' => $file->getSize(),
            ])
        );
        $attachment->load('uploader:id,name');

        return response()->json(['message' => 'Attachment uploaded.', 'data' => $attachment], 201);
    }

    public function destroy(Request $request, Appraisal $appraisal, Attachment $attachment): JsonResponse
    {
        $this->ensureCanView($request, $appraisal);
        if ($attachment->attachable_type !== Appraisal::class || (int) $attachment->attachable_id !== (int) $appraisal->id) {
            abort(404);
        }
        AttachmentFiles::delete($attachment);

        return response()->json(['message' => 'Attachment deleted.']);
    }

    public function download(Request $request, Appraisal $appraisal, Attachment $attachment): StreamedResponse|JsonResponse
    {
        $this->ensureCanView($request, $appraisal);
        if ($attachment->attachable_type !== Appraisal::class || (int) $attachment->attachable_id !== (int) $appraisal->id) {
            abort(404);
        }

        return AttachmentFiles::download($attachment);
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
