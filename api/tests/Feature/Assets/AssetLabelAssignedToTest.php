<?php

namespace Tests\Feature\Assets;

use App\Models\AssetLabelTemplate;
use App\Modules\Assets\Services\AssetLabelService;
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

    public function test_serial_line_prints_when_the_asset_has_a_serial(): void
    {
        $this->assertStringContainsString('S/N: 6CGK2X1', $this->render(null, '6CGK2X1', 'serial'));
    }

    public function test_label_name_drops_a_serial_that_already_prints_on_its_own_line(): void
    {
        $this->assertSame('Dell Laptop', AssetLabelService::nameForLabel('Dell Laptop S/N 6CGK2X1', '6CGK2X1'));
        $this->assertSame('HP 15s i5 Laptop', AssetLabelService::nameForLabel('HP 15s i5 Laptop - 5CD144HSKY', '5CD144HSKY'));
        $this->assertSame('Printer', AssetLabelService::nameForLabel('Printer (CNC0G1805)', 'cnc0g1805'));
        $this->assertSame('Dell Latitude 5490', AssetLabelService::nameForLabel('Dell Latitude 5490', null));
        $this->assertSame('ABC123', AssetLabelService::nameForLabel('ABC123', 'ABC123'));
    }

    public function test_serial_line_is_left_off_when_there_is_no_serial(): void
    {
        $this->assertStringNotContainsString('S/N', $this->render(null, null, 'serial'));
        $this->assertStringNotContainsString('S/N', $this->render(null, '', 'serial'));
    }
}
