<?php

namespace App\Http\Controllers\Api\V1\Srhr;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\ResearcherReport;
use App\Support\AttachmentFiles;
use App\Support\UploadContentSniffer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ResearcherReportAttachmentController extends Controller
{
    private function ensureTenant(ResearcherReport $report): void
    {
        abort_unless((int) $report->tenant_id === (int) request()->user()->tenant_id, 404);
    }

    public function index(ResearcherReport $researcherReport): JsonResponse
    {
        $this->ensureTenant($researcherReport);
        $attachments = $researcherReport->attachments()->with('uploader:id,name')->orderByDesc('created_at')->get();

        return response()->json(['data' => $attachments]);
    }

    public function store(Request $request, ResearcherReport $researcherReport): JsonResponse
    {
        $this->ensureTenant($researcherReport);

        $request->validate([
            'file' => ['required', 'file', 'max:25600'], // 25 MB
            'document_type' => ['nullable', 'string', 'in:'.implode(',', Attachment::DOCUMENT_TYPES)],
        ]);

        $file = $request->file('file');
        $mime = UploadContentSniffer::assertAllowed($file);
        $attachment = AttachmentFiles::store(
            $file,
            'attachments/researcher-reports/'.$researcherReport->id,
            fn (string $path) => $researcherReport->attachments()->create([
                'tenant_id' => $researcherReport->tenant_id,
                'uploaded_by' => $request->user()->id,
                'document_type' => $request->input('document_type', Attachment::DOCUMENT_TYPE_OTHER),
                'original_filename' => $file->getClientOriginalName(),
                'storage_path' => $path,
                'mime_type' => $mime,
                'size_bytes' => $file->getSize(),
            ])
        );

        $attachment->load('uploader:id,name');

        return response()->json(['message' => 'Attachment uploaded.', 'data' => $attachment], 201);
    }

    public function destroy(ResearcherReport $researcherReport, Attachment $attachment): JsonResponse
    {
        $this->ensureTenant($researcherReport);

        if ($attachment->attachable_type !== ResearcherReport::class || (int) $attachment->attachable_id !== (int) $researcherReport->id) {
            abort(404);
        }

        AttachmentFiles::delete($attachment);

        return response()->json(['message' => 'Attachment deleted.']);
    }

    public function download(ResearcherReport $researcherReport, Attachment $attachment): StreamedResponse|JsonResponse
    {
        $this->ensureTenant($researcherReport);

        if ($attachment->attachable_type !== ResearcherReport::class || (int) $attachment->attachable_id !== (int) $researcherReport->id) {
            abort(404);
        }

        return AttachmentFiles::download($attachment);
    }
}
