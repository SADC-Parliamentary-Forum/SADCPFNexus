<?php

namespace App\Modules\Assets\Support;

/**
 * Official SADC PF Fixed Asset Register categories from the operational listing.
 *
 * Codes stay stable for import/matching; names match the spreadsheet Category column.
 *
 * @phpstan-type CategoryItem array{
 *     name: string,
 *     code: string,
 *     sort_order: int,
 *     useful_life_years: int|null,
 *     aliases: list<string>
 * }
 */
final class AssetCategoryCatalog
{
    /**
     * @return list<CategoryItem>
     */
    public static function items(): array
    {
        return [
            [
                'name' => 'Office Furniture',
                'code' => 'furniture',
                'sort_order' => 10,
                'useful_life_years' => 4,
                'aliases' => [
                    'office furniture',
                    'office furniture & fittings',
                    'office furniture and fittings',
                    'furniture',
                ],
            ],
            [
                'name' => 'IT Equipment',
                'code' => 'it',
                'sort_order' => 20,
                'useful_life_years' => 4,
                'aliases' => [
                    'it',
                    'it equipment',
                    'computer equipment',
                    'computers',
                ],
            ],
            [
                'name' => 'Office Equipment',
                'code' => 'equipment',
                'sort_order' => 30,
                'useful_life_years' => 4,
                'aliases' => [
                    'office equipment',
                    'ofice equipment',
                    'equipment',
                ],
            ],
            [
                'name' => 'Kitchen Equipment',
                'code' => 'kitchen',
                'sort_order' => 40,
                'useful_life_years' => 4,
                'aliases' => [
                    'kitchen equipment',
                    'kitchen',
                ],
            ],
            [
                'name' => 'Vehicles',
                'code' => 'fleet',
                'sort_order' => 50,
                'useful_life_years' => 5,
                'aliases' => [
                    'vehicles',
                    'motor vehicles',
                    'fleet',
                ],
            ],
            [
                'name' => 'Security Equipment',
                'code' => 'security',
                'sort_order' => 60,
                'useful_life_years' => 4,
                'aliases' => [
                    'security equipment',
                    'security',
                ],
            ],
            [
                'name' => 'Specialized Equipment',
                'code' => 'specialized',
                'sort_order' => 70,
                'useful_life_years' => 4,
                'aliases' => [
                    'specialized equipment',
                    'specialised equipment',
                    'specialized',
                    'specialised',
                ],
            ],
            [
                'name' => 'Audio Visual Equipment',
                'code' => 'av',
                'sort_order' => 80,
                'useful_life_years' => 4,
                'aliases' => [
                    'audio visual equipment',
                    'audio-visual equipment',
                    'audio visual',
                    'av equipment',
                    'av',
                ],
            ],
            [
                'name' => 'Other (Sports Equipment)',
                'code' => 'sports',
                'sort_order' => 90,
                'useful_life_years' => 4,
                'aliases' => [
                    'other (sports equipment)',
                    'sports equipment',
                    'sports',
                ],
            ],
            [
                'name' => 'Other (Conference Equipment)',
                'code' => 'conference',
                'sort_order' => 100,
                'useful_life_years' => 4,
                'aliases' => [
                    'other (conference equipment)',
                    'conference equipment',
                    'conference',
                ],
            ],
            [
                'name' => 'Household Furniture & Fittings',
                'code' => 'household',
                'sort_order' => 110,
                'useful_life_years' => 4,
                'aliases' => [
                    'household  - furniture & fittings',
                    'household - furniture & fittings',
                    'household furniture & fittings',
                    'household',
                ],
            ],
            [
                'name' => 'Land & Buildings',
                'code' => 'land_buildings',
                'sort_order' => 120,
                'useful_life_years' => 50,
                'aliases' => [
                    'land & buildings',
                    'land and buildings',
                    'buildings',
                ],
            ],
            [
                'name' => 'Assets Held for Sale',
                'code' => 'held_for_sale',
                'sort_order' => 130,
                'useful_life_years' => null,
                'aliases' => [
                    'assets held for sale',
                    'held for sale',
                ],
            ],
        ];
    }
}
