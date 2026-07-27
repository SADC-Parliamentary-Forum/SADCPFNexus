<?php

namespace App\Http\Controllers\Api\V1\Leave;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\LeaveRequest;
use App\Support\UploadContentSniffer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class LeaveAttachmentController extends Controller
{
    public function index(Request $request, LeaveRequest $leaveRequest): JsonResponse
    {
        $this->ensureCanView($request, $leaveRequest);
        $attachments = $leaveRequest->attachments()
            ->with('uploader:id,name')
            ->when(! $this->canAccessMedicalDocuments($request, $leaveRequest), function ($query) {
                $query->where('document_type', '!=', Attachment::DOCUMENT_TYPE_MEDICAL_CERTIFICATE);
            })
            ->get();

        return response()->json(['data' => $attachments]);
    }

    public function store(Request $request, LeaveRequest $leaveRequest): JsonResponse
    {
        $this->ensureCanView($request, $leaveRequest);
        $request->validate([
            'file'          => ['required', 'file', 'max:25600'], // 25 MB
            'document_type' => ['nullable', 'string', 'in:' . implode(',', Attachment::LEAVE_DOCUMENT_TYPES)],
        ]);
        if (
            $request->input('document_type') === Attachment::DOCUMENT_TYPE_MEDICAL_CERTIFICATE
            && ! $this->canAccessMedicalDocuments($request, $leaveRequest)
        ) {
            abort(403, 'You are not authorised to manage medical leave documents.');
        }

        $file = $request->file('file');
        $mime = UploadContentSniffer::assertAllowed($file);
        $path = $file->store(
            'attachments/leave/' . $leaveRequest->id,
            ['disk' => 'local']
        );
        $attachment = $leaveRequest->attachments()->create([
            'tenant_id'         => $leaveRequest->tenant_id,
            'uploaded_by'       => $request->user()->id,
            'document_type'     => $request->input('document_type', Attachment::DOCUMENT_TYPE_OTHER),
            'original_filename' => $file->getClientOriginalName(),
            'storage_path'      => $path,
            'mime_type'         => $mime,
            'size_bytes'        => $file->getSize(),
        ]);
        $attachment->load('uploader:id,name');
        return response()->json(['message' => 'Attachment uploaded.', 'data' => $attachment], 201);
    }

    public function destroy(Request $request, LeaveRequest $leaveRequest, Attachment $attachment): JsonResponse
    {
        $this->ensureCanView($request, $leaveRequest);
        if ($attachment->attachable_type !== LeaveRequest::class || (int) $attachment->attachable_id !== (int) $leaveRequest->id) {
            abort(404);
        }
        if ($this->isMedicalDocument($attachment) && ! $this->canAccessMedicalDocuments($request, $leaveRequest)) {
            abort(403, 'You are not authorised to manage medical leave documents.');
        }

        if ($attachment->storage_path && Storage::disk('local')->exists($attachment->storage_path)) {
            Storage::disk('local')->delete($attachment->storage_path);
        }
        $attachment->delete();
        return response()->json(['message' => 'Attachment deleted.']);
    }

    public function download(Request $request, LeaveRequest $leaveRequest, Attachment $attachment): StreamedResponse|JsonResponse
    {
        $this->ensureCanView($request, $leaveRequest);
        if ($attachment->attachable_type !== LeaveRequest::class || (int) $attachment->attachable_id !== (int) $leaveRequest->id) {
            abort(404);
        }
        if ($this->isMedicalDocument($attachment) && ! $this->canAccessMedicalDocuments($request, $leaveRequest)) {
            abort(403, 'You are not authorised to view medical leave documents.');
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
            ['Content-Type' => $attachment->mime_type ?: 'application/octet-stream']
        );
    }

    private function ensureCanView(Request $request, LeaveRequest $leaveRequest): void
    {
        $user = $request->user();
        if ($leaveRequest->tenant_id !== $user->tenant_id) {
            abort(404);
        }
        $isAdmin = $user->isSystemAdmin()
            || $user->hasPermissionTo('hr.admin')
            || $user->hasPermissionTo('leave.approve')
            || $user->hasAnyRole(['HOD', 'HR Manager', 'HR Administrator', 'Secretary General']);
        if (! $isAdmin && $leaveRequest->requester_id !== $user->id) {
            abort(403);
        }
    }

    private function canAccessMedicalDocuments(Request $request, LeaveRequest $leaveRequest): bool
    {
        $user = $request->user();

        if ((int) $leaveRequest->requester_id === (int) $user->id) {
            return true;
        }

        $hasHrRole = $user->hasAnyRole(['HR Manager', 'HR Administrator']);

        return $hasHrRole
            || (! $user->isSystemAdmin() && ! $user->hasRole('super-admin') && $user->hasPermissionTo('hr.admin'));
    }

    private function isMedicalDocument(Attachment $attachment): bool
    {
        return $attachment->document_type === Attachment::DOCUMENT_TYPE_MEDICAL_CERTIFICATE;
    }
}
