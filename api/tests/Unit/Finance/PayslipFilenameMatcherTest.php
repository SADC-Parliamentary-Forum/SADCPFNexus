<?php

namespace Tests\Unit\Finance;

use App\Models\User;
use App\Modules\Finance\Services\PayslipFilenameMatcher;
use Tests\TestCase;

class PayslipFilenameMatcherTest extends TestCase
{
    private PayslipFilenameMatcher $matcher;

    protected function setUp(): void
    {
        parent::setUp();
        $this->matcher = new PayslipFilenameMatcher();
    }

    public function test_extracts_emp_code_and_ignores_year(): void
    {
        $this->assertSame('EMP042', $this->matcher->extractEmployeeNumber('EMP042_August2026.pdf'));
        $this->assertSame('EMP042', $this->matcher->extractEmployeeNumber('emp-042 March 2026.pdf'));
        $this->assertSame('SADC-0042', $this->matcher->extractEmployeeNumber('SADC-0042_payslip.pdf'));
        $this->assertSame('8841', $this->matcher->extractEmployeeNumber('8841-2026-08.pdf'));
        $this->assertNull($this->matcher->extractEmployeeNumber('August2026.pdf'));
    }

    public function test_matches_by_employee_number(): void
    {
        $jane = new User(['name' => 'Jane Doe', 'email' => 'jane@sadcpf.org', 'employee_number' => 'EMP042']);
        $jane->id = 11;
        $john = new User(['name' => 'John Smith', 'email' => 'john@sadcpf.org', 'employee_number' => 'EMP099']);
        $john->id = 12;

        $result = $this->matcher->match('EMP042_August2026.pdf', collect([$jane, $john]));
        $this->assertSame('matched', $result['status']);
        $this->assertSame(11, $result['user']['id']);
    }

    public function test_matches_unique_name_tokens(): void
    {
        $jane = new User(['name' => 'Jane Doe', 'email' => 'jane@sadcpf.org', 'employee_number' => null]);
        $jane->id = 21;
        $john = new User(['name' => 'John Smith', 'email' => 'john@sadcpf.org', 'employee_number' => null]);
        $john->id = 22;

        $result = $this->matcher->match('Jane_Doe_August_2026.pdf', collect([$jane, $john]));
        $this->assertSame('matched', $result['status']);
        $this->assertSame(21, $result['user']['id']);
    }

    public function test_ambiguous_when_two_people_share_tokens(): void
    {
        $a = new User(['name' => 'Ann Lee', 'email' => 'a@sadcpf.org']);
        $a->id = 31;
        $b = new User(['name' => 'Ann', 'email' => 'b@sadcpf.org']);
        $b->id = 32;

        $result = $this->matcher->match('Ann_Lee_August.pdf', collect([$a, $b]));
        $this->assertSame('ambiguous', $result['status']);
        $this->assertNull($result['user']);
        $this->assertCount(2, $result['candidates']);
    }

    public function test_ambiguous_when_employee_number_is_shared(): void
    {
        $a = new User(['name' => 'Jane Doe', 'email' => 'a@sadcpf.org', 'employee_number' => 'EMP042']);
        $a->id = 51;
        $b = new User(['name' => 'John Doe', 'email' => 'b@sadcpf.org', 'employee_number' => 'EMP042']);
        $b->id = 52;

        $result = $this->matcher->match('EMP042_August2026.pdf', collect([$a, $b]));
        $this->assertSame('ambiguous', $result['status']);
        $this->assertNull($result['user']);
        $this->assertCount(2, $result['candidates']);
    }

    public function test_unmatched_when_nothing_fits(): void
    {
        $jane = new User(['name' => 'Jane Doe', 'email' => 'jane@sadcpf.org']);
        $jane->id = 41;
        $result = $this->matcher->match('unknown_file.pdf', collect([$jane]));
        $this->assertSame('unmatched', $result['status']);
    }
}
