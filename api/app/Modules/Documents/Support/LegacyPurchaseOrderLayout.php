<?php

namespace App\Modules\Documents\Support;

final class LegacyPurchaseOrderLayout
{
    /**
     * Millimetre layout that recreates the institutional SADC PF LPO (S04015)
     * without dollar/cents columns.
     *
     * @return array{page: array<string, mixed>, elements: list<array<string, mixed>>}
     */
    public static function layout(): array
    {
        return PurchaseOrderLayoutSanitizer::sanitize([
            'page' => [
                'size' => 'A4',
                'orientation' => 'portrait',
                'margin_mm' => ['top' => 12, 'right' => 12, 'bottom' => 14, 'left' => 12],
            ],
            'elements' => [
                ['id' => 'org-name', 'type' => 'org_name', 'binding' => 'org.name', 'x_mm' => 12, 'y_mm' => 10, 'w_mm' => 130, 'h_mm' => 8, 'font_size' => 13, 'bold' => true],
                ['id' => 'org-addr', 'type' => 'org_address', 'binding' => 'org.address', 'x_mm' => 12, 'y_mm' => 18, 'w_mm' => 130, 'h_mm' => 16, 'font_size' => 8],
                ['id' => 'logo', 'type' => 'logo', 'binding' => 'org.logo', 'x_mm' => 168, 'y_mm' => 8, 'w_mm' => 30, 'h_mm' => 24],
                ['id' => 'heading', 'type' => 'heading', 'text' => 'PURCHASE ORDER', 'x_mm' => 12, 'y_mm' => 42, 'w_mm' => 110, 'h_mm' => 10, 'font_size' => 16, 'bold' => true],
                ['id' => 'po-no', 'type' => 'field', 'binding' => 'po.reference', 'x_mm' => 130, 'y_mm' => 42, 'w_mm' => 68, 'h_mm' => 10, 'font_size' => 12, 'bold' => true, 'align' => 'right'],
                ['id' => 'to-box', 'type' => 'rectangle', 'x_mm' => 12, 'y_mm' => 56, 'w_mm' => 108, 'h_mm' => 36, 'border' => true],
                ['id' => 'to-label', 'type' => 'text', 'text' => 'TO', 'x_mm' => 14, 'y_mm' => 57, 'w_mm' => 30, 'h_mm' => 5, 'font_size' => 8, 'bold' => true],
                ['id' => 'supplier-name', 'type' => 'field', 'binding' => 'supplier.name', 'x_mm' => 14, 'y_mm' => 63, 'w_mm' => 102, 'h_mm' => 6, 'font_size' => 10, 'bold' => true],
                ['id' => 'supplier-addr', 'type' => 'field', 'binding' => 'supplier.address', 'x_mm' => 14, 'y_mm' => 69, 'w_mm' => 102, 'h_mm' => 12, 'font_size' => 8],
                ['id' => 'supplier-phone', 'type' => 'field', 'binding' => 'supplier.phone', 'x_mm' => 14, 'y_mm' => 82, 'w_mm' => 102, 'h_mm' => 6, 'font_size' => 8],
                ['id' => 'date-box', 'type' => 'rectangle', 'x_mm' => 124, 'y_mm' => 56, 'w_mm' => 74, 'h_mm' => 16, 'border' => true],
                ['id' => 'date-label', 'type' => 'text', 'text' => 'DATE', 'x_mm' => 126, 'y_mm' => 57, 'w_mm' => 70, 'h_mm' => 5, 'font_size' => 8, 'bold' => true],
                ['id' => 'po-date', 'type' => 'field', 'binding' => 'po.issue_date', 'x_mm' => 126, 'y_mm' => 63, 'w_mm' => 70, 'h_mm' => 6, 'font_size' => 10],
                ['id' => 'project-box', 'type' => 'rectangle', 'x_mm' => 124, 'y_mm' => 74, 'w_mm' => 74, 'h_mm' => 18, 'border' => true],
                ['id' => 'project-label', 'type' => 'text', 'text' => 'PROJECT', 'x_mm' => 126, 'y_mm' => 75, 'w_mm' => 70, 'h_mm' => 5, 'font_size' => 8, 'bold' => true],
                ['id' => 'project-name', 'type' => 'field', 'binding' => 'project.name', 'x_mm' => 126, 'y_mm' => 81, 'w_mm' => 70, 'h_mm' => 8, 'font_size' => 10],
                ['id' => 'items', 'type' => 'table', 'binding' => 'po.items', 'x_mm' => 12, 'y_mm' => 98, 'w_mm' => 186, 'h_mm' => 70, 'columns' => ['qty', 'description', 'unit_price', 'line_total'], 'flow' => true],
                ['id' => 'budget-code', 'type' => 'field', 'binding' => 'budget.code', 'x_mm' => 12, 'y_mm' => 172, 'w_mm' => 90, 'h_mm' => 8, 'font_size' => 9],
                ['id' => 'requisition', 'type' => 'field', 'binding' => 'requisition.reference', 'x_mm' => 12, 'y_mm' => 180, 'w_mm' => 90, 'h_mm' => 8, 'font_size' => 9],
                ['id' => 'subtotal', 'type' => 'field', 'binding' => 'po.subtotal', 'x_mm' => 130, 'y_mm' => 172, 'w_mm' => 68, 'h_mm' => 7, 'align' => 'right', 'border' => true],
                ['id' => 'vat', 'type' => 'field', 'binding' => 'po.vat', 'x_mm' => 130, 'y_mm' => 180, 'w_mm' => 68, 'h_mm' => 7, 'align' => 'right', 'border' => true],
                ['id' => 'total', 'type' => 'field', 'binding' => 'po.total', 'x_mm' => 130, 'y_mm' => 188, 'w_mm' => 68, 'h_mm' => 8, 'align' => 'right', 'bold' => true, 'border' => true],
                ['id' => 'approvals', 'type' => 'approval_block', 'binding' => 'workflow.approvals', 'layout' => 'horizontal', 'x_mm' => 12, 'y_mm' => 210, 'w_mm' => 186, 'h_mm' => 48],
                ['id' => 'qr', 'type' => 'qr', 'x_mm' => 178, 'y_mm' => 268, 'w_mm' => 18, 'h_mm' => 18],
                ['id' => 'footer', 'type' => 'footer', 'x_mm' => 12, 'y_mm' => 272, 'w_mm' => 160, 'h_mm' => 10, 'font_size' => 7],
            ],
        ]);
    }
}
