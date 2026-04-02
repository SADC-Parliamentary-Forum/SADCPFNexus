<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\Invoice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class InvoiceAttachmentController extends Controller
{
    public function index(Request $request, Invoice $invoice): JsonResponse
    {
        $this->ensureCanAccess($request, $invoice);
        $attachments = $invoice->attachments()->with('uploader:id,name')->get();
        return response()->json(['data' => $attachments]);
    }

    public function store(Request $request, Invoice $invoice): JsonResponse
    {
        $this->ensureCanAccess($request, $invoice);
        $request->validate([
            'file'          => ['required', 'file', 'max:25600'],
            'document_type' => ['nullable', 'string', 'in:' . implode(',', Attachment::INVOICE_DOCUMENT_TYPES)],
        ]);
        $file = $request->file('file');
        $path = $file->store('attachments/invoices/' . $invoice->id, ['disk' => 'local']);
        $attachment = $invoice->attachments()->create([
            'tenant_id'         => $invoice->tenant_id,
            'uploaded_by'       => $request->user()->id,
            'document_type'     => $request->input('document_type', Attachment::DOCUMENT_TYPE_TAX_INVOICE),
            'original_filename' => $file->getClientOriginalName(),
            'storage_path'      => $path,
            'mime_type'         => $file->getMimeType(),
            'size_bytes'        => $file->getSize(),
        ]);
        $attachment->load('uploader:id,name');
        return response()->json(['message' => 'Attachment uploaded.', 'data' => $attachment], 201);
    }

    public function destroy(Request $request, Invoice $invoice, Attachment $attachment): JsonResponse
    {
        $this->ensureCanAccess($request, $invoice);
        if ($attachment->attachable_type !== Invoice::class || (int) $attachment->attachable_id !== (int) $invoice->id) {
            abort(404);
        }
        if ($attachment->storage_path && Storage::disk('local')->exists($attachment->storage_path)) {
            Storage::disk('local')->delete($attachment->storage_path);
        }
        $attachment->delete();
        return response()->json(['message' => 'Attachment deleted.']);
    }

    public function download(Request $request, Invoice $invoice, Attachment $attachment): StreamedResponse|JsonResponse
    {
        $this->ensureCanAccess($request, $invoice);
        if ($attachment->attachable_type !== Invoice::class || (int) $attachment->attachable_id !== (int) $invoice->id) {
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

    private function ensureCanAccess(Request $request, Invoice $invoice): void
    {
        if ($invoice->tenant_id !== $request->user()->tenant_id) {
            abort(404);
        }
    }
}
