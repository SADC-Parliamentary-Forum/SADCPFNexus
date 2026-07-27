<?php

namespace Tests\Unit;

use App\Modules\Leave\Services\LeavePolicyService;
use App\Modules\Leave\Services\LeaveSickLeaveService;
use PHPUnit\Framework\TestCase;

class LeaveSickPayTierTest extends TestCase
{
    private function service(): LeaveSickLeaveService
    {
        return new LeaveSickLeaveService($this->createStub(LeavePolicyService::class));
    }

    public function test_crossing_full_pay_threshold_splits_into_full_and_half_pay(): void
    {
        $classification = $this->service()->classifyPayTreatment(59, 2);

        $this->assertSame('mixed', $classification['pay_treatment']);
        $this->assertSame([
            ['pay_treatment' => 'full_pay', 'days' => 1.0],
            ['pay_treatment' => 'half_pay', 'days' => 1.0],
        ], $classification['allocations']);
    }

    public function test_after_half_pay_threshold_classifies_as_unpaid(): void
    {
        $classification = $this->service()->classifyPayTreatment(120, 3);

        $this->assertSame('unpaid', $classification['pay_treatment']);
        $this->assertSame([
            ['pay_treatment' => 'unpaid', 'days' => 3.0],
        ], $classification['allocations']);
    }

    public function test_large_request_can_span_all_three_sick_pay_tiers(): void
    {
        $classification = $this->service()->classifyPayTreatment(58, 65);

        $this->assertSame('mixed', $classification['pay_treatment']);
        $this->assertSame([
            ['pay_treatment' => 'full_pay', 'days' => 2.0],
            ['pay_treatment' => 'half_pay', 'days' => 60.0],
            ['pay_treatment' => 'unpaid', 'days' => 3.0],
        ], $classification['allocations']);
    }
}
