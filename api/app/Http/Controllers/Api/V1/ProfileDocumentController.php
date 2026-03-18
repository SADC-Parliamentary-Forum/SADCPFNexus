<?php
namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProfileDocumentController extends Controller
{
    /** List documents for the authenticated user's own profile */
    public function index(Request $request): JsonResponse
    {
        $docs = $request->user()
            ->morphMany(Attachment::class, 'attachable')
            ->whereIn('document_type', Attachment::PROFILE_DOCUMENT_TYPES)
            ->with('uploader:id,name')
            ->orderByDesc('created_at')
            ->get();
        return response()->json(['data' => $docs]);
    }

    /** Upload a document for the authenticated user's own profile */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'file'          => ['required', 'file', 'max:20480', 'mimes:pdf,doc,docx,jpg,jpeg,png,gif'],
            'document_type' => ['required', 'string', 'in:' . implode(',', Attachment::PROFILE_DOCUMENT_TYPES)],
            'title'         => ['nullable', 'string', 'max:255'],
        ]);

        $user = $request->user();
        $file = $request->file('file');
        $path = $file->store('profile-documents/' . $user->id, ['disk' => 'local']);

        $attachment = $user->morphMany(Attachment::class, 'attachable')->create([
            'tenant_id'         => $user->tenant_id,
            'uploaded_by'       => $user->id,
            'document_type'     => $request->input('document_type'),
            'original_filename' => $request->input('title') ?: $file->getClientOriginalName(),
            'storage_path'      => $path,
            'mime_type'         => $file->getMimeType(),
            'size_bytes'        => $file->getSize(),
        ]);
        $attachment->load('uploader:id,name');
        return response()->json(['message' => 'Document uploaded.', 'data' => $attachment], 201);
    }

    /** Delete a document from authenticated user's profile */
    public function destroy(Request $request, Attachment $attachment): JsonResponse
    {
        $user = $request->user();
        if ($attachment->attachable_type !== User::class || (int)$attachment->attachable_id !== $user->id) {
            abort(403);
        }
        if ($attachment->storage_path && Storage::disk('local')->exists($attachment->storage_path)) {
            Storage::disk('local')->delete($attachment->storage_path);
        }
        $attachment->delete();
        return response()->json(['message' => 'Document deleted.']);
    }

    /** Download a document from authenticated user's profile */
    public function download(Request $request, Attachment $attachment): StreamedResponse|JsonResponse
    {
        $user = $request->user();
        if ($attachment->attachable_type !== User::class || (int)$attachment->attachable_id !== $user->id) {
            abort(403);
        }
        if (!$attachment->storage_path || !Storage::disk('local')->exists($attachment->storage_path)) {
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

    // ── Admin: manage any user's profile documents ──────────────────────────

    public function adminIndex(Request $request, User $user): JsonResponse
    {
        abort_unless(
            $request->user()->isSystemAdmin() || $request->user()->hasAnyRole(['HR Officer', 'HR Manager']),
            403
        );
        abort_unless($user->tenant_id === $request->user()->tenant_id, 403);

        $docs = $user->morphMany(Attachment::class, 'attachable')
            ->whereIn('document_type', Attachment::PROFILE_DOCUMENT_TYPES)
            ->with('uploader:id,name')
            ->orderByDesc('created_at')
            ->get();
        return response()->json(['data' => $docs]);
    }

    public function adminStore(Request $request, User $user): JsonResponse
    {
        abort_unless(
            $request->user()->isSystemAdmin() || $request->user()->hasAnyRole(['HR Officer', 'HR Manager']),
            403
        );
        abort_unless($user->tenant_id === $request->user()->tenant_id, 403);

        $request->validate([
            'file'          => ['required', 'file', 'max:20480', 'mimes:pdf,doc,docx,jpg,jpeg,png,gif'],
            'document_type' => ['required', 'string', 'in:' . implode(',', Attachment::PROFILE_DOCUMENT_TYPES)],
            'title'         => ['nullable', 'string', 'max:255'],
        ]);

        $file = $request->file('file');
        $path = $file->store('profile-documents/' . $user->id, ['disk' => 'local']);

        $attachment = $user->morphMany(Attachment::class, 'attachable')->create([
            'tenant_id'         => $user->tenant_id,
            'uploaded_by'       => $request->user()->id,
            'document_type'     => $request->input('document_type'),
            'original_filename' => $request->input('title') ?: $file->getClientOriginalName(),
            'storage_path'      => $path,
            'mime_type'         => $file->getMimeType(),
            'size_bytes'        => $file->getSize(),
        ]);
        $attachment->load('uploader:id,name');
        return response()->json(['message' => 'Document uploaded.', 'data' => $attachment], 201);
    }

    public function adminDestroy(Request $request, User $user, Attachment $attachment): JsonResponse
    {
        abort_unless(
            $request->user()->isSystemAdmin() || $request->user()->hasAnyRole(['HR Officer', 'HR Manager']),
            403
        );
        abort_unless($user->tenant_id === $request->user()->tenant_id, 403);
        if ($attachment->attachable_type !== User::class || (int)$attachment->attachable_id !== $user->id) {
            abort(404);
        }
        if ($attachment->storage_path && Storage::disk('local')->exists($attachment->storage_path)) {
            Storage::disk('local')->delete($attachment->storage_path);
        }
        $attachment->delete();
        return response()->json(['message' => 'Document deleted.']);
    }

    public function adminDownload(Request $request, User $user, Attachment $attachment): StreamedResponse|JsonResponse
    {
        abort_unless(
            $request->user()->isSystemAdmin() || $request->user()->hasAnyRole(['HR Officer', 'HR Manager']),
            403
        );
        abort_unless($user->tenant_id === $request->user()->tenant_id, 403);
        if ($attachment->attachable_type !== User::class || (int)$attachment->attachable_id !== $user->id) {
            abort(404);
        }
        if (!$attachment->storage_path || !Storage::disk('local')->exists($attachment->storage_path)) {
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
}
