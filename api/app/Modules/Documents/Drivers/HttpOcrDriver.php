<?php

namespace App\Modules\Documents\Drivers;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Posts document bytes to DOCUMENT_OCR_HTTP_URL.
 * Expects JSON { "text": "...", "status": "complete" }.
 */
class HttpOcrDriver
{
    public function extract(string $disk, string $storagePath, string $filename = 'document.bin'): array
    {
        $url = trim((string) config('documents.http_ocr.url', ''));
        if ($url === '') {
            return ['ok' => false, 'text' => '', 'error' => 'DOCUMENT_OCR_HTTP_URL is not configured.'];
        }

        try {
            $bytes = Storage::disk($disk)->get($storagePath);
        } catch (\Throwable) {
            $bytes = null;
        }
        if ($bytes === null || $bytes === '') {
            return ['ok' => false, 'text' => '', 'error' => 'Unable to read file for OCR.'];
        }

        try {
            $request = Http::timeout((int) config('documents.http_ocr.timeout', 30))->asMultipart();
            $token = (string) config('documents.http_ocr.token', '');
            if ($token !== '') {
                $request = $request->withToken($token);
            }
            $response = $request->attach('file', $bytes, $filename)->post($url);
            if (! $response->successful()) {
                return ['ok' => false, 'text' => '', 'error' => 'OCR HTTP '.$response->status()];
            }
            $json = $response->json() ?? [];

            return [
                'ok' => true,
                'text' => (string) ($json['text'] ?? $json['extracted_text'] ?? ''),
                'error' => null,
            ];
        } catch (\Throwable $e) {
            Log::warning('documents.ocr_http_failed', ['message' => $e->getMessage()]);

            return ['ok' => false, 'text' => '', 'error' => $e->getMessage()];
        }
    }
}
