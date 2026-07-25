<?php

namespace Tests\Feature\Procurement;

use Tests\TestCase;

class ProcurementThresholdConfigTest extends TestCase
{
    public function test_default_thresholds_match_sadc_pf_core_policy_bands(): void
    {
        $this->assertSame(10_000.0, (float) config('procurement.direct_purchase_limit'));
        $this->assertSame(100_000.0, (float) config('procurement.quotation_limit'));
        $this->assertSame(100_000.0, (float) config('procurement.tender_threshold'));
        $this->assertSame(3, (int) config('procurement.minimum_quotes_required'));
        $this->assertSame(30, (int) config('procurement.split_lookback_days'));
    }
}
