<?php

namespace Tests\Feature\Finance;

use App\Models\Tenant;
use App\Modules\Finance\Services\NullPayrollVendorAdapter;
use App\Modules\Finance\Services\VendorPayrollAdapterFactory;
use Tests\TestCase;

class VendorPayrollAdapterTest extends TestCase
{
    public function test_null_adapter_maps_present_fields_only(): void
    {
        $adapter = new NullPayrollVendorAdapter();
        $lines = $adapter->importPayslips([
            'lines' => [
                ['employee_number' => 'E1', 'gross' => 1000, 'net' => 800],
                ['employee_number' => 'E2', 'period' => '2026-07'],
            ],
        ]);

        $this->assertSame('E1', $lines[0]['employee_number']);
        $this->assertSame(1000.0, $lines[0]['gross']);
        $this->assertNull($lines[0]['deductions']);
        $this->assertSame('E2', $lines[1]['employee_number']);
        $this->assertNull($lines[1]['gross']);
    }

    public function test_import_endpoint_stages_draft_batch(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        config(['payroll_vendor.driver' => 'null']);

        $res = $http->postJson('/api/v1/finance/payroll/imports', [
            'period' => '2026-07',
            'lines' => [
                [
                    'employee_number' => 'EMP-1',
                    'gross' => 5000,
                    'deductions' => 500,
                    'net' => 4500,
                    'external_ref' => 'V-1',
                ],
            ],
        ])->assertCreated()->json('data');

        $this->assertSame('draft', $res['status']);
        $this->assertSame(1, (int) $res['line_count']);

        $http->postJson('/api/v1/finance/payroll/imports/'.$res['id'].'/stage')
            ->assertOk()
            ->assertJsonPath('data.status', 'staged');

        $this->assertSame('null', app(VendorPayrollAdapterFactory::class)->make()->driver());
    }
}
