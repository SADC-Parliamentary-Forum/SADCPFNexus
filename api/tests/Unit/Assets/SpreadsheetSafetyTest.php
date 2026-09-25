<?php

namespace Tests\Unit\Assets;

use App\Modules\Assets\Reporting\SpreadsheetSafety;
use PHPUnit\Framework\TestCase;

class SpreadsheetSafetyTest extends TestCase
{
    public function test_formula_prefixes_are_escaped(): void
    {
        $this->assertSame("'=cmd", SpreadsheetSafety::formulaSafe('=cmd'));
        $this->assertSame("'+1+1", SpreadsheetSafety::formulaSafe('+1+1'));
        $this->assertSame("'-2", SpreadsheetSafety::formulaSafe('-2'));
        $this->assertSame("'@foo", SpreadsheetSafety::formulaSafe('@foo'));
        $this->assertSame('Dell Latitude', SpreadsheetSafety::formulaSafe('Dell Latitude'));
    }

    public function test_filename_excludes_personal_data_punctuation(): void
    {
        $name = SpreadsheetSafety::filename('User asset statement', 'RW-0001', 'FAR-R02-1', 'pdf');
        $this->assertStringStartsWith('SADC_PF_User_asset_statement_RW_0001_', $name);
        $this->assertStringEndsWith('_FAR_R02_1.pdf', $name);
        $this->assertStringNotContainsString('@', $name);
    }
}
