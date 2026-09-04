<?php

namespace App\Modules\Procurement\Support;

/**
 * Pulls visible text from PDF content streams and DOCX XML without executing the file.
 */
final class DocumentTextExtractor
{
    public function extract(string $contents, string $mime, string $filename = ''): array
    {
        $mime = strtolower($mime);
        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

        if ($mime === 'application/pdf' || $ext === 'pdf' || str_starts_with($contents, '%PDF')) {
            return ['text' => $this->fromPdf($contents), 'method' => 'pdf_text'];
        }

        if (
            $mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            || $ext === 'docx'
        ) {
            return ['text' => $this->fromDocx($contents), 'method' => 'docx_xml'];
        }

        if (str_starts_with($mime, 'image/') || in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'], true)) {
            return [
                'text' => '',
                'method' => 'ocr_unconfigured',
                'ocr_available' => false,
                'message' => 'Image OCR is not configured. Classify and extract this document manually.',
            ];
        }

        if (str_starts_with($mime, 'text/') || $ext === 'txt') {
            return ['text' => $contents, 'method' => 'plain_text'];
        }

        return ['text' => '', 'method' => 'unsupported'];
    }

    public function fromPdf(string $contents): string
    {
        $texts = [];
        if (preg_match_all('/\\((?:\\\\.|[^\\\\)])*\\)\\s*Tj/s', $contents, $matches)) {
            foreach ($matches[0] as $token) {
                if (preg_match('/^\\((.*)\\)\\s*Tj$/s', $token, $inner)) {
                    $texts[] = $this->unescapePdf($inner[1]);
                }
            }
        }
        if (preg_match_all('/\\[(.*?)\\]\\s*TJ/s', $contents, $tj)) {
            foreach ($tj[1] as $array) {
                if (preg_match_all('/\\((?:\\\\.|[^\\\\)])*\\)/s', $array, $parts)) {
                    foreach ($parts[0] as $part) {
                        $texts[] = $this->unescapePdf(substr($part, 1, -1));
                    }
                }
            }
        }

        $joined = trim(preg_replace('/[ \\t]+/', ' ', implode("\n", $texts)) ?? '');
        if ($joined !== '') {
            return $joined;
        }

        // Fallback: printable runs (uncompressed PDFs / test fixtures).
        $stripped = preg_replace('/[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F]/', ' ', $contents) ?? '';
        $stripped = preg_replace('/\\s+/', ' ', $stripped) ?? '';

        return trim($stripped);
    }

    public function fromDocx(string $contents): string
    {
        $tmp = tempnam(sys_get_temp_dir(), 'docx');
        if ($tmp === false) {
            return '';
        }
        file_put_contents($tmp, $contents);
        $zip = new \ZipArchive();
        if ($zip->open($tmp) !== true) {
            @unlink($tmp);

            return '';
        }
        $xml = $zip->getFromName('word/document.xml') ?: '';
        $zip->close();
        @unlink($tmp);
        $xml = preg_replace('/<w:p[^>]*>/', "\n", $xml) ?? $xml;
        $text = strip_tags(str_replace('</w:t>', ' ', $xml));

        return trim(html_entity_decode($text, ENT_QUOTES | ENT_XML1, 'UTF-8'));
    }

    private function unescapePdf(string $value): string
    {
        $value = str_replace(['\\n', '\\r', '\\t', '\\(', '\\)', '\\\\'], ["\n", "\r", "\t", '(', ')', '\\'], $value);

        return $value;
    }
}
