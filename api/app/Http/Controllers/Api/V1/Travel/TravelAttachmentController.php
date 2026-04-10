<?php

namespace App\Http\Controllers\Api\V1\Travel;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\TravelRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TravelAttachmentController extends Controller
{
    public function index(Request $request, TravelRequest $travelRequest): JsonResponse
    {
        $this->ensureCanView($request, $travelRequest);
        $attachments = $travelRequest->attachments()->with('uploader:id,name')->get();
        return response()->json(['data' => $attachments]);
    }

    public function store(Request $request, TravelRequest $travelRequest): JsonResponse
    {
        $this->ensureCanView($request, $travelRequest);
        $request->validate([
            'file'          => ['required', 'file', 'max:25600'], // 25 MB
            'document_type' => ['nullable', 'string', 'in:' . implode(',', Attachment::TRAVEL_DOCUMENT_TYPES)],
        ]);
        $file = $request->file('file');
        $path = $file->store(
            'attachments/travel/' . $travelRequest->id,
            ['disk' => 'local']
        );
        $attachment = $travelRequest->attachments()->create([
            'tenant_id'         => $travelRequest->tenant_id,
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

    public function destroy(Request $request, TravelRequest $travelRequest, Attachment $attachment): JsonResponse
    {
        $this->ensureCanView($request, $travelRequest);
        if ($attachment->attachable_type !== TravelRequest::class || (int) $attachment->attachable_id !== (int) $travelRequest->id) {
            abort(404);
        }
        if ($attachment->storage_path && Storage::disk('local')->exists($attachment->storage_path)) {
            Storage::disk('local')->delete($attachment->storage_path);
        }
        $attachment->delete();
        return response()->json(['message' => 'Attachment deleted.']);
    }

    public function download(Request $request, TravelRequest $travelRequest, Attachment $attachment): StreamedResponse|JsonResponse
    {
        $this->ensureCanView($request, $travelRequest);
        if ($attachment->attachable_type !== TravelRequest::class || (int) $attachment->attachable_id !== (int) $travelRequest->id) {
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

    private function ensureCanView(Request $request, TravelRequest $travelRequest): void
    {
        $user = $request->user();
        if ($travelRequest->tenant_id !== $user->tenant_id) {
            abort(404);
        }
        $isAdmin = $user->isSystemAdmin() || $user->hasPermissionTo('travel.admin') || $user->hasPermissionTo('travel.approve');
        if (! $isAdmin && $travelRequest->requester_id !== $user->id) {
            abort(403);
        }
    }
}
