<?php

namespace App\Http\Controllers\Api\V1\Programmes;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\Programme;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProgrammeAttachmentController extends Controller
{
    public function index(Programme $programme): JsonResponse
    {
        $this->ensureProgrammeTenant($programme);
        $attachments = $programme->attachments()->with('uploader:id,name')->orderByDesc('created_at')->get();
        return response()->json(['data' => $attachments]);
    }

    public function store(Request $request, Programme $programme): JsonResponse
    {
        $this->ensureProgrammeTenant($programme);
        $request->validate([
            'file'          => ['required', 'file', 'max:25600'], // 25 MB
            'document_type' => ['required', 'string', 'in:' . implode(',', Attachment::DOCUMENT_TYPES)],
        ]);
        $file = $request->file('file');
        $path = $file->store(
            'attachments/programmes/' . $programme->id,
            ['disk' => 'local']
        );
        $attachment = $programme->attachments()->create([
            'tenant_id'         => $programme->tenant_id,
            'uploaded_by'       => $request->user()->id,
            'document_type'     => $request->input('document_type'),
            'original_filename' => $file->getClientOriginalName(),
            'storage_path'      => $path,
            'mime_type'         => $file->getMimeType(),
            'size_bytes'        => $file->getSize(),
        ]);
        $attachment->load('uploader:id,name');
        return response()->json(['message' => 'Attachment uploaded.', 'data' => $attachment], 201);
    }

    public function update(Request $request, Programme $programme, Attachment $attachment): JsonResponse
    {
        $this->ensureProgrammeTenant($programme);
        if ($attachment->attachable_type !== Programme::class || (int) $attachment->attachable_id !== (int) $programme->id) {
            abort(404);
        }
        if (! \in_array($attachment->document_type, Attachment::QUOTE_DOCUMENT_TYPES, true)) {
            return response()->json(['message' => 'Only quote-type attachments can be marked as chosen.'], 422);
        }
        $request->validate([
            'is_chosen_quote'  => ['sometimes', 'boolean'],
            'selection_reason' => ['nullable', 'string', 'max:2000'],
        ]);
        $attachment->update($request->only(['is_chosen_quote', 'selection_reason']));
        $attachment->load('uploader:id,name');
        return response()->json(['message' => 'Attachment updated.', 'data' => $attachment]);
    }

    public function destroy(Programme $programme, Attachment $attachment): JsonResponse
    {
        $this->ensureProgrammeTenant($programme);
        if ($attachment->attachable_type !== Programme::class || (int) $attachment->attachable_id !== (int) $programme->id) {
            abort(404);
        }
        if ($attachment->storage_path && Storage::disk('local')->exists($attachment->storage_path)) {
            Storage::disk('local')->delete($attachment->storage_path);
        }
        $attachment->delete();
        return response()->json(['message' => 'Attachment deleted.']);
    }

    public function download(Programme $programme, Attachment $attachment): StreamedResponse|JsonResponse
    {
        $this->ensureProgrammeTenant($programme);
        if ($attachment->attachable_type !== Programme::class || (int) $attachment->attachable_id !== (int) $programme->id) {
            abort(404);
        }
        if (!$attachment->storage_path || !Storage::disk('local')->exists($attachment->storage_path)) {
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

    private function ensureProgrammeTenant(Programme $programme): void
    {
        $user = request()->user();
        if ($programme->tenant_id !== $user->tenant_id) {
            abort(404);
        }
    }
}
