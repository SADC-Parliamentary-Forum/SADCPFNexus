<?php

namespace Tests\Support;

use App\Modules\Procurement\Support\Ocr\OcrEngine;

final class FakeOcrEngine implements OcrEngine
{
    public function __construct(private readonly string $text) {}

    public function isAvailable(): bool
    {
        return true;
    }

    public function recognize(string $bytes, string $mime, string $filename = ''): array
    {
        $method = str_contains($mime, 'pdf') || str_ends_with(strtolower($filename), '.pdf')
            ? 'pdf_ocr'
            : 'image_ocr';

        return [
            'text' => $this->text,
            'method' => $method,
            'ocr_available' => true,
            'message' => 'OCR extracted selectable text from a rendered document.',
        ];
    }
}
