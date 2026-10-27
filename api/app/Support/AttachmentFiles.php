<?php

namespace App\Support;

use App\Models\Attachment;
use Closure;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

/**
 * Storage/transfer primitives shared by module attachment controllers.
 * Authorization and lifecycle rules stay in each module's controller; this
 * class only guarantees that the stored file and its database row never
 * drift apart.
 */
final class AttachmentFiles
{
    /**
     * Store the upload, then create its row via $createRow($path). If the row
     * cannot be written the stored file is removed, so a failed upload never
     * leaves an orphan file behind.
     *
     * @template T of Model
     *
     * @param  Closure(string): T  $createRow
     * @return T
     */
    public static function store(UploadedFile $file, string $directory, Closure $createRow, string $disk = 'local'): Model
    {
        $path = $file->store($directory, ['disk' => $disk]);
        if (! is_string($path) || $path === '') {
            throw new RuntimeException('The uploaded file could not be stored.');
        }

        try {
            return DB::transaction(fn () => $createRow($path));
        } catch (Throwable $e) {
            Storage::disk($disk)->delete($path);
            throw $e;
        }
    }

    /**
     * Delete the row first; remove the file only once that delete has
     * committed. If removing the file fails, the result is an orphan file
     * (logged for cleanup) — never a row that points at a missing file.
     */
    public static function delete(Attachment $attachment, string $disk = 'local'): void
    {
        $path = $attachment->storage_path;

        DB::transaction(function () use ($attachment, $path, $disk) {
            $attachment->delete();

            if ($path) {
                DB::afterCommit(function () use ($path, $disk, $attachment) {
                    try {
                        Storage::disk($disk)->delete($path);
                    } catch (Throwable $e) {
                        Log::warning('attachment.orphan_file', [
                            'attachment_id' => $attachment->getKey(),
                            'disk' => $disk,
                            'path' => $path,
                            'error' => $e->getMessage(),
                        ]);
                    }
                });
            }
        });
    }

    /** Stream a stored attachment, or a 404 JSON response when the file is missing. */
    public static function download(Attachment $attachment, string $disk = 'local'): StreamedResponse|JsonResponse
    {
        if (! $attachment->storage_path || ! Storage::disk($disk)->exists($attachment->storage_path)) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        return response()->streamDownload(
            function () use ($attachment, $disk) {
                $stream = Storage::disk($disk)->readStream($attachment->storage_path);
                if (is_resource($stream)) {
                    fpassthru($stream);
                    fclose($stream);
                }
            },
            $attachment->original_filename,
            ['Content-Type' => $attachment->mime_type ?: 'application/octet-stream']
        );
    }
}
