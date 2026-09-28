<?php

namespace Tests\Unit\Hr;

use App\Modules\Hr\Import\Parsers\SageVipLeaveBasicParser;
use App\Modules\Hr\Import\Parsers\SageVipLeaveHistoryParser;
use App\Modules\Hr\Import\Parsers\SageVipLeaveProvisionParser;
use PHPUnit\Framework\TestCase;

class SageVipLeaveParsersTest extends TestCase
{
    public function test_leave_basic_parser_preserves_negative_balances(): void
    {
        $parser = new SageVipLeaveBasicParser;
        $rows = $parser->parseText(
            '2078-300          Ms D Engelbrecht   COPEN_LV                 0.0000       -1.0000     0.0000      0.0000   -1.0000'
        );

        $this->assertCount(1, $rows);
        $this->assertSame('COPEN_LV', $rows[0]['leave_code']);
        $this->assertEqualsWithDelta(-1.0, $rows[0]['balance_bf'], 0.0001);
        $this->assertEqualsWithDelta(-1.0, $rows[0]['balance_cf'], 0.0001);
    }

    public function test_leave_history_parser_preserves_negative_values(): void
    {
        $parser = new SageVipLeaveHistoryParser;
        $rows = $parser->parseText(
            "2078-300 - Ms D Engelbrecht COPEN_LV - Compensatory Leave -1.0000 0.0000 0.0000 0.0000 -1.0000"
        );

        $this->assertCount(1, $rows);
        $this->assertEqualsWithDelta(-1.0, $rows[0]['start'], 0.0001);
        $this->assertEqualsWithDelta(-1.0, $rows[0]['end'], 0.0001);
    }

    public function test_leave_provision_parser_handles_real_report_column_count(): void
    {
        // Previously the parser only expected 6 trailing numeric columns; the real report has
        // 10 (Entitlement, Balance B/F, Accrued, Taken, Leave Movement, Termination Payout Rate,
        // Termination Payout, Normal Payout Rate, Normal Payout, Balance C/F), several negative,
        // with thousands separators — so it matched zero rows ever.
        $parser = new SageVipLeaveProvisionParser;
        $rows = $parser->parseText(
            '2107-300 Mr S Kurasha 30.0000 13.0000 2.5000 5.0000 -2.5000 4,223.47 -10,558.67 0.00 0.00 10.5000'
        );

        $this->assertCount(1, $rows);
        $this->assertSame('2107-300', $rows[0]['employee_code']);
        $this->assertEqualsWithDelta(-2.5, $rows[0]['leave_movement'], 0.0001);
        $this->assertEqualsWithDelta(4223.47, $rows[0]['termination_payout_rate'], 0.0001);
        $this->assertEqualsWithDelta(-10558.67, $rows[0]['termination_payout'], 0.0001);
        $this->assertEqualsWithDelta(10.5, $rows[0]['balance_cf'], 0.0001);
    }
}
