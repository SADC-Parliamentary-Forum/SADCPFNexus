<?php

namespace App\Modules\Procurement\Support\Ocr;

use App\Modules\Procurement\Support\OcrUnconfiguredAdapter;
use App\Support\Utf8;
use Illuminate\Support\Facades\Process;

/**
 * Runs Tesseract on image bytes or rasterized PDF pages. Never invents text.
 */
final class TesseractOcrEngine implements OcrEngine
{
    public function __construct(
        private readonly string $tesseractBin = 'tesseract',
        private readonly string $pdftoppmBin = 'pdftoppm',
        private readonly string $languages = 'eng+fra+por',
        private readonly int $maxPages = 4,
        private readonly int $timeoutSeconds = 60,
    ) {}

    public static function fromConfig(): self
    {
        return new self(
            (string) config('procurement.ocr_tesseract_bin', 'tesseract'),
            (string) config('procurement.ocr_pdftoppm_bin', 'pdftoppm'),
            (string) config('procurement.ocr_languages', 'eng+fra+por'),
            (int) config('procurement.ocr_max_pages', 4),
            (int) config('procurement.ocr_timeout_seconds', 60),
        );
    }

    public function isAvailable(): bool
    {
        return $this->binaryExists($this->tesseractBin);
    }

    public function recognize(string $bytes, string $mime, string $filename = ''): array
    {
        if (! $this->isAvailable() || $bytes === '') {
            return [
                'text' => '',
                'method' => OcrUnconfiguredAdapter::METHOD,
                'ocr_available' => false,
                'message' => 'Image OCR is not available (Tesseract is not installed). Upload a PDF or DOCX with selectable text, or classify this file manually.',
            ];
        }

        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        $isPdf = $mime === 'application/pdf' || $ext === 'pdf' || str_starts_with($bytes, '%PDF');
        $text = $isPdf ? $this->ocrPdf($bytes) : $this->ocrImage($bytes, $ext !== '' ? $ext : 'png');
        $text = Utf8::string(trim($text));
        $method = $isPdf ? 'pdf_ocr' : 'image_ocr';

        if ($text === '') {
            return [
                'text' => '',
                'method' => $isPdf ? 'pdf_no_text' : 'ocr_empty',
                'ocr_available' => true,
                'message' => 'OCR ran but found no readable text. Classify the document manually.',
            ];
        }

        return [
            'text' => $text,
            'method' => $method,
            'ocr_available' => true,
            'message' => 'Text extracted with Tesseract OCR. Review fields before confirming.',
        ];
    }

    private function ocrPdf(string $bytes): string
    {
        if (! $this->binaryExists($this->pdftoppmBin)) {
            return '';
        }
        $dir = sys_get_temp_dir().'/ocr-'.bin2hex(random_bytes(8));
        if (! @mkdir($dir, 0700) && ! is_dir($dir)) {
            return '';
        }
        $pdf = $dir.'/in.pdf';
        $prefix = $dir.'/page';
        file_put_contents($pdf, $bytes);
        try {
            $raster = Process::timeout($this->timeoutSeconds)->run([
                $this->pdftoppmBin, '-png', '-f', '1', '-l', (string) $this->maxPages, '-r', '200', $pdf, $prefix,
            ]);
            if (! $raster->successful()) {
                return '';
            }
            $pages = glob($prefix.'*.png') ?: [];
            sort($pages);
            $chunks = [];
            foreach ($pages as $page) {
                $chunks[] = $this->runTesseract($page);
            }

            return trim(implode("\n", array_filter($chunks)));
        } finally {
            foreach (glob($dir.'/*') ?: [] as $file) {
                @unlink($file);
            }
            @rmdir($dir);
        }
    }

    private function ocrImage(string $bytes, string $ext): string
    {
        $ext = preg_replace('/[^a-z0-9]/', '', $ext) ?: 'png';
        $path = sys_get_temp_dir().'/ocr-'.bin2hex(random_bytes(8)).'.'.$ext;
        file_put_contents($path, $bytes);
        try {
            return $this->runTesseract($path);
        } finally {
            @unlink($path);
        }
    }

    private function runTesseract(string $imagePath): string
    {
        $result = Process::timeout($this->timeoutSeconds)->run([
            $this->tesseractBin, $imagePath, 'stdout', '-l', $this->languages, '--psm', '6',
        ]);
        if (! $result->successful()) {
            return '';
        }

        return Utf8::string(trim($result->output()));
    }

    private function binaryExists(string $bin): bool
    {
        if ($bin === '') {
            return false;
        }
        if (is_file($bin) && is_executable($bin)) {
            return true;
        }
        $which = Process::timeout(5)->run(['which', $bin]);

        return $which->successful() && trim($which->output()) !== '';
    }
}
