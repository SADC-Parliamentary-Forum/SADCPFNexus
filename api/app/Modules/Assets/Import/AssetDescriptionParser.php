<?php

namespace App\Modules\Assets\Import;

/**
 * Conservative make/model/serial extraction from a legacy description.
 * Never invents values; low-confidence matches are left empty.
 */
final class AssetDescriptionParser
{
    // Longer names first so "Konica Minolta" wins over "Konica".
    private const MAKES = [
        'Konica Minolta', 'Hewlett-Packard', 'HP', 'Dell', 'Lenovo', 'Apple', 'ASUS', 'Acer',
        'Samsung', 'Konica', 'Canon', 'Epson', 'Brother', 'Cisco', 'Xerox', 'Proline', 'BMW',
        'Toyota', 'Nissan', 'Hisense', 'Defy', 'Siemens', 'Siemen', 'Nikon',
        'Logitech', 'Karcher',
    ];

    /** "S/N", "S/N:", "Ser.No.", "Serial Number" etc., also glued to the value ("S/NCNC0G1805"). */
    private const SERIAL_LABEL = '(?:S\/N|Ser\.?\s*No\.?|Serial(?:\s*(?:Number|No\.?))?)\s*[:#]?\s*';

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

    /**
     * The description with its serial-number segment removed, e.g.
     * "Dell Laptop S/N 6CGK2X1" -> "Dell Laptop", "HP 15s i5 Laptop - Ser.No. 5CD144HSKY" -> "HP 15s i5 Laptop".
     */
    public function withoutSerial(string $text): string
    {
        $out = preg_replace('/[\s\-]*\b'.self::SERIAL_LABEL.'[A-Z0-9\-]{5,}\b[.,;]?/i', '', $text) ?? $text;
        $out = trim(preg_replace('/\s+/', ' ', $out) ?? $out, " \t-");

        return $out !== '' ? $out : trim($text);
    }

    private function extractSerial(string $text): ?string
    {
        if (preg_match('/\b'.self::SERIAL_LABEL.'([A-Z0-9\-]{5,})\b/i', $text, $m)) {
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
        $working = $serial ? $this->withoutSerial($text) : trim(preg_replace('/\s+/', ' ', $text) ?? $text);
        if ($make && preg_match('/\b'.preg_quote($make, '/').'\b[\s\-]+(.+)$/i', $working, $m)) {
            $model = $this->withoutAssignee(trim($m[1]));
            // "Dell Laptop" names the kind of item, not a model.
            if (preg_match('/^(?:laptop|desktop|printer|projector|scanner|monitor)$/i', $model)) {
                return null;
            }
            if (mb_strlen($model) < 3 || mb_strlen($model) > 120) {
                return null;
            }

            return $model;
        }

        return null;
    }

    /**
     * Drops who the item was bought for and the trailing "Laptop" the FAR appends:
     * "Vostro 5490 - Laptop for Ms. L. Boois" -> "Vostro 5490",
     * "Elitebook X360 830 G10 I5 13 16GB Laptop - S. Bokosi" -> "Elitebook X360 830 G10 I5 13 16GB".
     */
    private function withoutAssignee(string $model): string
    {
        $patterns = [
            '/[\s\-]*\b(?:Laptop\s+)?(?:for\s+)?(?:Mr|Ms|Mrs|Dr|Prof)\b\.?\s*[A-Z].*$/',
            '/\s+-\s*[A-Z]\.\s*[A-Z][a-z]+$/',
            '/\s+-\s*[A-Z]{2,3}$/',
            '/[\s\-]+Laptop$/i',
        ];
        foreach ($patterns as $pattern) {
            $model = preg_replace($pattern, '', $model) ?? $model;
        }

        return trim($model, " \t-");
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
