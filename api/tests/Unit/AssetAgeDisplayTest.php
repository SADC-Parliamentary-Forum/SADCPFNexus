<?php

namespace Tests\Unit;

use App\Models\Asset;
use Carbon\Carbon;
use Tests\TestCase;

class AssetAgeDisplayTest extends TestCase
{
    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_age_display_does_not_throw_when_issued_today(): void
    {
        Carbon::setTestNow('2026-08-26 00:25:08');

        $asset = new Asset;
        $asset->issued_at = '2026-08-26';

        $this->assertSame('Less than 1 month', $asset->age_display);
        $this->assertSame(0, $asset->age_years);
    }

    public function test_age_display_formats_whole_years_and_months(): void
    {
        Carbon::setTestNow('2028-04-15 12:00:00');

        $asset = new Asset;
        $asset->purchase_date = '2026-01-15';

        $this->assertSame('2 year(s) 3 month(s)', $asset->age_display);
        $this->assertSame(2, $asset->age_years);
    }
}
