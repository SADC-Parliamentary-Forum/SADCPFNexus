<?php

namespace App\Modules\Documents\Services;

/**
 * Paints a visible watermark onto download bytes.
 * Uncompressed PDFs get a text operator injected into the first content stream.
 * FlateDecode streams are inflated, stamped, and recompressed.
 * Raster images are stamped with GD. Other binaries are returned unchanged
 * (headers still mark the download as watermarked).
 */
class DocumentWatermarkPainter
{
    public function apply(string $bytes, string $mime, string $stamp): string
    {
        $mime = strtolower($mime);

        if (str_contains($mime, 'text/') || str_contains($mime, 'json')) {
            return "/* --- WATERMARK BANNER: {$stamp} --- */\n".$bytes;
        }

        if (str_contains($mime, 'pdf') || str_starts_with($bytes, '%PDF')) {
            return $this->stampPdf($bytes, $stamp);
        }

        if (str_contains($mime, 'png') || str_contains($mime, 'jpeg') || str_contains($mime, 'jpg')) {
            return $this->stampRaster($bytes, $stamp);
        }

        return $bytes;
    }

    private function stampPdf(string $bytes, string $stamp): string
    {
        $escaped = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $stamp);
        $operator = "BT /F1 18 Tf 0.65 g 72 96 Td ({$escaped}) Tj ET\n";

        if (preg_match('/stream\r?\n/', $bytes, $match, PREG_OFFSET_CAPTURE) !== 1) {
            return $bytes;
        }

        $insertAt = (int) $match[0][1] + strlen($match[0][0]);
        $prefix = substr($bytes, 0, $insertAt);
        $dictWindow = substr($prefix, max(0, strlen($prefix) - 500));

        if (preg_match('/\/Filter\s*\/FlateDecode/', $dictWindow) === 1) {
            return $this->stampFlateStream($bytes, $insertAt, $operator) ?? $bytes;
        }

        if (preg_match('/\/Filter\b/', $dictWindow) === 1) {
            return $bytes;
        }

        return $prefix.$operator.substr($bytes, $insertAt);
    }

    /**
     * Inflate a FlateDecode content stream, inject a visible text operator, and
     * rewrite /Length so compressed PDFs are not a silent passthrough.
     */
    private function stampFlateStream(string $bytes, int $streamStart, string $operator): ?string
    {
        $endPos = strpos($bytes, 'endstream', $streamStart);
        if ($endPos === false) {
            return null;
        }

        $compressed = substr($bytes, $streamStart, $endPos - $streamStart);
        $compressed = rtrim($compressed, "\r\n");
        $plain = @gzuncompress($compressed);
        if ($plain === false) {
            $plain = @gzinflate($compressed);
        }
        if ($plain === false) {
            return null;
        }

        $recompressed = gzcompress($operator.$plain);
        if ($recompressed === false) {
            return null;
        }

        $newLen = strlen($recompressed);
        $dictStart = strrpos(substr($bytes, 0, $streamStart), '<<');
        if ($dictStart === false) {
            return null;
        }

        $objectHead = substr($bytes, $dictStart, $streamStart - $dictStart);
        $objectHead = preg_replace('/\/Length\s+\d+/', '/Length '.$newLen, $objectHead, 1);
        if (! is_string($objectHead)) {
            return null;
        }

        return substr($bytes, 0, $dictStart).$objectHead.$recompressed."\n".substr($bytes, $endPos);
    }

    private function stampRaster(string $bytes, string $stamp): string
    {
        if (! function_exists('imagecreatefromstring')) {
            return $bytes;
        }

        $im = @imagecreatefromstring($bytes);
        if ($im === false) {
            return $bytes;
        }

        $width = imagesx($im);
        $height = imagesy($im);
        $gray = imagecolorallocatealpha($im, 80, 80, 80, 70);
        if ($gray === false) {
            $gray = imagecolorallocate($im, 120, 120, 120);
        }
        imagestring($im, 5, max(4, (int) ($width * 0.08)), max(4, (int) ($height * 0.45)), $stamp, $gray);

        ob_start();
        imagepng($im);
        $out = (string) ob_get_clean();
        imagedestroy($im);

        return $out !== '' ? $out : $bytes;
    }
}
