<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\User;
use App\Models\Vendor;
use App\Support\UploadContentSniffer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class VendorAttachmentController extends Controller
{
    public function index(Request $request, Vendor $vendor): JsonResponse
    {
        $this->ensureCanAccess($request, $vendor, manage: false);
        $attachments = $vendor->attachments()->with('uploader:id,name')->get();
        return response()->json(['data' => $attachments]);
    }

    public function store(Request $request, Vendor $vendor): JsonResponse
    {
        $this->ensureCanAccess($request, $vendor, manage: true);
        $request->validate([
            'file'          => ['required', 'file', 'max:25600'],
            'document_type' => ['nullable', 'string', 'in:' . implode(',', Attachment::VENDOR_DOCUMENT_TYPES)],
            'expires_at'    => ['nullable', 'date'],
        ]);
        $file = $request->file('file');
        $mime = UploadContentSniffer::assertAllowed($file);
        $path = $file->store('attachments/vendors/' . $vendor->id, ['disk' => 'local']);
        $attachment = $vendor->attachments()->create([
            'tenant_id'         => $vendor->tenant_id,
            'uploaded_by'       => $request->user()->id,
            'document_type'     => $request->input('document_type', Attachment::DOCUMENT_TYPE_COMPANY_PROFILE),
            'expires_at'        => $request->input('expires_at'),
            'original_filename' => $file->getClientOriginalName(),
            'storage_path'      => $path,
            'mime_type'         => $mime,
            'size_bytes'        => $file->getSize(),
        ]);
        $attachment->load('uploader:id,name');
        return response()->json(['message' => 'Attachment uploaded.', 'data' => $attachment], 201);
    }

    public function destroy(Request $request, Vendor $vendor, Attachment $attachment): JsonResponse
    {
        $this->ensureCanAccess($request, $vendor, manage: true);
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
        $this->ensureCanAccess($request, $vendor, manage: false);
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

    private function ensureCanAccess(Request $request, Vendor $vendor, bool $manage): void
    {
        if ($vendor->tenant_id !== $request->user()->tenant_id) {
            abort(404);
        }

        $user = $request->user();
        if ($user->isSupplier()) {
            abort_unless((int) $user->vendor_id === (int) $vendor->id, 404);
            abort_if($manage, 403, 'You are not authorised to change vendor documents.');
            return;
        }

        abort_unless(
            $manage ? $this->canManageVendorDocuments($user) : $this->canViewVendorDocuments($user),
            403,
            'You are not authorised to access vendor documents.'
        );
    }

    private function canViewVendorDocuments(User $user): bool
    {
        return $this->canManageVendorDocuments($user)
            || $user->can('procurement.view')
            || $user->can('procurement.admin')
            || $user->can('procurement.supplier.read');
    }

    private function canManageVendorDocuments(User $user): bool
    {
        return $user->isSystemAdmin()
            || $user->can('procurement.manage_vendors')
            || $user->can('procurement.admin')
            || $user->can('procurement.supplier.approve')
            || $user->hasAnyRole([
                'Procurement Officer',
                'Finance Controller',
                'Secretary General',
            ]);
    }
}
