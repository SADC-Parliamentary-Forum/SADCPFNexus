<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\PurchaseOrder;
use App\Support\AttachmentFiles;
use App\Support\UploadContentSniffer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PurchaseOrderAttachmentController extends Controller
{
    public function index(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->ensureCanAccess($request, $purchaseOrder);
        $attachments = $purchaseOrder->attachments()->with('uploader:id,name')->get();

        return response()->json(['data' => $attachments]);
    }

    public function store(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->ensureCanAccess($request, $purchaseOrder);
        $request->validate([
            'file' => ['required', 'file', 'max:25600'],
            'document_type' => ['nullable', 'string', 'in:'.implode(',', Attachment::PURCHASE_ORDER_DOCUMENT_TYPES)],
        ]);
        $file = $request->file('file');
        $mime = UploadContentSniffer::assertAllowed($file);
        $attachment = AttachmentFiles::store($file, 'attachments/purchase-orders/'.$purchaseOrder->id, fn (string $path) => $purchaseOrder->attachments()->create([
            'tenant_id' => $purchaseOrder->tenant_id,
            'uploaded_by' => $request->user()->id,
            'document_type' => $request->input('document_type', Attachment::DOCUMENT_TYPE_SIGNED_PO),
            'original_filename' => $file->getClientOriginalName(),
            'storage_path' => $path,
            'mime_type' => $mime,
            'size_bytes' => $file->getSize(),
        ]));
        $attachment->load('uploader:id,name');

        return response()->json(['message' => 'Attachment uploaded.', 'data' => $attachment], 201);
    }

    public function destroy(Request $request, PurchaseOrder $purchaseOrder, Attachment $attachment): JsonResponse
    {
        $this->ensureCanAccess($request, $purchaseOrder);
        if ($attachment->attachable_type !== PurchaseOrder::class || (int) $attachment->attachable_id !== (int) $purchaseOrder->id) {
            abort(404);
        }
        AttachmentFiles::delete($attachment);

        return response()->json(['message' => 'Attachment deleted.']);
    }

    public function download(Request $request, PurchaseOrder $purchaseOrder, Attachment $attachment): StreamedResponse|JsonResponse
    {
        $this->ensureCanAccess($request, $purchaseOrder);
        if ($attachment->attachable_type !== PurchaseOrder::class || (int) $attachment->attachable_id !== (int) $purchaseOrder->id) {
            abort(404);
        }

        return AttachmentFiles::download($attachment);
    }

    private function ensureCanAccess(Request $request, PurchaseOrder $purchaseOrder): void
    {
        if ($purchaseOrder->tenant_id !== $request->user()->tenant_id) {
            abort(404);
        }
    }
}
