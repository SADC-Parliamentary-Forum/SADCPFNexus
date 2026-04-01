<?php

namespace App\Http\Controllers\Api\V1\Governance;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\GovernanceResolution;
use App\Models\WorkplanEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class GovernanceController extends Controller
{
    private const ALLOWED_LANGUAGES = ['en', 'fr', 'pt'];

    // ── Meetings ──────────────────────────────────────────────────────────────

    public function meetings(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = WorkplanEvent::where('tenant_id', $user->tenant_id)
            ->where('type', 'meeting')
            ->orderBy('date');

        if ($status = $request->input('status')) {
            if ($status === 'upcoming') {
                $query->where('date', '>=', now()->toDateString());
            } elseif ($status === 'completed') {
                $query->where('date', '<', now()->toDateString());
            }
        }

        $perPage = min((int) $request->input('per_page', 50), 100);
        $events = $query->paginate($perPage);

        $data = $events->getCollection()->map(fn ($e) => [
            'id'          => $e->id,
            'title'       => $e->title,
            'date'        => $e->date?->format('Y-m-d'),
            'end_date'    => $e->end_date?->format('Y-m-d'),
            'description' => $e->description,
            'responsible' => $e->responsible,
            'venue'       => null,
            'type'        => 'meeting',
            'status'      => $e->date && $e->date->isPast() ? 'completed' : 'upcoming',
        ]);

        return response()->json([
            'data'         => $data,
            'current_page' => $events->currentPage(),
            'last_page'    => $events->lastPage(),
            'per_page'     => $events->perPage(),
            'total'        => $events->total(),
        ]);
    }

    // ── Resolutions ───────────────────────────────────────────────────────────

    public function resolutions(Request $request): JsonResponse
    {
        $query = GovernanceResolution::where('tenant_id', $request->user()->tenant_id)
            ->with(['documents:id,attachable_id,attachable_type,language,document_type,original_filename,mime_type,size_bytes,created_at'])
            ->orderByDesc('adopted_at')
            ->orderByDesc('created_at');

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        if ($type = $request->input('type')) {
            $query->where('type', $type);
        }

        $perPage = min((int) $request->input('per_page', 20), 100);
        $resolutions = $query->paginate($perPage);

        return response()->json($resolutions);
    }

    public function storeResolution(Request $request): JsonResponse
    {
        $data = $request->validate([
            'reference_number' => ['required', 'string', 'max:64'],
            'title'            => ['required', 'string', 'max:500'],
            'description'      => ['nullable', 'string', 'max:5000'],
            'status'           => ['nullable', 'string', 'in:Draft,Adopted,In Progress,Pending Review,Implemented,Rejected,Actioned'],
            'adopted_at'       => ['nullable', 'date'],
            'type'             => ['nullable', 'string', 'in:committee,plenary'],
            'committee'        => ['nullable', 'string', 'max:255'],
            'lead_member'      => ['nullable', 'string', 'max:255'],
            'lead_role'        => ['nullable', 'string', 'max:255'],
        ]);

        $resolution = GovernanceResolution::create([
            'tenant_id' => $request->user()->tenant_id,
            'status'    => 'Draft',
            ...$data,
        ]);

        return response()->json([
            'message' => 'Resolution created.',
            'data'    => $resolution->load('documents'),
        ], 201);
    }

    public function showResolution(Request $request, GovernanceResolution $resolution): JsonResponse
    {
        $resolution = GovernanceResolution::where('id', $resolution->id)
            ->where('tenant_id', $request->user()->tenant_id)
            ->firstOrFail();
        return response()->json(['data' => $resolution->load('documents')]);
    }

    public function updateResolution(Request $request, GovernanceResolution $resolution): JsonResponse
    {
        abort_unless((int) $resolution->tenant_id === (int) $request->user()->tenant_id, 404);

        $data = $request->validate([
            'reference_number' => ['sometimes', 'string', 'max:64'],
            'title'            => ['sometimes', 'string', 'max:500'],
            'description'      => ['nullable', 'string', 'max:5000'],
            'status'           => ['nullable', 'string', 'in:Draft,Adopted,In Progress,Pending Review,Implemented,Rejected,Actioned'],
            'adopted_at'       => ['nullable', 'date'],
            'type'             => ['nullable', 'string', 'in:committee,plenary'],
            'committee'        => ['nullable', 'string', 'max:255'],
            'lead_member'      => ['nullable', 'string', 'max:255'],
            'lead_role'        => ['nullable', 'string', 'max:255'],
        ]);

        $resolution->update($data);

        return response()->json([
            'message' => 'Resolution updated.',
            'data'    => $resolution->fresh('documents'),
        ]);
    }

    public function destroyResolution(Request $request, GovernanceResolution $resolution): JsonResponse
    {
        abort_unless((int) $resolution->tenant_id === (int) $request->user()->tenant_id, 404);

        // Delete stored files
        foreach ($resolution->documents as $doc) {
            if ($doc->storage_path && Storage::disk('local')->exists($doc->storage_path)) {
                Storage::disk('local')->delete($doc->storage_path);
            }
        }
        $resolution->documents()->delete();
        $resolution->delete();

        return response()->json(['message' => 'Resolution deleted.']);
    }

    // ── Resolution Documents (multilingual) ───────────────────────────────────

    public function uploadDocument(Request $request, GovernanceResolution $resolution): JsonResponse
    {
        abort_unless((int) $resolution->tenant_id === (int) $request->user()->tenant_id, 404);

        $request->validate([
            'file'     => ['required', 'file', 'mimes:pdf,doc,docx', 'max:20480'],
            'language' => ['required', 'string', 'in:' . implode(',', self::ALLOWED_LANGUAGES)],
            'title'    => ['nullable', 'string', 'max:255'],
        ]);

        $file = $request->file('file');
        $lang = $request->input('language');
        $path = $file->store('governance/resolutions/' . $resolution->id . '/' . $lang, ['disk' => 'local']);

        // Replace any existing document for this language
        $existing = $resolution->documents()->where('language', $lang)->first();
        if ($existing) {
            if ($existing->storage_path && Storage::disk('local')->exists($existing->storage_path)) {
                Storage::disk('local')->delete($existing->storage_path);
            }
            $existing->delete();
        }

        $attachment = $resolution->documents()->create([
            'tenant_id'         => $resolution->tenant_id,
            'uploaded_by'       => $request->user()->id,
            'document_type'     => 'governance_resolution',
            'language'          => $lang,
            'original_filename' => $request->input('title') ?: $file->getClientOriginalName(),
            'storage_path'      => $path,
            'mime_type'         => $file->getMimeType(),
            'size_bytes'        => $file->getSize(),
        ]);

        return response()->json(['message' => 'Document uploaded.', 'data' => $attachment], 201);
    }

    public function deleteDocument(Request $request, GovernanceResolution $resolution, Attachment $attachment): JsonResponse
    {
        abort_unless((int) $resolution->tenant_id === (int) $request->user()->tenant_id, 404);
        abort_unless((int) $attachment->attachable_id === (int) $resolution->id, 404);

        if ($attachment->storage_path && Storage::disk('local')->exists($attachment->storage_path)) {
            Storage::disk('local')->delete($attachment->storage_path);
        }
        $attachment->delete();

        return response()->json(['message' => 'Document deleted.']);
    }

    public function downloadDocument(Request $request, GovernanceResolution $resolution, Attachment $attachment): StreamedResponse|JsonResponse
    {
        abort_unless((int) $resolution->tenant_id === (int) $request->user()->tenant_id, 404);
        abort_unless((int) $attachment->attachable_id === (int) $resolution->id, 404);

        if (!$attachment->storage_path || !Storage::disk('local')->exists($attachment->storage_path)) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        return response()->streamDownload(function () use ($attachment) {
            $stream = Storage::disk('local')->readStream($attachment->storage_path);
            if (is_resource($stream)) {
                fpassthru($stream);
                fclose($stream);
            }
        }, $attachment->original_filename, [
            'Content-Type' => $attachment->mime_type ?: 'application/octet-stream',
        ]);
    }
}
