<?php

namespace Tests\Feature\Hr;

use App\Models\Asset;
use App\Models\HrVipImportBatch;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class HrVipImportTest extends TestCase
{
    private string $uploadDir;

    protected function setUp(): void
    {
        parent::setUp();
        $this->uploadDir = '/home/ubuntu/.cursor/projects/workspace/uploads';
    }

    public function test_leave_basic_parser_fixture(): void
    {
        $text = file_get_contents(base_path('tests/Fixtures/HrVip/leave_basic_snippet.txt'));
        $parser = new \App\Modules\Hr\Import\Parsers\SageVipLeaveBasicParser;
        $rows = $parser->parseText((string) $text);
        $this->assertCount(2, $rows);
        $this->assertSame('2078-300', $rows[1]['employee_code']);
        $this->assertEqualsWithDelta(13.6690, $rows[1]['balance_cf'], 0.0001);
    }

    public function test_preview_blocks_unknown_employee_codes_in_leave(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asHrManager($tenant);

        $batch = HrVipImportBatch::create([
            'tenant_id' => $tenant->id,
            'created_by' => User::factory()->create(['tenant_id' => $tenant->id])->id,
            'batch_number' => 'TEST-1',
            'status' => HrVipImportBatch::STATUS_STAGED,
            'staged' => [
                'employees' => [['employee_code' => '2078-300', 'display_name' => 'Ms D Engelbrecht']],
                'leave_balances' => [['employee_code' => '9999-300', 'leave_code' => 'ANN_LVE', 'balance_cf' => 1]],
                'leave_transactions' => [],
                'payslips' => [],
            ],
        ]);

        $http->getJson("/api/v1/hr/imports/{$batch->id}/preview")
            ->assertOk()
            ->assertJsonPath('data.blocking_errors.0.employee_code', '9999-300');
    }

    public function test_wipe_keeps_asset_register(): void
    {
        $tenant = Tenant::factory()->create();
        Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'KEEP-'.$tenant->id,
            'tag_number' => 'TAG-'.$tenant->id,
            'name' => 'Laptop',
            'category' => 'ICT',
            'status' => 'available',
        ]);

        $exit = Artisan::call('tenant:wipe-transactional-data', [
            '--tenant' => $tenant->id,
            '--database' => config('database.connections.pgsql.database'),
            '--skip-backup' => true,
            '--force' => true,
        ]);

        $this->assertSame(0, $exit);
        $this->assertSame(1, Asset::query()->where('tenant_id', $tenant->id)->count());
    }

    public function test_full_pack_staging_when_uploads_present(): void
    {
        if (! is_dir($this->uploadDir)) {
            $this->markTestSkipped('VIP upload pack not available in this environment.');
        }

        $tenant = Tenant::factory()->create();
        [$http] = $this->asHrManager($tenant);

        $files = [];
        foreach (scandir($this->uploadDir) ?: [] as $name) {
            if (! str_ends_with(strtolower($name), '.pdf') && ! str_ends_with(strtolower($name), '.xls')) {
                continue;
            }
            $path = $this->uploadDir.'/'.$name;
            $files[] = new UploadedFile($path, $name, mime_content_type($path) ?: null, null, true);
        }

        $response = $http->post('/api/v1/hr/imports', ['files' => $files], ['Accept' => 'application/json']);
        $response->assertCreated();
        $preview = $response->json('data.preview');
        $this->assertGreaterThanOrEqual(10, $preview['employee_count'] ?? 0);
        $this->assertGreaterThan(500, $preview['leave_transaction_count'] ?? 0);
        $this->assertGreaterThanOrEqual(10, $preview['payslip_count'] ?? 0);
    }

    public function test_commit_creates_employee_and_payslip_from_snippets(): void
    {
        $tenant = Tenant::factory()->create();
        $hr = $this->asHrManager($tenant)[1];

        $service = app(\App\Modules\Hr\Import\HrVipImportService::class);
        $batch = $service->createBatch($hr);
        $batch->update([
            'status' => HrVipImportBatch::STATUS_STAGED,
            'staged' => [
                'employees' => [
                    ['employee_code' => '2078-300', 'display_name' => 'Ms D Engelbrecht', 'birth_date' => '1970-08-30'],
                ],
                'leave_balances' => [
                    ['employee_code' => '2078-300', 'leave_code' => 'ANN_LVE', 'balance_cf' => 13.6690],
                ],
                'leave_transactions' => [],
                'leave_history' => [],
                'leave_provision' => [],
                'payslips' => [
                    [
                        'employee_code' => '2078-300',
                        'period_end' => '2026-09-30',
                        'gross_pay' => 10000,
                        'net_pay' => 8000,
                        'earnings' => [],
                        'deductions' => [],
                    ],
                ],
                'remuneration' => [],
                'twelve_month' => [],
            ],
        ]);

        $service->commit($batch, $hr);

        $user = User::query()->where('tenant_id', $tenant->id)->where('employee_number', '2078-300')->first();
        $this->assertNotNull($user);
        $this->assertDatabaseHas('payslips', ['user_id' => $user->id, 'period_year' => 2026, 'period_month' => 9]);
        $this->assertDatabaseHas('leave_balances', ['user_id' => $user->id, 'period_year' => 2026]);
    }
}
