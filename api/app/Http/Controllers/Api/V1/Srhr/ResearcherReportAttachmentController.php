<?php

namespace App\Http\Controllers\Api\V1\Srhr;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\ResearcherReport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
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
            'file'          => ['required', 'file', 'max:25600'], // 25 MB
            'document_type' => ['nullable', 'string', 'in:' . implode(',', Attachment::DOCUMENT_TYPES)],
        ]);

        $file = $request->file('file');
        $path = $file->store(
            'attachments/researcher-reports/' . $researcherReport->id,
            ['disk' => 'local']
        );

        $attachment = $researcherReport->attachments()->create([
            'tenant_id'         => $researcherReport->tenant_id,
            'uploaded_by'       => $request->user()->id,
            'document_type'     => $request->input('document_type', Attachment::DOCUMENT_TYPE_OTHER),
            'original_filename' => $file->getClientOriginalName(),
            'storage_path'      => $path,
            'mime_type'         => $file->getMimeType(),
            'size_bytes'        => $file->getSize(),
        ]);

        $attachment->load('uploader:id,name');
        return response()->json(['message' => 'Attachment uploaded.', 'data' => $attachment], 201);
    }

    public function destroy(ResearcherReport $researcherReport, Attachment $attachment): JsonResponse
    {
        $this->ensureTenant($researcherReport);

        if ($attachment->attachable_type !== ResearcherReport::class || (int) $attachment->attachable_id !== (int) $researcherReport->id) {
            abort(404);
        }

        if ($attachment->storage_path && Storage::disk('local')->exists($attachment->storage_path)) {
            Storage::disk('local')->delete($attachment->storage_path);
        }

        $attachment->delete();
        return response()->json(['message' => 'Attachment deleted.']);
    }

    public function download(ResearcherReport $researcherReport, Attachment $attachment): StreamedResponse|JsonResponse
    {
        $this->ensureTenant($researcherReport);

        if ($attachment->attachable_type !== ResearcherReport::class || (int) $attachment->attachable_id !== (int) $researcherReport->id) {
            abort(404);
        }

        if (!$attachment->storage_path || !Storage::disk('local')->exists($attachment->storage_path)) {
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
            ['Content-Type' => $attachment->mime_type ?: 'application/octet-stream']
        );
    }
}
