<?php

namespace App\Modules\Procurement\Support;

use App\Support\Utf8;

/**
 * Pulls visible text from PDF content streams and DOCX XML without executing the file.
 */
final class DocumentTextExtractor
{
    public const METHOD_PDF_NO_TEXT = 'pdf_no_text';

    public function extract(string $contents, string $mime, string $filename = ''): array
    {
        $mime = strtolower($mime);
        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

        if ($mime === 'application/pdf' || $ext === 'pdf' || str_starts_with($contents, '%PDF')) {
            $text = Utf8::string($this->fromPdf($contents));
            if ($this->isUsablePdfText($text)) {
                return ['text' => $text, 'method' => 'pdf_text'];
            }

            return [
                'text' => '',
                'method' => self::METHOD_PDF_NO_TEXT,
                'ocr_available' => false,
                'message' => 'This PDF has no selectable text. Upload a PDF or Word file with selectable text, or classify the invoice manually. Image OCR is not configured.',
            ];
        }

        if (
            $mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            || $ext === 'docx'
        ) {
            return ['text' => $this->fromDocx($contents), 'method' => 'docx_xml'];
        }

        if (str_starts_with($mime, 'image/') || in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'], true)) {
            return (new OcrUnconfiguredAdapter)->extract();
        }

        if (str_starts_with($mime, 'text/') || $ext === 'txt') {
            return ['text' => Utf8::string($contents), 'method' => 'plain_text'];
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
        if ($this->isUsablePdfText($joined)) {
            return $joined;
        }

        return '';
    }

    public function fromDocx(string $contents): string
    {
        $tmp = tempnam(sys_get_temp_dir(), 'docx');
        if ($tmp === false) {
            return '';
        }
        file_put_contents($tmp, $contents);
        $zip = new \ZipArchive;
        if ($zip->open($tmp) !== true) {
            @unlink($tmp);

            return '';
        }
        $xml = $zip->getFromName('word/document.xml') ?: '';
        $zip->close();
        @unlink($tmp);
        $xml = preg_replace('/<w:p[^>]*>/', "\n", $xml) ?? $xml;
        $text = strip_tags(str_replace('</w:t>', ' ', $xml));

        return Utf8::string(trim(html_entity_decode($text, ENT_QUOTES | ENT_XML1, 'UTF-8')));
    }

    private function isUsablePdfText(string $text): bool
    {
        $trimmed = trim($text);
        if ($trimmed === '' || str_starts_with($trimmed, '%PDF')) {
            return false;
        }
        if (! mb_check_encoding($trimmed, 'UTF-8')) {
            return false;
        }
        if (strlen($trimmed) > 200000) {
            return false;
        }

        return (bool) preg_match('/[A-Za-z]{4,}/', $trimmed);
    }

    private function unescapePdf(string $value): string
    {
        $value = str_replace(['\\n', '\\r', '\\t', '\\(', '\\)', '\\\\'], ["\n", "\r", "\t", '(', ')', '\\'], $value);

        return $value;
    }
}
