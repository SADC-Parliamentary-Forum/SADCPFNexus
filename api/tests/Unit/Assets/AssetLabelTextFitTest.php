<?php

namespace Tests\Unit\Assets;

use App\Modules\Assets\Support\AssetLabelLayout;
use App\Modules\Assets\Support\AssetLabelTextFit;
use Illuminate\Foundation\Testing\TestCase;
use PHPUnit\Framework\Attributes\DataProvider;

/** Measures text with dompdf's font metrics only, so it skips the base TestCase's database refresh. */
class AssetLabelTextFitTest extends TestCase
{
    /** The longest values in the 31 March 2026 FAR listing, as each label line prints them. */
    private const LONGEST = [
        'name' => ['name', 'Dell Vostro 5490-10th Gen Intel i5 Laptop-Ms. P. Kanguatjivi'],
        'serial' => ['meta', 'S/N: MRJG61100H304010C55900'],
        'location' => ['meta', 'Location: Dr. J.Segale - Office #17'],
        'custodian' => ['meta', 'Assigned to: Daphney Engelbrecht'],
        'tag' => ['tag', 'CE-0001'],
        'org' => ['org', 'SADC Parliamentary Forum'],
        'owner' => ['meta', 'Owner: SADC Parliamentary Forum'],
    ];

    private function fit(): AssetLabelTextFit
    {
        return new AssetLabelTextFit(app('dompdf.wrapper')->getDomPDF()->getFontMetrics());
    }

    /** @return array<string, array{float, float, float}> */
    public static function productionSizes(): array
    {
        return [
            'Avery L7161 63.5x46.6' => [63.5, 46.6, 22.0],
            'Thermal 70x40' => [70.0, 40.0, 22.0],
        ];
    }

    #[DataProvider('productionSizes')]
    public function test_longest_register_values_fit_above_the_minimum_size(float $w, float $h, float $qr): void
    {
        $fit = $this->fit();
        foreach (AssetLabelLayout::defaultItems($w, $h, $qr) as $item) {
            if (! isset(self::LONGEST[$item['id']]) || ! $item['visible']) {
                continue;
            }
            [$class, $text] = self::LONGEST[$item['id']];
            $pt = $fit->fontSize($class, $text, $item['w_mm'], $item['h_mm'], 8.0);

            $this->assertGreaterThan(AssetLabelTextFit::MIN_PT, $pt, $item['id'].' does not fit its box');
        }
    }

    public function test_short_text_keeps_its_base_size(): void
    {
        $this->assertSame(6.5, $this->fit()->fontSize('meta', 'S/N: 6CGK2X1', 37.5, 3.2, 8.0));
        $this->assertSame(11.0, $this->fit()->fontSize('tag', 'CE-0001', 37.5, 4.8, 8.0));
    }

    public function test_long_text_shrinks(): void
    {
        $this->assertLessThan(6.5, $this->fit()->fontSize('meta', 'Location: Dr. J.Segale - Office #17', 37.5, 3.2, 8.0));
    }
}
