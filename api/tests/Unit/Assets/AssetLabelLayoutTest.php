<?php

namespace Tests\Unit\Assets;

use App\Modules\Assets\Support\AssetLabelLayout;
use PHPUnit\Framework\TestCase;

class AssetLabelLayoutTest extends TestCase
{
    public function test_default_includes_core_fields_and_qr(): void
    {
        $items = AssetLabelLayout::defaultItems(63.5, 46.6, 22);
        $ids = array_column($items, 'id');
        $this->assertSame(
            ['org', 'notice', 'tag', 'name', 'model', 'serial', 'location', 'custodian', 'qr'],
            $ids
        );
        $qr = null;
        foreach ($items as $item) {
            if ($item['id'] === 'qr') {
                $qr = $item;
                break;
            }
        }
        $this->assertNotNull($qr);
        $this->assertSame($qr['w_mm'], $qr['h_mm']);
        $this->assertGreaterThan(0, $qr['w_mm']);
    }

    public function test_sanitize_drops_unknown_ids_and_keys(): void
    {
        $clean = AssetLabelLayout::sanitize([
            ['id' => 'qr', 'x_mm' => 10, 'y_mm' => 8, 'w_mm' => 20, 'h_mm' => 20, 'onclick' => 'alert(1)'],
            ['id' => 'evil', 'x_mm' => 0, 'y_mm' => 0, 'w_mm' => 10],
            ['id' => 'tag', 'x_mm' => 2, 'y_mm' => 10, 'w_mm' => 30, 'h_mm' => 5, 'visible' => true],
        ], 63.5, 46.6, 22);

        $ids = array_column($clean, 'id');
        $this->assertSame(['qr', 'tag'], $ids);
        $this->assertArrayNotHasKey('onclick', $clean[0]);
        $this->assertSame(['id', 'x_mm', 'y_mm', 'w_mm', 'h_mm', 'visible'], array_keys($clean[0]));
    }

    public function test_sanitize_clamps_negative_and_overflow_coordinates(): void
    {
        $clean = AssetLabelLayout::sanitize([
            ['id' => 'tag', 'x_mm' => -40, 'y_mm' => 90, 'w_mm' => 400, 'h_mm' => 400],
        ], 63.5, 46.6, 22);

        $this->assertCount(1, $clean);
        $this->assertGreaterThanOrEqual(0, $clean[0]['x_mm']);
        $this->assertGreaterThanOrEqual(0, $clean[0]['y_mm']);
        $this->assertLessThanOrEqual(63.5, $clean[0]['x_mm'] + $clean[0]['w_mm']);
        $this->assertLessThanOrEqual(46.6, $clean[0]['y_mm'] + $clean[0]['h_mm']);
    }

    public function test_empty_or_null_layout_falls_back_to_default(): void
    {
        $fromNull = AssetLabelLayout::sanitize(null, 63.5, 46.6, 22);
        $fromEmpty = AssetLabelLayout::sanitize([], 70, 40, 18);
        $this->assertCount(9, $fromNull);
        $this->assertCount(9, $fromEmpty);
        $this->assertSame('qr', $fromEmpty[8]['id']);
    }

    public function test_wrapped_items_key_is_accepted(): void
    {
        $clean = AssetLabelLayout::sanitize([
            'items' => [
                ['id' => 'name', 'x_mm' => 2, 'y_mm' => 12, 'w_mm' => 40, 'h_mm' => 6],
            ],
        ], 63.5, 46.6, 22);
        $this->assertSame(['name'], array_column($clean, 'id'));
    }

    public function test_duplicate_ids_keep_last(): void
    {
        $clean = AssetLabelLayout::sanitize([
            ['id' => 'tag', 'x_mm' => 1, 'y_mm' => 1, 'w_mm' => 10, 'h_mm' => 4],
            ['id' => 'tag', 'x_mm' => 5, 'y_mm' => 6, 'w_mm' => 12, 'h_mm' => 4],
        ], 63.5, 46.6, 22);
        $this->assertCount(1, $clean);
        $this->assertSame(5.0, $clean[0]['x_mm']);
        $this->assertSame(6.0, $clean[0]['y_mm']);
    }

    public function test_qr_stays_square(): void
    {
        $clean = AssetLabelLayout::sanitize([
            ['id' => 'qr', 'x_mm' => 40, 'y_mm' => 10, 'w_mm' => 18, 'h_mm' => 30],
        ], 63.5, 46.6, 22);
        $this->assertSame($clean[0]['w_mm'], $clean[0]['h_mm']);
    }
}
