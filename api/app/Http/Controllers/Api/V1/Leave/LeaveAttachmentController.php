<?php

namespace App\Http\Controllers\Api\V1\Leave;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\LeaveRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class LeaveAttachmentController extends Controller
{
    public function index(Request $request, LeaveRequest $leaveRequest): JsonResponse
    {
        $this->ensureCanView($request, $leaveRequest);
        $attachments = $leaveRequest->attachments()->with('uploader:id,name')->get();
        return response()->json(['data' => $attachments]);
    }

    public function store(Request $request, LeaveRequest $leaveRequest): JsonResponse
    {
        $this->ensureCanView($request, $leaveRequest);
        $request->validate([
            'file'          => ['required', 'file', 'max:25600'], // 25 MB
            'document_type' => ['nullable', 'string', 'in:' . implode(',', Attachment::LEAVE_DOCUMENT_TYPES)],
        ]);
        $file = $request->file('file');
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
            'mime_type'         => $file->getMimeType(),
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
        $isAdmin = $user->isSystemAdmin() || $user->hasPermissionTo('hr.admin') || $user->hasPermissionTo('leave.approve');
        if (! $isAdmin && $leaveRequest->requester_id !== $user->id) {
            abort(403);
        }
    }
}
