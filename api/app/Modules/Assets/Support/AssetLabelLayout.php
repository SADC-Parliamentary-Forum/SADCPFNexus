<?php

namespace App\Modules\Assets\Support;

use App\Models\AssetLabelTemplate;

final class AssetLabelLayout
{
    /** @var list<string> */
    public const IDS = ['org', 'notice', 'tag', 'name', 'model', 'serial', 'location', 'custodian', 'qr'];

    /**
     * @return list<array{id: string, x_mm: float, y_mm: float, w_mm: float, h_mm: float, visible: bool}>
     */
    public static function defaultItems(float $labelW, float $labelH, float $qrMm): array
    {
        $qr = min(max(8.0, $qrMm), max(8.0, $labelW * 0.42), max(8.0, $labelH * 0.55));
        $qr = min($qr, max(8.0, $labelW - 3), max(8.0, $labelH - 3));
        $textW = max(10.0, $labelW - $qr - 4.0);
        $qrX = max(0.0, $labelW - $qr - 1.5);
        $qrY = min(8.0, max(1.5, $labelH - $qr - 2.0));

        $draft = [
            ['id' => 'org', 'x_mm' => 1.5, 'y_mm' => 1.2, 'w_mm' => max(10.0, $labelW - 3), 'h_mm' => 3.4, 'visible' => true],
            ['id' => 'notice', 'x_mm' => 1.5, 'y_mm' => 4.6, 'w_mm' => max(10.0, $labelW - 3), 'h_mm' => 3.0, 'visible' => true],
            ['id' => 'tag', 'x_mm' => 1.5, 'y_mm' => 8.0, 'w_mm' => $textW, 'h_mm' => 4.8, 'visible' => true],
            ['id' => 'name', 'x_mm' => 1.5, 'y_mm' => 12.8, 'w_mm' => $textW, 'h_mm' => 5.4, 'visible' => true],
            ['id' => 'model', 'x_mm' => 1.5, 'y_mm' => 18.4, 'w_mm' => $textW, 'h_mm' => 3.6, 'visible' => true],
            ['id' => 'serial', 'x_mm' => 1.5, 'y_mm' => 22.2, 'w_mm' => $textW, 'h_mm' => 3.6, 'visible' => true],
            ['id' => 'location', 'x_mm' => 1.5, 'y_mm' => 26.0, 'w_mm' => $textW, 'h_mm' => 3.6, 'visible' => true],
            ['id' => 'custodian', 'x_mm' => 1.5, 'y_mm' => 29.8, 'w_mm' => $textW, 'h_mm' => 3.6, 'visible' => true],
            ['id' => 'qr', 'x_mm' => $qrX, 'y_mm' => $qrY, 'w_mm' => $qr, 'h_mm' => $qr, 'visible' => true],
        ];

        $items = [];
        foreach ($draft as $row) {
            $item = self::normalizeItem($row, $labelW, $labelH);
            if ($item !== null) {
                $items[] = $item;
            }
        }

        return $items;
    }

    /**
     * @return list<array{id: string, x_mm: float, y_mm: float, w_mm: float, h_mm: float, visible: bool}>
     */
    public static function sanitize(mixed $layout, float $labelW, float $labelH, float $qrMm = 22.0): array
    {
        $raw = self::extractItems($layout);
        if ($raw === []) {
            return self::defaultItems($labelW, $labelH, $qrMm);
        }

        $seen = [];
        $order = [];
        foreach ($raw as $row) {
            if (! is_array($row)) {
                continue;
            }
            $id = isset($row['id']) && is_string($row['id']) ? $row['id'] : '';
            if (! in_array($id, self::IDS, true)) {
                continue;
            }
            $item = self::normalizeItem($row, $labelW, $labelH);
            if ($item === null) {
                continue;
            }
            if (! isset($seen[$id])) {
                $order[] = $id;
            }
            $seen[$id] = $item;
        }

        if ($order === []) {
            return self::defaultItems($labelW, $labelH, $qrMm);
        }

        $clean = [];
        foreach ($order as $id) {
            $clean[] = $seen[$id];
        }

        return $clean;
    }

    /**
     * @return list<array{id: string, x_mm: float, y_mm: float, w_mm: float, h_mm: float, visible: bool}>
     */
    public static function resolve(AssetLabelTemplate $template): array
    {
        return self::sanitize(
            $template->layout,
            (float) $template->label_width_mm,
            (float) $template->label_height_mm,
            (float) $template->qr_mm,
        );
    }

    /**
     * @return list<mixed>
     */
    private static function extractItems(mixed $layout): array
    {
        if (! is_array($layout)) {
            return [];
        }
        if (isset($layout['items']) && is_array($layout['items'])) {
            return array_values($layout['items']);
        }
        if ($layout === []) {
            return [];
        }

        return array_is_list($layout) ? $layout : [];
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array{id: string, x_mm: float, y_mm: float, w_mm: float, h_mm: float, visible: bool}|null
     */
    private static function normalizeItem(array $row, float $labelW, float $labelH): ?array
    {
        $id = isset($row['id']) && is_string($row['id']) ? $row['id'] : '';
        if (! in_array($id, self::IDS, true)) {
            return null;
        }

        $labelW = max(10.0, $labelW);
        $labelH = max(10.0, $labelH);

        $w = self::num($row['w_mm'] ?? 20, 4.0, $labelW);
        $h = self::num($row['h_mm'] ?? ($id === 'qr' ? $w : 4.0), 3.0, $labelH);

        if ($id === 'qr') {
            $size = min($w, $h, $labelW, $labelH);
            $size = max(8.0, min($size, $labelW, $labelH));
            $w = $h = $size;
        }

        $x = self::num($row['x_mm'] ?? 0, 0.0, max(0.0, $labelW - $w));
        $y = self::num($row['y_mm'] ?? 0, 0.0, max(0.0, $labelH - $h));

        return [
            'id' => $id,
            'x_mm' => $x,
            'y_mm' => $y,
            'w_mm' => $w,
            'h_mm' => $h,
            'visible' => array_key_exists('visible', $row) ? (bool) $row['visible'] : true,
        ];
    }

    private static function num(mixed $value, float $min, float $max): float
    {
        if (! is_numeric($value)) {
            $value = $min;
        }
        $n = round((float) $value, 2);
        if ($max < $min) {
            return round($max, 2);
        }

        return round(max($min, min($n, $max)), 2);
    }
}
