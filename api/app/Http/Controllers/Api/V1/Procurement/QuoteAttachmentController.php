<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\ProcurementQuote;
use App\Models\ProcurementRequest;
use App\Support\AttachmentFiles;
use App\Support\UploadContentSniffer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class QuoteAttachmentController extends Controller
{
    public function index(Request $request, ProcurementRequest $procurementRequest, ProcurementQuote $quote): JsonResponse
    {
        $this->ensureCanAccess($request, $procurementRequest, $quote);

        $attachments = $quote->attachments()->with('uploader:id,name')->get();

        return response()->json(['data' => $attachments]);
    }

    public function store(Request $request, ProcurementRequest $procurementRequest, ProcurementQuote $quote): JsonResponse
    {
        $this->ensureCanAccess($request, $procurementRequest, $quote);

        if (! $request->user()->hasAnyRole(['Procurement Officer', 'Finance Controller', 'System Admin', 'super-admin', 'Secretary General'])) {
            abort(403);
        }

        $request->validate([
            'file' => ['required', 'file', 'max:25600'],
            'document_type' => ['nullable', 'string', 'in:'.implode(',', [
                Attachment::DOCUMENT_TYPE_QUOTE_RECEIVED,
                Attachment::DOCUMENT_TYPE_OTHER,
            ])],
        ]);

        $file = $request->file('file');
        $mime = UploadContentSniffer::assertAllowed($file);
        $attachment = AttachmentFiles::store($file, 'attachments/procurement-quotes/'.$quote->id, fn (string $path) => $quote->attachments()->create([
            'tenant_id' => $procurementRequest->tenant_id,
            'uploaded_by' => $request->user()->id,
            'document_type' => $request->input('document_type', Attachment::DOCUMENT_TYPE_QUOTE_RECEIVED),
            'original_filename' => $file->getClientOriginalName(),
            'storage_path' => $path,
            'mime_type' => $mime,
            'size_bytes' => $file->getSize(),
        ]));

        $attachment->load('uploader:id,name');

        return response()->json(['message' => 'Attachment uploaded.', 'data' => $attachment], 201);
    }

    public function destroy(Request $request, ProcurementRequest $procurementRequest, ProcurementQuote $quote, Attachment $attachment): JsonResponse
    {
        $this->ensureCanAccess($request, $procurementRequest, $quote);

        if (! $request->user()->hasAnyRole(['Procurement Officer', 'Finance Controller', 'System Admin', 'super-admin', 'Secretary General'])) {
            abort(403);
        }

        if ($attachment->attachable_type !== ProcurementQuote::class || (int) $attachment->attachable_id !== (int) $quote->id) {
            abort(404);
        }

        AttachmentFiles::delete($attachment);

        return response()->json(['message' => 'Attachment deleted.']);
    }

    public function download(Request $request, ProcurementRequest $procurementRequest, ProcurementQuote $quote, Attachment $attachment): StreamedResponse|JsonResponse
    {
        $this->ensureCanAccess($request, $procurementRequest, $quote);

        if ($attachment->attachable_type !== ProcurementQuote::class || (int) $attachment->attachable_id !== (int) $quote->id) {
            abort(404);
        }

        return AttachmentFiles::download($attachment);
    }

    private function ensureCanAccess(Request $request, ProcurementRequest $procurementRequest, ProcurementQuote $quote): void
    {
        if ((int) $procurementRequest->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        if ((int) $quote->procurement_request_id !== (int) $procurementRequest->id) {
            abort(404);
        }
    }
}
