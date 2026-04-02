<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\ProcurementRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProcurementRequestAttachmentController extends Controller
{
    public function index(Request $request, ProcurementRequest $procurementRequest): JsonResponse
    {
        $this->ensureCanAccess($request, $procurementRequest);
        $attachments = $procurementRequest->attachments()->with('uploader:id,name')->get();
        return response()->json(['data' => $attachments]);
    }

    public function store(Request $request, ProcurementRequest $procurementRequest): JsonResponse
    {
        $this->ensureCanAccess($request, $procurementRequest);
        $request->validate([
            'file'          => ['required', 'file', 'max:25600'],
            'document_type' => ['nullable', 'string', 'in:' . implode(',', Attachment::PROCUREMENT_REQUEST_DOCUMENT_TYPES)],
        ]);
        $file = $request->file('file');
        $path = $file->store('attachments/procurement-requests/' . $procurementRequest->id, ['disk' => 'local']);
        $attachment = $procurementRequest->attachments()->create([
            'tenant_id'         => $procurementRequest->tenant_id,
            'uploaded_by'       => $request->user()->id,
            'document_type'     => $request->input('document_type', Attachment::DOCUMENT_TYPE_RFQ_DOCUMENT),
            'original_filename' => $file->getClientOriginalName(),
            'storage_path'      => $path,
            'mime_type'         => $file->getMimeType(),
            'size_bytes'        => $file->getSize(),
        ]);
        $attachment->load('uploader:id,name');
        return response()->json(['message' => 'Attachment uploaded.', 'data' => $attachment], 201);
    }

    public function destroy(Request $request, ProcurementRequest $procurementRequest, Attachment $attachment): JsonResponse
    {
        $this->ensureCanAccess($request, $procurementRequest);
        if ($attachment->attachable_type !== ProcurementRequest::class || (int) $attachment->attachable_id !== (int) $procurementRequest->id) {
            abort(404);
        }
        if ($attachment->storage_path && Storage::disk('local')->exists($attachment->storage_path)) {
            Storage::disk('local')->delete($attachment->storage_path);
        }
        $attachment->delete();
        return response()->json(['message' => 'Attachment deleted.']);
    }

    public function download(Request $request, ProcurementRequest $procurementRequest, Attachment $attachment): StreamedResponse|JsonResponse
    {
        $this->ensureCanAccess($request, $procurementRequest);
        if ($attachment->attachable_type !== ProcurementRequest::class || (int) $attachment->attachable_id !== (int) $procurementRequest->id) {
            abort(404);
        }
        if (! $attachment->storage_path || ! Storage::disk('local')->exists($attachment->storage_path)) {
            return response()->json(['message' => 'File not found.'], 404);
        }
        return response()->streamDownload(
            function () use ($attachment) {
                $stream = Storage::disk('local')->readStream($attachment->storage_path);
                if (is_resource($stream)) { fpassthru($stream); fclose($stream); }
            },
            $attachment->original_filename,
            ['Content-Type' => $attachment->mime_type ?: 'application/octet-stream']
        );
    }

    private function ensureCanAccess(Request $request, ProcurementRequest $procurementRequest): void
    {
        if ($procurementRequest->tenant_id !== $request->user()->tenant_id) {
            abort(404);
        }
    }
}
