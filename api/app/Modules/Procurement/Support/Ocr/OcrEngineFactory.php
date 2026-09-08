<?php

namespace App\Modules\Procurement\Support\Ocr;

use App\Modules\Procurement\Support\OcrUnconfiguredAdapter;

final class OcrEngineFactory
{
    public function make(): OcrEngine
    {
        $driver = strtolower(trim((string) config('procurement.ocr_adapter', 'tesseract')));
        if ($driver === 'unconfigured' || $driver === 'none' || $driver === 'null') {
            return new OcrUnconfiguredAdapter;
        }
        if ($driver === 'tesseract') {
            $engine = TesseractOcrEngine::fromConfig();

            return $engine->isAvailable() ? $engine : new OcrUnconfiguredAdapter;
        }

        return new OcrUnconfiguredAdapter;
    }
}
