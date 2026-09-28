<?php

namespace App\Http\Controllers\Api\V1\Hr;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Lets a system administrator stage the real Sage VIP source files (PII,
 * banking data) for hr:dry-run-migration WITHOUT SSH access — upload
 * through the already-authenticated admin web app instead. Files land on
 * local disk at storage/app/hr-vip-dry-run-source/ (gitignored, never
 * touches git or GitHub's infrastructure) where the dry-run CI workflow's
 * SSH session reads them directly from the server.
 *
 * System-admin only, no lesser permission accepted — this handles the same
 * class of sensitive source data as the historical migration itself.
 */
class HrDryRunSourceController extends Controller
{
    private const DISK = 'local';

    private const DIR = 'hr-vip-dry-run-source';

    private const ALLOWED_EXT = ['pdf', 'xls', 'xlsx'];

    public function index(Request $request): JsonResponse
    {
        $this->assertSystemAdmin($request);

        $files = collect(Storage::disk(self::DISK)->files(self::DIR))
            ->map(fn (string $path) => [
                'name' => basename($path),
                'size_bytes' => Storage::disk(self::DISK)->size($path),
                'uploaded_at' => date('c', Storage::disk(self::DISK)->lastModified($path)),
            ])
            ->values();

        return response()->json(['data' => $files]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->assertSystemAdmin($request);

        $data = $request->validate([
            'files' => ['required', 'array', 'min:1'],
            'files.*' => ['required', 'file', 'max:51200'], // 50MB each
        ]);

        $stored = [];
        $rejected = [];
        foreach ($data['files'] as $file) {
            $ext = strtolower($file->getClientOriginalExtension());
            if (! in_array($ext, self::ALLOWED_EXT, true)) {
                $rejected[] = $file->getClientOriginalName().' (only PDF/XLS/XLSX are accepted)';
                continue;
            }
            $safeName = basename($file->getClientOriginalName());
            $file->storeAs(self::DIR, $safeName, self::DISK);
            $stored[] = $safeName;
        }

        return response()->json([
            'message' => count($stored).' file(s) staged, '.count($rejected).' rejected.',
            'data' => ['stored' => $stored, 'rejected' => $rejected],
        ], 201);
    }

    public function destroy(Request $request, string $filename): JsonResponse
    {
        $this->assertSystemAdmin($request);

        $safeName = basename(urldecode($filename));
        $path = self::DIR.'/'.$safeName;
        if (! Storage::disk(self::DISK)->exists($path)) {
            throw ValidationException::withMessages(['file' => ['Not found.']]);
        }
        Storage::disk(self::DISK)->delete($path);

        return response()->json(['message' => "{$safeName} removed."]);
    }

    /** Delete every staged file — use once the dry-run has been run and the files are no longer needed. */
    public function clear(Request $request): JsonResponse
    {
        $this->assertSystemAdmin($request);

        $count = collect(Storage::disk(self::DISK)->files(self::DIR))->count();
        Storage::disk(self::DISK)->deleteDirectory(self::DIR);

        return response()->json(['message' => "{$count} file(s) removed."]);
    }

    private function assertSystemAdmin(Request $request): void
    {
        abort_unless($request->user()?->isSystemAdmin(), 403, 'System administrator access required.');
    }
}
