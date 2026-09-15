<?php

namespace App\Modules\Documents\Support;

use Illuminate\Support\Str;

final class PurchaseOrderLayoutSanitizer
{
    public const TYPES = [
        'logo', 'org_name', 'org_address', 'image',
        'heading', 'field', 'text', 'line', 'rectangle',
        'table', 'approval_block', 'qr', 'footer', 'page_number',
    ];

    public const BINDINGS = [
        'org.logo', 'org.name', 'org.abbreviation', 'org.address', 'org.phone', 'org.email', 'org.website', 'org.tagline',
        'po.reference', 'po.issue_date', 'po.currency', 'po.subtotal', 'po.vat', 'po.discount',
        'po.other_charges', 'po.total', 'po.amount_in_words', 'po.notes', 'po.terms',
        'po.delivery_address', 'po.delivery_date', 'po.generated_at', 'po.page_number',
        'supplier.name', 'supplier.address', 'supplier.phone', 'supplier.email', 'supplier.contact',
        'project.name', 'project.code', 'programme.name', 'funding.source', 'budget.code', 'cost_centre',
        'requisition.reference', 'procurement.reference',
        'requester.name', 'requester.position', 'requester.signature', 'requester.signed_at',
        'workflow.approvals', 'po.items',
    ];

    public const TABLE_COLUMNS = [
        'line_no', 'item_code', 'description', 'qty', 'unit',
        'unit_price', 'discount', 'vat_percent', 'vat', 'line_total', 'budget_code',
    ];

    public const APPROVAL_LAYOUTS = ['horizontal', 'vertical', 'dynamic_grid'];

    /**
     * @param  array<string, mixed>  $layout
     * @return array{page: array<string, mixed>, elements: list<array<string, mixed>>}
     */
    public static function sanitize(mixed $layout): array
    {
        $raw = is_array($layout) ? $layout : [];
        $pageIn = is_array($raw['page'] ?? null) ? $raw['page'] : [];
        $orientation = in_array($pageIn['orientation'] ?? '', ['portrait', 'landscape'], true)
            ? $pageIn['orientation']
            : 'portrait';
        $size = strtolower((string) ($pageIn['size'] ?? 'a4')) === 'a4' ? 'a4' : 'a4';
        $margin = is_array($pageIn['margin_mm'] ?? null) ? $pageIn['margin_mm'] : [];
        $page = [
            'size' => $size,
            'orientation' => $orientation,
            'margin_mm' => [
                'top' => self::num($margin['top'] ?? 12, 5, 40),
                'right' => self::num($margin['right'] ?? 12, 5, 40),
                'bottom' => self::num($margin['bottom'] ?? 14, 5, 40),
                'left' => self::num($margin['left'] ?? 12, 5, 40),
            ],
        ];

        $maxW = $orientation === 'landscape' ? 297.0 : 210.0;
        $maxH = $orientation === 'landscape' ? 210.0 : 297.0;
        $elements = [];
        $seen = [];
        foreach (is_array($raw['elements'] ?? null) ? $raw['elements'] : [] as $row) {
            if (! is_array($row)) {
                continue;
            }
            $el = self::normalizeElement($row, $maxW, $maxH);
            if ($el === null) {
                continue;
            }
            if (isset($seen[$el['id']])) {
                $el['id'] = (string) Str::uuid();
            }
            $seen[$el['id']] = true;
            $elements[] = $el;
        }

        return ['page' => $page, 'elements' => $elements];
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>|null
     */
    private static function normalizeElement(array $row, float $maxW, float $maxH): ?array
    {
        $type = is_string($row['type'] ?? null) ? $row['type'] : '';
        if (! in_array($type, self::TYPES, true)) {
            return null;
        }
        $w = self::num($row['w_mm'] ?? 40, 2, $maxW);
        $h = self::num($row['h_mm'] ?? 8, 2, $maxH);
        $x = self::num($row['x_mm'] ?? 12, 0, max(0, $maxW - 2));
        $y = self::num($row['y_mm'] ?? 12, 0, max(0, $maxH - 2));
        $id = is_string($row['id'] ?? null) && $row['id'] !== '' ? $row['id'] : (string) Str::uuid();

        $el = [
            'id' => $id,
            'type' => $type,
            'x_mm' => $x,
            'y_mm' => $y,
            'w_mm' => $w,
            'h_mm' => $h,
            'z' => (int) ($row['z'] ?? 0),
            'locked' => (bool) ($row['locked'] ?? false),
            'hidden' => (bool) ($row['hidden'] ?? false),
            'font_size' => self::num($row['font_size'] ?? 10, 6, 28),
            'align' => in_array($row['align'] ?? '', ['left', 'center', 'right'], true) ? $row['align'] : 'left',
            'bold' => (bool) ($row['bold'] ?? false),
            'border' => (bool) ($row['border'] ?? false),
            'padding_mm' => self::num($row['padding_mm'] ?? 1, 0, 8),
        ];

        $binding = is_string($row['binding'] ?? null) ? $row['binding'] : null;
        if ($binding !== null && $binding !== '' && ! in_array($binding, self::BINDINGS, true)) {
            return null;
        }
        if ($binding) {
            $el['binding'] = $binding;
        }
        if ($type === 'text' || $type === 'heading') {
            $el['text'] = mb_substr((string) ($row['text'] ?? ($type === 'heading' ? 'PURCHASE ORDER' : '')), 0, 500);
        }
        if ($type === 'table') {
            $cols = [];
            foreach (is_array($row['columns'] ?? null) ? $row['columns'] : ['qty', 'description', 'unit_price', 'line_total'] as $col) {
                if (is_string($col) && in_array($col, self::TABLE_COLUMNS, true) && ! in_array($col, $cols, true)) {
                    $cols[] = $col;
                }
            }
            $el['columns'] = $cols !== [] ? $cols : ['qty', 'description', 'unit_price', 'line_total'];
            $el['flow'] = true;
            $el['binding'] = 'po.items';
        }
        if ($type === 'approval_block') {
            $el['layout'] = in_array($row['layout'] ?? '', self::APPROVAL_LAYOUTS, true) ? $row['layout'] : 'horizontal';
            $el['binding'] = 'workflow.approvals';
        }
        if ($type === 'logo' || $type === 'image') {
            $el['keep_aspect'] = $row['keep_aspect'] ?? true;
            $el['binding'] = $el['binding'] ?? 'org.logo';
        }
        if ($type === 'field' && empty($el['binding'])) {
            return null;
        }

        return $el;
    }

    private static function num(mixed $value, float $min, float $max): float
    {
        $n = is_numeric($value) ? (float) $value : $min;

        return round(min($max, max($min, $n)), 2);
    }

    public static function catalogHash(): string
    {
        return hash('sha256', json_encode(['bindings' => self::BINDINGS, 'types' => self::TYPES]));
    }
}
