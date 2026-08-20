<?php

namespace App\Modules\Documents\Services;

/**
 * Paints a visible watermark onto download bytes.
 * Uncompressed PDFs get a text operator injected into the first content stream.
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
        if (preg_match('/\/Filter\b/', substr($prefix, max(0, strlen($prefix) - 500))) === 1) {
            // Compressed content streams cannot take a raw text operator.
            return $bytes;
        }

        return $prefix.$operator.substr($bytes, $insertAt);
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
