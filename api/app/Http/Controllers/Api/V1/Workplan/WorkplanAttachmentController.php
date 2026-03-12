<?php

namespace App\Http\Controllers\Api\V1\Workplan;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\WorkplanEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class WorkplanAttachmentController extends Controller
{
    public function index(WorkplanEvent $event): JsonResponse
    {
        $this->ensureEventTenant($event);
        $attachments = $event->attachments()->with('uploader:id,name')->orderByDesc('created_at')->get();
        return response()->json(['data' => $attachments]);
    }

    public function store(Request $request, WorkplanEvent $event): JsonResponse
    {
        $this->ensureEventTenant($event);
        $request->validate([
            'file'          => ['required', 'file', 'max:25600'], // 25 MB
            'document_type' => ['nullable', 'string', 'in:' . implode(',', Attachment::WORKPLAN_DOCUMENT_TYPES)],
        ]);
        $file = $request->file('file');
        $path = $file->store(
            'attachments/workplan_events/' . $event->id,
            ['disk' => 'local']
        );
        $attachment = $event->attachments()->create([
            'tenant_id'         => $event->tenant_id,
            'uploaded_by'       => $request->user()->id,
            'document_type'     => $request->input('document_type', Attachment::DOCUMENT_TYPE_WORKPLAN),
            'original_filename' => $file->getClientOriginalName(),
            'storage_path'      => $path,
            'mime_type'         => $file->getMimeType(),
            'size_bytes'        => $file->getSize(),
        ]);
        $attachment->load('uploader:id,name');
        return response()->json(['message' => 'Attachment uploaded.', 'data' => $attachment], 201);
    }

    public function destroy(WorkplanEvent $event, Attachment $attachment): JsonResponse
    {
        $this->ensureEventTenant($event);
        if ($attachment->attachable_type !== WorkplanEvent::class || (int) $attachment->attachable_id !== (int) $event->id) {
            abort(404);
        }
        if ($attachment->storage_path && Storage::disk('local')->exists($attachment->storage_path)) {
            Storage::disk('local')->delete($attachment->storage_path);
        }
        $attachment->delete();
        return response()->json(['message' => 'Attachment deleted.']);
    }

    public function download(WorkplanEvent $event, Attachment $attachment): StreamedResponse|JsonResponse
    {
        $this->ensureEventTenant($event);
        if ($attachment->attachable_type !== WorkplanEvent::class || (int) $attachment->attachable_id !== (int) $event->id) {
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
            [
                'Content-Type' => $attachment->mime_type ?: 'application/octet-stream',
            ]
        );
    }

    private function ensureEventTenant(WorkplanEvent $event): void
    {
        $user = request()->user();
        if ((int) $event->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
    }
}
