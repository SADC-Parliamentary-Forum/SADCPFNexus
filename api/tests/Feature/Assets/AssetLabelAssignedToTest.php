<?php

namespace Tests\Feature\Assets;

use App\Models\AssetLabelTemplate;
use Illuminate\Foundation\Testing\TestCase;

/** Renders the label view only, so it skips the base TestCase's database refresh. */
class AssetLabelAssignedToTest extends TestCase
{
    private function render(?string $assignee, ?string $serial = null, string $field = 'custodian'): string
    {
        $template = new AssetLabelTemplate([
            'page_width_mm' => 210, 'page_height_mm' => 297,
            'label_width_mm' => 63.5, 'label_height_mm' => 38.1,
            'rows' => 1, 'columns' => 1, 'font_pt' => 8,
            'margin_top_mm' => 0, 'margin_left_mm' => 0, 'h_gap_mm' => 0, 'v_gap_mm' => 0,
        ]);

        return view('pdf.asset_labels', [
            'template' => $template,
            'labels' => [[
                'asset_tag' => 'SADC-0001', 'name' => 'Laptop', 'model' => null, 'serial' => $serial,
                'location' => null, 'custodian' => $assignee, 'owner' => null,
                'scan_hint' => null, 'qr_base64' => '',
            ]],
            'batch' => null,
            'layoutItems' => [['id' => $field, 'visible' => true, 'x_mm' => 1, 'y_mm' => 1, 'w_mm' => 40, 'h_mm' => 4]],
        ])->render();
    }

    public function test_label_prints_assigned_to_with_the_assignee_name(): void
    {
        $html = $this->render('Jane Doe');

        $this->assertStringContainsString('Assigned to: Jane Doe', $html);
        $this->assertStringNotContainsString('Custodian:', $html);
    }

    public function test_label_omits_the_line_when_nobody_is_assigned(): void
    {
        $this->assertStringNotContainsString('Assigned to:', $this->render(null));
    }

    public function test_serial_line_always_prints(): void
    {
        $this->assertStringContainsString('S/N: 6CGK2X1', $this->render(null, '6CGK2X1', 'serial'));
        $this->assertStringContainsString('S/N: —', $this->render(null, null, 'serial'));
    }
}
