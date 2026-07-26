<?php

namespace Tests\Feature\Travel;

use Tests\TestCase;

class TravelPhase1PolicyTest extends TestCase
{
    public function test_travel_config_locks(): void
    {
        $this->assertSame('economy', config('travel.default_cabin_class'));
        $this->assertSame(5, config('travel.retirement_working_days'));
        $this->assertSame(8.0, (float) config('travel.toil_hours_per_day'));
        $this->assertSame(30, config('travel.toil_expiry_days'));
        $this->assertFalse(config('travel.auto_create_leave_from_travel'));
        $this->assertTrue(config('travel.auto_generate_candidates'));
    }
}
