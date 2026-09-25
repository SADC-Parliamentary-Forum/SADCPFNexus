<?php

namespace App\Modules\Hr\Import\Support;

use App\Modules\Procurement\Support\DocumentTextExtractor;
use Symfony\Component\Process\Process;

final class VipPdfTextExtractor
{
    public function __construct(
        private readonly DocumentTextExtractor $fallback = new DocumentTextExtractor,
    ) {}

    /** Layout-preserving text (preferred for Sage VIP DevExpress exports). */
    public function layoutTextFromPath(string $path): string
    {
        if (! is_readable($path)) {
            return '';
        }

        $process = new Process(['pdftotext', '-layout', $path, '-']);
        $process->setTimeout(120);
        $process->run();

        if ($process->isSuccessful() && trim($process->getOutput()) !== '') {
            return $process->getOutput();
        }

        $contents = file_get_contents($path);
        if ($contents === false) {
            return '';
        }

        $extracted = $this->fallback->extract($contents, 'application/pdf', basename($path));

        return (string) ($extracted['text'] ?? '');
    }

    public function layoutTextFromString(string $contents): string
    {
        $tmp = tempnam(sys_get_temp_dir(), 'vip-pdf-');
        if ($tmp === false) {
            return '';
        }
        file_put_contents($tmp, $contents);
        $text = $this->layoutTextFromPath($tmp);
        @unlink($tmp);

        return $text;
    }
}
