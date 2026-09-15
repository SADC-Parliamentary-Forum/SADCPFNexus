<?php

namespace App\Modules\Documents\Services;

final class PurchaseOrderDocumentRenderer
{
    /**
     * @param  array{page: array<string, mixed>, elements: list<array<string, mixed>>}  $layout
     * @param  array<string, mixed>  $context
     */
    public function toHtml(array $layout, array $context, string $mode = 'real'): string
    {
        $page = $layout['page'];
        $landscape = ($page['orientation'] ?? 'portrait') === 'landscape';
        $pageW = $landscape ? 297 : 210;
        $pageH = $landscape ? 210 : 297;
        $elements = $layout['elements'];
        usort($elements, fn ($a, $b) => ($a['y_mm'] <=> $b['y_mm']) ?: ($a['x_mm'] <=> $b['x_mm']));

        $table = null;
        $before = [];
        $after = [];
        foreach ($elements as $el) {
            if (! empty($el['hidden'])) {
                continue;
            }
            if (($el['type'] ?? '') === 'table' && $table === null) {
                $table = $el;

                continue;
            }
            if ($table === null) {
                $before[] = $el;
            } else {
                $after[] = $el;
            }
        }

        $html = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>';
        $html .= $this->css($pageW, $pageH);
        $html .= '</style></head><body>';
        $html .= '<div class="page">';
        $html .= '<div class="header-band" style="height:'.($table['y_mm'] ?? 90).'mm;position:relative;">';
        foreach ($before as $el) {
            $html .= $this->elementHtml($el, $context, $mode, absolute: true);
        }
        $html .= '</div>';
        if ($table) {
            $html .= $this->tableHtml($table, $context, $mode, (string) ($context['po']['reference'] ?? ''));
        }
        $html .= '<div class="after-band" style="position:relative;min-height:70mm;">';
        $baseY = $table['y_mm'] ?? 90;
        foreach ($after as $el) {
            $shifted = $el;
            $shifted['y_mm'] = max(0, (float) $el['y_mm'] - (float) $baseY);
            $html .= $this->elementHtml($shifted, $context, $mode, absolute: true);
        }
        $html .= '</div></div></body></html>';

        return $html;
    }

    /**
     * @param  array<string, mixed>  $el
     * @param  array<string, mixed>  $context
     */
    private function elementHtml(array $el, array $context, string $mode, bool $absolute): string
    {
        $style = $this->boxStyle($el, $absolute);
        $type = $el['type'];
        $bind = $el['binding'] ?? null;
        $value = $bind ? $this->bound($context, $bind, $mode) : ($el['text'] ?? '');

        return match ($type) {
            'logo', 'image' => $this->imageBox($style, is_string($value) ? $value : null, (string) ($el['align'] ?? 'left')),
            'org_name', 'org_address', 'heading', 'field', 'text', 'footer', 'page_number' => '<div class="el" style="'.$style.'">'.$this->escapePreserve((string) $value).'</div>',
            'line' => '<div class="el" style="'.$style.'border-top:1px solid #111;height:0;"></div>',
            'rectangle' => '<div class="el" style="'.$style.'"></div>',
            'qr' => $this->imageBox($style, is_string($context['qr'] ?? null) ? $context['qr'] : null, 'center', is_string($context['verify_url'] ?? null) ? $context['verify_url'] : null),
            'approval_block' => $this->approvalHtml($el, $context['approvals'] ?? [], $style),
            default => '',
        };
    }

    /**
     * @param  array<string, mixed>  $el
     * @param  array<string, mixed>  $context
     */
    private function tableHtml(array $el, array $context, string $mode, string $reference): string
    {
        $cols = $el['columns'] ?? ['qty', 'description', 'unit_price', 'line_total'];
        $labels = [
            'line_no' => '#', 'item_code' => 'Item Code', 'description' => 'DESCRIPTION',
            'qty' => 'QTY', 'unit' => 'Unit', 'unit_price' => 'UNIT PRICE',
            'discount' => 'Discount', 'vat_percent' => 'VAT %', 'vat' => 'VAT',
            'line_total' => 'TOTAL', 'budget_code' => 'Budget Code',
        ];
        $items = is_array($context['items'] ?? null) ? $context['items'] : [];
        $html = '<table class="items" style="width:'.((float) $el['w_mm']).'mm;margin-left:'.((float) $el['x_mm'] - 12).'mm;">';
        $html .= '<thead><tr class="cont"><th colspan="'.count($cols).'">'.e($reference).' — Continued</th></tr><tr>';
        foreach ($cols as $col) {
            $html .= '<th>'.e($labels[$col] ?? strtoupper((string) $col)).'</th>';
        }
        $html .= '</tr></thead><tbody>';
        if ($items === []) {
            $html .= '<tr><td colspan="'.count($cols).'">&nbsp;</td></tr>';
        }
        foreach ($items as $item) {
            $html .= '<tr>';
            foreach ($cols as $col) {
                $align = in_array($col, ['qty', 'unit_price', 'line_total', 'vat', 'discount'], true) ? 'right' : 'left';
                $html .= '<td style="text-align:'.$align.';page-break-inside:avoid;">'.e((string) ($item[$col] ?? '')).'</td>';
            }
            $html .= '</tr>';
        }
        $html .= '</tbody></table>';

        return $html;
    }

