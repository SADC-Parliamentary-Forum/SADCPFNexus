<?php

namespace App\Modules\Procurement\Support;

/**
 * Image OCR is not wired. Never invent extracted text from a scan.
 * Upload of PDF/DOCX with selectable text remains the live extraction path.
 */
final class OcrUnconfiguredAdapter
{
    public const METHOD = 'ocr_unconfigured';

    /**
     * @return array{text: string, method: string, ocr_available: false, message: string}
     */
    public function extract(): array
    {
        return [
            'text' => '',
            'method' => self::METHOD,
            'ocr_available' => false,
            'message' => 'Image OCR is not configured. Upload a PDF or DOCX with selectable text, or classify this image manually. Upload remains the live intake path.',
        ];
    }
}
