<?php

namespace App\Modules\Assets\Import;

/**
 * Conservative make/model/serial extraction from a legacy description.
 * Never invents values; low-confidence matches are left empty.
 */
final class AssetDescriptionParser
{
    private const MAKES = [
        'HP', 'Hewlett-Packard', 'Dell', 'Lenovo', 'Apple', 'ASUS', 'Acer', 'Samsung',
        'Konica', 'Konica Minolta', 'Canon', 'Epson', 'Brother', 'Cisco', 'BMW',
        'Toyota', 'Nissan', 'Hisense', 'Defy', 'Siemens', 'Siemen', 'Nikon',
        'Logitech', 'Karcher',
    ];

    /**
     * @return array{make: ?string, model: ?string, serial: ?string, asset_name: ?string, confidence: string, flags: list<string>}
     */
    public function parse(?string $description): array
    {
        $flags = [];
        $text = trim((string) $description);
        if ($text === '') {
            return [
                'make' => null,
                'model' => null,
                'serial' => null,
                'asset_name' => null,
                'confidence' => 'none',
                'flags' => ['MISSING_MODEL', 'MISSING_SERIAL', 'DESCRIPTION_PARSE_WARNING'],
            ];
        }

        $serial = $this->extractSerial($text);
        $make = $this->extractMake($text);
        $model = $this->extractModel($text, $make, $serial);
        $name = $this->guessName($text);

        if ($serial === null) {
            $flags[] = 'MISSING_SERIAL';
        }
        if ($model === null) {
            $flags[] = 'MISSING_MODEL';
        }
        if ($make === null || $model === null) {
            $flags[] = 'DESCRIPTION_PARSE_WARNING';
        }

        $confidence = 'low';
        if ($make && $model && $serial) {
            $confidence = 'high';
        } elseif ($make && $model) {
            $confidence = 'medium';
        }

        return [
            'make' => $make,
            'model' => $model,
            'serial' => $serial,
            'asset_name' => $name,
            'confidence' => $confidence,
            'flags' => array_values(array_unique($flags)),
        ];
    }

    private function extractSerial(string $text): ?string
    {
        if (preg_match('/\b(?:S\/N|S\/N:|Ser\.?\s*No\.?|Serial(?:\s*Number)?)\s*[:#]?\s*([A-Z0-9\-]{5,})\b/i', $text, $m)) {
            $serial = strtoupper(rtrim($m[1], '.,;'));
            if (in_array($serial, ['N/A', 'NA', 'UNKNOWN', 'NONE', '000000', '0'], true)) {
                return null;
            }

            return $serial;
        }

        return null;
    }

    private function extractMake(string $text): ?string
    {
        foreach (self::MAKES as $make) {
            if (preg_match('/\b'.preg_quote($make, '/').'\b/i', $text)) {
                if (strcasecmp($make, 'Hewlett-Packard') === 0 || strcasecmp($make, 'Siemen') === 0) {
                    return strcasecmp($make, 'Siemen') === 0 ? 'Siemens' : 'HP';
                }

                if (strcasecmp($make, 'Konica Minolta') === 0) {
                    return 'Konica Minolta';
                }
                if (strtoupper($make) === $make || str_contains($make, ' ')) {
                    return $make;
                }

                return ucfirst($make);
            }
        }

        return null;
    }

    private function extractModel(string $text, ?string $make, ?string $serial): ?string
    {
        $working = $text;
        if ($serial) {
            $working = preg_replace('/\b(?:S\/N|Ser\.?\s*No\.?)[^ ]*\s*'.preg_quote($serial, '/').'/i', '', $working) ?? $working;
        }
        $working = trim(preg_replace('/\s+/', ' ', $working) ?? $working);
        if ($make && preg_match('/\b'.preg_quote($make, '/').'\b\s+(.+)$/i', $working, $m)) {
            $model = trim($m[1]);
            $model = preg_replace('/\s+-\s+Laptop.*$/i', '', $model) ?? $model;
            $model = trim($model, " \t-");
            if (mb_strlen($model) < 3 || mb_strlen($model) > 120) {
                return null;
            }

            return $model;
        }

        return null;
    }

    private function guessName(string $text): ?string
    {
        $lower = strtolower($text);
        $map = [
            'laptop' => 'Laptop',
            'printer' => 'Printer',
            'desktop' => 'Desktop Computer',
            'scanner' => 'Scanner',
            'monitor' => 'Monitor',
            'server' => 'Server',
            'chair' => 'Chair',
            'desk' => 'Desk',
            'table' => 'Table',
            'credenza' => 'Credenza',
            'bookcase' => 'Bookcase',
            'cupboard' => 'Cupboard',
            'cabinet' => 'Cabinet',
            'sofa' => 'Sofa',
            'fridge' => 'Fridge',
            'vehicle' => 'Vehicle',
            'bmw' => 'Vehicle',
            'phone' => 'Telephone',
            'projector' => 'Projector',
            'camera' => 'Camera',
        ];
        foreach ($map as $needle => $name) {
            if (str_contains($lower, $needle)) {
                return $name;
            }
        }

        $first = strtok($text, ' -');

        return $first !== false && $first !== '' ? $first : null;
    }
}
