<?php

namespace App\Modules\Assets\Import;

use App\Modules\Assets\Support\AssetCategoryCatalog;

final class AssetCategoryMapper
{
    public static function toCode(?string $legacy): ?string
    {
        if ($legacy === null || trim($legacy) === '') {
            return null;
        }

        $key = self::normalize($legacy);

        return self::map()[$key] ?? null;
    }

    /**
     * @return array<string, string>
     */
    private static function map(): array
    {
        static $map = null;
        if (is_array($map)) {
            return $map;
        }

        $map = [];
        foreach (AssetCategoryCatalog::items() as $item) {
            $map[self::normalize($item['name'])] = $item['code'];
            $map[self::normalize($item['code'])] = $item['code'];
            foreach ($item['aliases'] as $alias) {
                $map[self::normalize($alias)] = $item['code'];
            }
        }

        return $map;
    }

    private static function normalize(string $value): string
    {
        $collapsed = preg_replace('/\s+/', ' ', $value) ?? $value;

        return strtolower(trim($collapsed));
    }
}
