<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;

/**
 * Detect MIME from file bytes (finfo) and reject uploads that do not match an allow-list.
 * Client-reported Content-Type alone is not trusted.
 */
final class UploadContentSniffer
{
    /** @var list<string> */
    public const SAFE_DOCUMENT_MIMES = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.oasis.opendocument.text',
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'text/plain',
        'text/csv',
        'application/csv',
    ];

    /**
     * @param  list<string>|null  $allowedMimes
     * @return string Detected MIME type
     */
    public static function assertAllowed(UploadedFile $file, ?array $allowedMimes = null): string
    {
        $allowed = array_map('strtolower', $allowedMimes ?? self::SAFE_DOCUMENT_MIMES);
        $detected = self::detect($file);

        if (! in_array($detected, $allowed, true)) {
            throw ValidationException::withMessages([
                'file' => ['The uploaded file type is not allowed.'],
            ]);
        }

        return $detected;
    }

    public static function detect(UploadedFile $file): string
    {
        $path = $file->getRealPath();
        if (is_string($path) && $path !== '' && is_readable($path)) {
            $finfo = new \finfo(FILEINFO_MIME_TYPE);
            $mime = $finfo->file($path);
            if (is_string($mime) && $mime !== '') {
                return strtolower($mime);
            }
        }

        $fallback = $file->getMimeType();

        return is_string($fallback) && $fallback !== ''
            ? strtolower($fallback)
            : 'application/octet-stream';
    }
}
