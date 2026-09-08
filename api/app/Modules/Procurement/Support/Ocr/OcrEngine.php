<?php

namespace App\Modules\Procurement\Support\Ocr;

interface OcrEngine
{
    public function isAvailable(): bool;

    /**
     * @return array{text: string, method: string, ocr_available: bool, message: string}
     */
    public function recognize(string $bytes, string $mime, string $filename = ''): array;
}
