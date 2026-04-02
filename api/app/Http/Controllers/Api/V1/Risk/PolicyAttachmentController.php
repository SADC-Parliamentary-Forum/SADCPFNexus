<?php

namespace App\Http\Controllers\Api\V1\Risk;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\Policy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PolicyAttachmentController extends Controller
{
    public function index(Request $request, Policy $policy): JsonResponse
    {
        $this->ensureCanAccess($request, $policy);
        $attachments = $policy->attachments()->with('uploader:id,name')->orderByDesc('created_at')->get();
        return response()->json(['data' => $attachments]);
    }

    public function store(Request $request, Policy $policy): JsonResponse
    {
        $this->ensureCanAccess($request, $policy);
        $request->validate([
            'file'          => ['required', 'file', 'max:25600'], // 25 MB
            'document_type' => ['nullable', 'string', 'in:' . implode(',', Attachment::RISK_DOCUMENT_TYPES)],
        ]);
        $file = $request->file('file');
        $path = $file->store(
            'attachments/policies/' . $policy->id,
            ['disk' => 'local']
        );
        $attachment = $policy->attachments()->create([
            'tenant_id'         => $policy->tenant_id,
            'uploaded_by'       => $request->user()->id,
            'document_type'     => $request->input('document_type', Attachment::DOCUMENT_TYPE_RISK_POLICY),
            'original_filename' => $file->getClientOriginalName(),
            'storage_path'      => $path,
            'mime_type'         => $file->getMimeType(),
            'size_bytes'        => $file->getSize(),
        ]);
        $attachment->load('uploader:id,name');
        return response()->json(['message' => 'Attachment uploaded.', 'data' => $attachment], 201);
    }

    public function destroy(Request $request, Policy $policy, Attachment $attachment): JsonResponse
    {
        $this->ensureCanAccess($request, $policy);
        if ($attachment->attachable_type !== Policy::class || (int) $attachment->attachable_id !== (int) $policy->id) {
            abort(404);
        }
        if ($attachment->storage_path && Storage::disk('local')->exists($attachment->storage_path)) {
            Storage::disk('local')->delete($attachment->storage_path);
        }
        $attachment->delete();
        return response()->json(['message' => 'Attachment deleted.']);
    }

    public function download(Request $request, Policy $policy, Attachment $attachment): StreamedResponse|JsonResponse
    {
        $this->ensureCanAccess($request, $policy);
        if ($attachment->attachable_type !== Policy::class || (int) $attachment->attachable_id !== (int) $policy->id) {
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

    private function ensureCanAccess(Request $request, Policy $policy): void
    {
        if ($policy->tenant_id !== $request->user()->tenant_id) {
            abort(404);
        }
    }
}
