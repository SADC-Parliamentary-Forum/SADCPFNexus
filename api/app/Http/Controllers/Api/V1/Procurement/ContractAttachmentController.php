<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\Contract;
use App\Modules\Documents\Services\ModuleDocumentBridge;
use Illuminate\Http\JsonResponse;
use App\Support\UploadContentSniffer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ContractAttachmentController extends Controller
{
    public function __construct(private readonly ModuleDocumentBridge $bridge) {}

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
        UploadContentSniffer::assertAllowed($file);
        $attachment = $this->bridge->storeAttachment($request->user(), $contract, $file, [
            'document_type' => $request->input('document_type', Attachment::DOCUMENT_TYPE_SIGNED_CONTRACT),
            'module' => 'procurement',
        ]);
        return response()->json(['message' => 'Attachment uploaded.', 'data' => $attachment], 201);
    }

    public function destroy(Request $request, Contract $contract, Attachment $attachment): JsonResponse
    {
        $this->ensureCanAccess($request, $contract);
        if ($attachment->attachable_type !== Contract::class || (int) $attachment->attachable_id !== (int) $contract->id) {
            abort(404);
        }
        $this->bridge->unlinkAttachment($request->user(), $attachment);
        return response()->json(['message' => 'Attachment unlinked.']);
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