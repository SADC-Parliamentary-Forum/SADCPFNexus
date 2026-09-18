<?php

namespace Tests\Unit\Assets;

use App\Modules\Assets\Import\AssetCategoryMapper;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class AssetCategoryMapperTest extends TestCase
{
    /**
     * @return array<string, array{0: string, 1: string}>
     */
    public static function farSpreadsheetCategories(): array
    {
        return [
            'office furniture' => ['Office Furniture', 'furniture'],
            'it equipment' => ['IT Equipment', 'it'],
            'office equipment' => ['Office Equipment', 'equipment'],
            'kitchen equipment' => ['Kitchen Equipment', 'kitchen'],
            'vehicles' => ['Vehicles', 'fleet'],
            'security equipment' => ['Security Equipment', 'security'],
            'specialized equipment' => ['Specialized Equipment', 'specialized'],
            'specialised spelling' => ['Specialised Equipment', 'specialized'],
            'audio visual' => ['Audio Visual Equipment', 'av'],
            'audio-visual' => ['Audio-Visual Equipment', 'av'],
            'sports' => ['Other (Sports Equipment)', 'sports'],
            'conference' => ['Other (Conference Equipment)', 'conference'],
        ];
    }

    #[DataProvider('farSpreadsheetCategories')]
    public function test_maps_sadcpf_far_spreadsheet_category_labels(string $label, string $code): void
    {
        $this->assertSame($code, AssetCategoryMapper::toCode($label));
    }
}
