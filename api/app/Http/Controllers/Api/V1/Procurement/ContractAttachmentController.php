<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\Contract;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ContractAttachmentController extends Controller
{
    public function index(Request $request, Contract $contract): JsonResponse
    {
        $this->ensureCanAccess($request, $contract);
        $attachments = $contract->attachments()->with('uploader:id,name')->get();
        return response()->json(['data' => $attachments]);
    }

    public function store(Request $request, Contract $contract): JsonResponse
    {
        $this->ensureCanAccess($request, $contract);
        $request->validate([
            'file'          => ['required', 'file', 'max:25600'],
            'document_type' => ['nullable', 'string', 'in:' . implode(',', Attachment::CONTRACT_DOCUMENT_TYPES)],
        ]);
        $file = $request->file('file');
        $path = $file->store('attachments/contracts/' . $contract->id, ['disk' => 'local']);
        $attachment = $contract->attachments()->create([
            'tenant_id'         => $contract->tenant_id,
            'uploaded_by'       => $request->user()->id,
            'document_type'     => $request->input('document_type', Attachment::DOCUMENT_TYPE_SIGNED_CONTRACT),
            'original_filename' => $file->getClientOriginalName(),
            'storage_path'      => $path,
            'mime_type'         => $file->getMimeType(),
            'size_bytes'        => $file->getSize(),
        ]);
        $attachment->load('uploader:id,name');
        return response()->json(['message' => 'Attachment uploaded.', 'data' => $attachment], 201);
    }

    public function destroy(Request $request, Contract $contract, Attachment $attachment): JsonResponse
    {
        $this->ensureCanAccess($request, $contract);
        if ($attachment->attachable_type !== Contract::class || (int) $attachment->attachable_id !== (int) $contract->id) {
            abort(404);
        }
        if ($attachment->storage_path && Storage::disk('local')->exists($attachment->storage_path)) {
            Storage::disk('local')->delete($attachment->storage_path);
        }
        $attachment->delete();
        return response()->json(['message' => 'Attachment deleted.']);
    }

    public function download(Request $request, Contract $contract, Attachment $attachment): StreamedResponse|JsonResponse
    {
        $this->ensureCanAccess($request, $contract);
        if ($attachment->attachable_type !== Contract::class || (int) $attachment->attachable_id !== (int) $contract->id) {
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

    private function ensureCanAccess(Request $request, Contract $contract): void
    {
        if ($contract->tenant_id !== $request->user()->tenant_id) {
            abort(404);
        }
    }
}
