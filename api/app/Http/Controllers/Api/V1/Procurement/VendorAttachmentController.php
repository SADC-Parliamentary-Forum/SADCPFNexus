<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\Vendor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class VendorAttachmentController extends Controller
{
    public function index(Request $request, Vendor $vendor): JsonResponse
    {
        $this->ensureCanAccess($request, $vendor);
        $attachments = $vendor->attachments()->with('uploader:id,name')->get();
        return response()->json(['data' => $attachments]);
    }

    public function store(Request $request, Vendor $vendor): JsonResponse
    {
        $this->ensureCanAccess($request, $vendor);
        $request->validate([
            'file'          => ['required', 'file', 'max:25600'],
            'document_type' => ['nullable', 'string', 'in:' . implode(',', Attachment::VENDOR_DOCUMENT_TYPES)],
        ]);
        $file = $request->file('file');
        $path = $file->store('attachments/vendors/' . $vendor->id, ['disk' => 'local']);
        $attachment = $vendor->attachments()->create([
            'tenant_id'         => $vendor->tenant_id,
            'uploaded_by'       => $request->user()->id,
            'document_type'     => $request->input('document_type', Attachment::DOCUMENT_TYPE_COMPANY_PROFILE),
            'original_filename' => $file->getClientOriginalName(),
            'storage_path'      => $path,
            'mime_type'         => $file->getMimeType(),
            'size_bytes'        => $file->getSize(),
        ]);
        $attachment->load('uploader:id,name');
        return response()->json(['message' => 'Attachment uploaded.', 'data' => $attachment], 201);
    }

    public function destroy(Request $request, Vendor $vendor, Attachment $attachment): JsonResponse
    {
        $this->ensureCanAccess($request, $vendor);
        if ($attachment->attachable_type !== Vendor::class || (int) $attachment->attachable_id !== (int) $vendor->id) {
            abort(404);
        }
        if ($attachment->storage_path && Storage::disk('local')->exists($attachment->storage_path)) {
            Storage::disk('local')->delete($attachment->storage_path);
        }
        $attachment->delete();
        return response()->json(['message' => 'Attachment deleted.']);
    }

    public function download(Request $request, Vendor $vendor, Attachment $attachment): StreamedResponse|JsonResponse
    {
        $this->ensureCanAccess($request, $vendor);
        if ($attachment->attachable_type !== Vendor::class || (int) $attachment->attachable_id !== (int) $vendor->id) {
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

    private function ensureCanAccess(Request $request, Vendor $vendor): void
    {
        if ($vendor->tenant_id !== $request->user()->tenant_id) {
            abort(404);
        }
    }
}
