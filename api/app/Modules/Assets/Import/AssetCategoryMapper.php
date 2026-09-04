<?php

namespace App\Modules\Assets\Import;

final class AssetCategoryMapper
{
    public const MAP = [
        'computer equipment' => 'it',
        'office furniture & fittings' => 'furniture',
        'office furniture and fittings' => 'furniture',
        'household  - furniture & fittings' => 'household',
        'household - furniture & fittings' => 'household',
        'household furniture & fittings' => 'household',
        'office equipment' => 'equipment',
        'ofice equipment' => 'equipment',
        'land & buildings' => 'land_buildings',
        'land and buildings' => 'land_buildings',
        'motor vehicles' => 'fleet',
        'assets held for sale' => 'held_for_sale',
        'it' => 'it',
        'fleet' => 'fleet',
        'furniture' => 'furniture',
        'equipment' => 'equipment',
    ];

    public static function toCode(?string $legacy): ?string
    {
        if ($legacy === null || trim($legacy) === '') {
            return null;
        }
        $key = strtolower(trim(preg_replace('/\s+/', ' ', $legacy) ?? $legacy));

        return self::MAP[$key] ?? null;
    }
}