    /**
     * @param  array<string, mixed>  $el
     * @param  list<array<string, mixed>>  $approvals
     */
    private function approvalHtml(array $el, array $approvals, string $style): string
    {
        $layout = $el['layout'] ?? 'horizontal';
        $count = max(1, count($approvals));
        if ($layout === 'dynamic_grid') {
            $cols = $count <= 3 ? $count : 2;
        } elseif ($layout === 'vertical') {
            $cols = 1;
        } else {
            $cols = $count;
        }
        $html = '<div class="el approvals" style="'.$style.'">';
        $html .= '<div style="display:table;width:100%;">';
        $i = 0;
        foreach ($approvals as $slot) {
            if ($i % $cols === 0) {
                if ($i > 0) {
                    $html .= '</div>';
                }
                $html .= '<div style="display:table-row;page-break-inside:avoid;">';
            }
            $html .= '<div style="display:table-cell;width:'.round(100 / $cols, 2).'%;padding:4px 8px;vertical-align:top;page-break-inside:avoid;">';
            $html .= '<div style="font-size:8px;font-weight:bold;letter-spacing:0.04em;">'.e((string) $slot['label']).'</div>';
            if (! empty($slot['signature'])) {
                $html .= '<img src="'.e((string) $slot['signature']).'" style="height:28px;max-width:120px;" alt="">';
            } else {
                $html .= '<div class="pending">Pending Approval</div>';
            }
            $html .= '<div>'.e((string) ($slot['name'] ?? '')).'</div>';
            if (! empty($slot['position'])) {
                $html .= '<div style="font-size:8px;color:#444;">'.e((string) $slot['position']).'</div>';
            }
            if (! empty($slot['signed_at']) && empty($slot['pending'])) {
                $html .= '<div style="font-size:8px;">'.e((string) $slot['signed_at']).'</div>';
            }
            $html .= '</div>';
            $i++;
        }
        $html .= '</div></div></div>';

        return $html;
    }

    /**
     * @param  array<string, mixed>  $el
     */
    private function boxStyle(array $el, bool $absolute): string
    {
        $parts = [
            'left:'.((float) $el['x_mm']).'mm',
            'top:'.((float) $el['y_mm']).'mm',
            'width:'.((float) $el['w_mm']).'mm',
            'height:'.((float) $el['h_mm']).'mm',
            'font-size:'.((float) ($el['font_size'] ?? 10)).'pt',
            'text-align:'.($el['align'] ?? 'left'),
            'padding:'.((float) ($el['padding_mm'] ?? 1)).'mm',
            'overflow:hidden',
        ];
        if ($absolute) {
            $parts[] = 'position:absolute';
        }
        if (! empty($el['bold'])) {
            $parts[] = 'font-weight:bold';
        }
        if (! empty($el['border']) || ($el['type'] ?? '') === 'rectangle') {
            $parts[] = 'border:1px solid #222';
        }

        return implode(';', $parts);
    }

    private function imageBox(string $style, ?string $src, string $align, ?string $title = null): string
    {
        if (! $src) {
            return '<div class="el" style="'.$style.'text-align:'.$align.';"></div>';
        }
        $titleAttr = $title ? ' title="'.e($title).'"' : '';

        return '<div class="el" style="'.$style.'text-align:'.$align.';"><img src="'.e($src).'" alt="Verify purchase order"'.$titleAttr.' style="max-width:100%;max-height:100%;"></div>';
    }

    /**
     * @param  array<string, mixed>  $context
     */
    private function bound(array $context, string $binding, string $mode): string
    {
        if ($mode === 'design') {
            return '{{'.$binding.'}}';
        }
        $parts = explode('.', $binding, 2);
        $root = $parts[0];
        $rest = $parts[1] ?? null;
        if ($root === 'cost_centre') {
            $val = $context['cost_centre'] ?? '';

            return is_scalar($val) ? (string) $val : '';
        }
        if ($root === 'org' || $root === 'po' || $root === 'supplier' || $root === 'project' || $root === 'programme' || $root === 'funding' || $root === 'budget' || $root === 'requisition' || $root === 'procurement' || $root === 'requester') {
            $bucket = $context[$root] ?? [];
            if ($rest === null) {
                return is_scalar($bucket) ? (string) $bucket : '';
            }
            $val = is_array($bucket) ? ($bucket[$rest] ?? '') : '';
            if ($binding === 'po.subtotal') {
                return 'Subtotal  '.(string) $val;
            }
            if ($binding === 'po.vat') {
                return 'VAT  '.(string) $val;
            }
            if ($binding === 'po.total') {
                return 'TOTAL  '.(string) $val;
            }
            if ($binding === 'po.reference') {
                return 'No. '.(string) $val;
            }
            if ($binding === 'budget.code' && $val !== '') {
                return 'Code  '.(string) $val;
            }
            if ($binding === 'requisition.reference' && $val !== '') {
                return 'Requisition  '.(string) $val;
            }

            return is_scalar($val) ? (string) $val : '';
        }

        return '';
    }

    private function escapePreserve(string $value): string
    {
        return nl2br(e($value), false);
    }

    private function css(int $pageW, int $pageH): string
    {
        return <<<CSS
@page { size: {$pageW}mm {$pageH}mm; margin: 0; }
body { font-family: DejaVu Sans, sans-serif; font-size: 10px; color: #111; margin: 0; }
.page { width: {$pageW}mm; min-height: {$pageH}mm; position: relative; }
.header-band { width: 100%; }
.items { border-collapse: collapse; margin-top: 2mm; }
.items th, .items td { border: 1px solid #333; padding: 3px 5px; font-size: 9px; }
.items th { background: #f3f3f3; }
.items thead tr.cont { display: none; }
.items thead:not(:first-child) tr.cont { display: table-row; }
.items tbody tr { page-break-inside: avoid; }
.pending { font-style: italic; color: #666; padding: 8px 0; }
.sig-line { border-bottom: 1px solid #333; height: 22px; margin: 4px 0; }
.approvals { overflow: visible; }
CSS;
    }
}
