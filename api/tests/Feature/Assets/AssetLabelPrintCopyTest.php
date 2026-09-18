<?php

namespace Tests\Feature\Assets;

use Tests\TestCase;

class AssetLabelPrintCopyTest extends TestCase
{
    /**
     * @return array<string, mixed>
     */
    private function template(): object
    {
        return (object) [
            'page_width_mm' => 210,
            'label_width_mm' => 63.5,
            'label_height_mm' => 46.6,
            'h_gap_mm' => 2.5,
            'v_gap_mm' => 0,
            'font_pt' => 8,
            'rows' => 1,
            'columns' => 1,
            'margin_top_mm' => 0,
            'margin_left_mm' => 0,
        ];
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function label(array $overrides = []): array
    {
        return array_merge([
            'asset_tag' => 'CE-4242',
            'name' => 'Laptop',
            'model' => null,
            'serial' => null,
            'location' => null,
            'custodian' => null,
            'owner' => 'SADC Parliamentary Forum',
            'recovery_phone' => null,
            'recovery_email' => null,
            'scan_hint' => 'Scan for current information',
            'qr_base64' => base64_encode('qr'),
        ], $overrides);
    }

    /**
     * @return list<array{id: string, x_mm: float, y_mm: float, w_mm: float, h_mm: float, visible: bool}>
     */
    private function layoutWithCustodian(): array
    {
        return [
            ['id' => 'tag', 'x_mm' => 1.5, 'y_mm' => 8.0, 'w_mm' => 40.0, 'h_mm' => 4.8, 'visible' => true],
            ['id' => 'custodian', 'x_mm' => 1.5, 'y_mm' => 32.6, 'w_mm' => 40.0, 'h_mm' => 3.2, 'visible' => true],
        ];
    }

    public function test_printed_label_reads_assigned_to_instead_of_custodian(): void
    {
        $html = view('pdf.asset_labels', [
            'template' => $this->template(),
            'labels' => [$this->label(['custodian' => 'Jane Doe'])],
            'layoutItems' => $this->layoutWithCustodian(),
        ])->render();

        $this->assertStringContainsString('Assigned to: Jane Doe', $html);
        $this->assertStringNotContainsString('Custodian:', $html);
        $this->assertStringNotContainsString('Custodian', $html);
    }

    public function test_printed_label_omits_assigned_to_when_nobody_is_assigned(): void
    {
        $html = view('pdf.asset_labels', [
            'template' => $this->template(),
            'labels' => [$this->label(['custodian' => null])],
            'layoutItems' => $this->layoutWithCustodian(),
        ])->render();

        $this->assertStringContainsString('CE-4242', $html);
        $this->assertStringNotContainsString('Assigned to:', $html);
        $this->assertStringNotContainsString('Custodian:', $html);
        $this->assertStringNotContainsString('Jane Doe', $html);
    }
}
