<?php

namespace Tests\Unit\Assets;

use App\Modules\Assets\Import\AssetDescriptionParser;
use PHPUnit\Framework\TestCase;

class AssetDescriptionParserTest extends TestCase
{
    /** Descriptions as they appear in the 31 March 2026 FAR listing. */
    public function test_serial_is_captured_however_the_far_writes_it(): void
    {
        $parser = new AssetDescriptionParser;

        $this->assertSame('CNCGB22289', $parser->parse('HP Laser Jet Printer P2055dn S/N CNCGB22289')['serial']);
        $this->assertSame('CNC0G1805', $parser->parse('HP Laser Jet Printer P2055dn S/NCNC0G1805')['serial']);
        $this->assertSame('5CD138H3TX', $parser->parse('Laptop - HP 15s i7 1165g S/N: 5CD138H3TX')['serial']);
        $this->assertSame('5CD144HSKY', $parser->parse('HP 15s i5 Laptop - Ser.No. 5CD144HSKY')['serial']);
        $this->assertSame('011651', $parser->parse('Karcher Upright Vac. Cleaner - S/N: 011651')['serial']);
    }

    public function test_model_leaves_out_serial_assignee_and_trailing_laptop(): void
    {
        $parser = new AssetDescriptionParser;

        $this->assertSame('Laser Jet Printer P2055dn', $parser->parse('HP Laser Jet Printer P2055dn S/N CNCGB22289')['model']);
        $this->assertSame('Inspiron 13-7359', $parser->parse('Dell Inspiron 13-7359 Laptop S/N 1F70N52')['model']);
        $this->assertSame('Vostro 5490', $parser->parse('Dell Vostro 5490 - Laptop for Ms. L. Boois')['model']);
        $this->assertSame('Vostro 5490-10th Gen Intel i5', $parser->parse('Dell Vostro 5490-10th Gen Intel i5 Laptop-Ms. P. Kanguatjivi')['model']);
        $this->assertSame('Elitebook X360 830 G10 I5 13 16GB', $parser->parse('HP Elitebook X360 830 G10 I5 13 16GB Laptop - S. Bokosi')['model']);
        $this->assertSame('Probook X360 435 G10 Ryzen 5 7530', $parser->parse('HP Probook X360 435 G10 Ryzen 5 7530 Laptop - MM')['model']);
        $this->assertSame('ZBOOK FIREFLY 14 G11', $parser->parse('HP ZBOOK FIREFLY 14 G11 - Laptop - Dr. J. Segale')['model']);
        $this->assertSame('15s i5', $parser->parse('HP 15s i5 Laptop - Ser.No. 5CD144HSKY')['model']);
        $this->assertSame('WorkCentre 3210 Printer', $parser->parse('XEROX WorkCentre 3210 Printer S/N 3247672884')['model']);
        $this->assertSame('BizHub C253 colour copier/printer BPI', $parser->parse('Konica Minolta-BizHub C253 colour copier/printer BPI')['model']);
        $this->assertSame('Konica Minolta', $parser->parse('Konica Minolta-BizHub C253 colour copier/printer BPI')['make']);
    }

    public function test_a_bare_item_kind_is_not_a_model(): void
    {
        $this->assertNull((new AssetDescriptionParser)->parse('Dell Laptop S/N 6CGK2X1')['model']);
    }

    public function test_without_serial_strips_only_the_serial_segment(): void
    {
        $parser = new AssetDescriptionParser;

        $this->assertSame('Dell Laptop', $parser->withoutSerial('Dell Laptop S/N 6CGK2X1'));
        $this->assertSame('HP Laser Jet Printer P2055dn', $parser->withoutSerial('HP Laser Jet Printer P2055dn S/NCNC0G1805'));
        $this->assertSame('HP 15s i5 Laptop', $parser->withoutSerial('HP 15s i5 Laptop - Ser.No. 5CD144HSKY'));
        $this->assertSame('Laptop - HP 15s i7 1165g', $parser->withoutSerial('Laptop - HP 15s i7 1165g S/N: 5CD138H3TX'));
        $this->assertSame('Paula visitor side chairs', $parser->withoutSerial('Paula visitor side chairs'));
    }
}
