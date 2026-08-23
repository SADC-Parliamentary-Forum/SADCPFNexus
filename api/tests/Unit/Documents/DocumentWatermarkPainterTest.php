<?php

namespace Tests\Unit\Documents;

use App\Modules\Documents\Services\DocumentWatermarkPainter;
use PHPUnit\Framework\TestCase;

class DocumentWatermarkPainterTest extends TestCase
{
    public function test_stamps_visible_text_into_an_uncompressed_pdf(): void
    {
        $pdf = $this->minimalPdf('Hello');
        $out = (new DocumentWatermarkPainter)->apply($pdf, 'application/pdf', 'SADC-PF-NEXUS-WATERMARK');

        $this->assertNotSame($pdf, $out);
        $this->assertStringContainsString('%PDF', $out);
        $this->assertStringContainsString('SADC-PF-NEXUS-WATERMARK', $out);
    }

    public function test_stamps_png_bytes_so_the_raster_changes(): void
    {
        if (! function_exists('imagecreatetruecolor')) {
            $this->markTestSkipped('GD is required for image watermarks.');
        }

        $im = imagecreatetruecolor(80, 40);
        $white = imagecolorallocate($im, 255, 255, 255);
        imagefilledrectangle($im, 0, 0, 80, 40, $white);
        ob_start();
        imagepng($im);
        $png = (string) ob_get_clean();
        imagedestroy($im);

        $out = (new DocumentWatermarkPainter)->apply($png, 'image/png', 'SADC-PF-NEXUS-WATERMARK');

        $this->assertNotSame($png, $out);
        $this->assertSame("\x89PNG", substr($out, 0, 4));
    }

    public function test_stamps_visible_text_into_a_flate_encoded_pdf(): void
    {
        $pdf = $this->flatePdf('Hello');
        $this->assertStringContainsString('/FlateDecode', $pdf);
        $this->assertStringNotContainsString('SADC-PF-NEXUS-WATERMARK', $pdf);

        $out = (new DocumentWatermarkPainter)->apply($pdf, 'application/pdf', 'SADC-PF-NEXUS-WATERMARK');

        $this->assertNotSame($pdf, $out);
        $this->assertStringContainsString('%PDF', $out);
        $this->assertTrue(
            preg_match('/stream\r?\n(.*)\nendstream/s', $out, $m) === 1,
            'stamped PDF must still contain a content stream'
        );
        $plain = @gzuncompress(rtrim($m[1], "\r\n"));
        $this->assertNotFalse($plain);
        $this->assertStringContainsString('SADC-PF-NEXUS-WATERMARK', (string) $plain);
        $this->assertStringContainsString('Hello', (string) $plain);
    }

    private function flatePdf(string $text): string
    {
        $escaped = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $text);
        $plain = "BT /F1 12 Tf 72 720 Td ({$escaped}) Tj ET";
        $stream = gzcompress($plain);
        $len = strlen($stream);

        return "%PDF-1.4\n".
            "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n".
            "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n".
            "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n".
            "4 0 obj<< /Length {$len} /Filter /FlateDecode >>stream\n{$stream}\nendstream\nendobj\n".
            "5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n".
            "trailer<< /Root 1 0 R >>\n%%EOF\n";
    }

    private function minimalPdf(string $text): string
    {
        $escaped = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $text);
        $stream = "BT /F1 12 Tf 72 720 Td ({$escaped}) Tj ET";
        $len = strlen($stream);

        return "%PDF-1.4\n".
            "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n".
            "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n".
            "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n".
            "4 0 obj<< /Length {$len} >>stream\n{$stream}\nendstream\nendobj\n".
            "5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n".
            "trailer<< /Root 1 0 R >>\n%%EOF\n";
    }
}
