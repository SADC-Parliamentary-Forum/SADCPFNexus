<?php

namespace Tests\Unit;

use App\Models\Asset;
use Carbon\Carbon;
use Tests\TestCase;

class AssetDecliningBalanceNbvTest extends TestCase
{
    public function test_straight_line_nbv_unchanged(): void
    {
        Carbon::setTestNow('2028-01-01 12:00:00');
        $ref = Carbon::parse('2026-01-01');

        $nbv = Asset::computeDepreciatedValue(10000, 5, 1000, $ref, 'straight_line');

        // 2 years elapsed: 1000 + 9000 * (1 - 2/5) = 1000 + 5400 = 6400
        $this->assertEqualsWithDelta(6400.0, $nbv, 5.0);
    }

    public function test_declining_balance_matches_double_declining_ui_formula(): void
    {
        Carbon::setTestNow('2028-01-01 12:00:00');
        $ref = Carbon::parse('2026-01-01');

        // rate = 2/5 = 0.4; yearsElapsed ≈ 2; NBV = max(1000, 10000 * 0.6^2) = 3600
        $nbv = Asset::computeDepreciatedValue(10000, 5, 1000, $ref, 'declining_balance');

        $this->assertEqualsWithDelta(3600.0, $nbv, 5.0);
    }

    public function test_declining_balance_never_falls_below_salvage(): void
    {
        Carbon::setTestNow('2035-01-01 12:00:00');
        $ref = Carbon::parse('2026-01-01');

        $nbv = Asset::computeDepreciatedValue(10000, 5, 2000, $ref, 'declining_balance');

        $this->assertSame(2000.0, $nbv);
    }

    public function test_default_method_is_straight_line_for_backward_compatibility(): void
    {
        Carbon::setTestNow('2027-01-01 12:00:00');
        $ref = Carbon::parse('2026-01-01');

        $withDefault = Asset::computeDepreciatedValue(12000, 4, 0, $ref);
        $explicit = Asset::computeDepreciatedValue(12000, 4, 0, $ref, 'straight_line');

        $this->assertSame($explicit, $withDefault);
        $this->assertEqualsWithDelta(9000.0, $withDefault, 5.0);
    }
}
