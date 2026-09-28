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

    public function test_preview_reports_legacy_candidates_without_blocking(): void
    {
        // A code referenced only in leave/payroll data (absent from the employee master) must
        // not block the whole historical batch — it becomes a reviewed legacy profile on commit.
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
            ->assertJsonPath('data.blocking_errors', [])
            ->assertJsonPath('data.legacy_profile_candidates.0.employee_code', '9999-300')
            ->assertJsonPath('data.ready', true);
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

    public function test_old_termination_employee_is_imported_with_login_disabled_not_dropped(): void
    {
        $tenant = Tenant::factory()->create();
        $hr = $this->asHrManager($tenant)[1];

        $service = app(\App\Modules\Hr\Import\HrVipImportService::class);
        $batch = $service->createBatch($hr);
        $batch->update([
            'status' => HrVipImportBatch::STATUS_STAGED,
            'staged' => [
                'employees' => [
                    [
                        'employee_code' => 'SAD010',
                        'display_name' => 'Mr LM Mabuku',
                        'employment_status' => ['active' => false, 'terminated' => false, 'old_termination' => true],
                    ],
                ],
                'leave_balances' => [['employee_code' => 'SAD010', 'leave_code' => 'ANN_LVE', 'entitlement' => 20, 'balance_bf' => 58.6681, 'accrued' => 0, 'taken' => 0, 'balance_cf' => 58.6681]],
                'leave_transactions' => [],
                'leave_history' => [],
                'leave_provision' => [],
                'payslips' => [],
                'remuneration' => [],
                'twelve_month' => [],
            ],
        ]);

        $service->commit($batch, $hr);

        $user = User::query()->where('tenant_id', $tenant->id)->where('employee_number', 'SAD010')->first();
        $this->assertNotNull($user, 'Old-termination employee must still be imported, not dropped.');
        $this->assertFalse($user->is_active);
        $this->assertSame(User::STATUS_DISABLED, $user->account_status);
        $this->assertDatabaseHas('hr_personal_files', ['employee_id' => $user->id, 'employment_status' => 'terminated']);
    }

    public function test_unmatched_historical_code_creates_reviewed_legacy_profile(): void
    {
        $tenant = Tenant::factory()->create();
        $hr = $this->asHrManager($tenant)[1];

        $service = app(\App\Modules\Hr\Import\HrVipImportService::class);
        $batch = $service->createBatch($hr);
        $batch->update([
            'status' => HrVipImportBatch::STATUS_STAGED,
            'staged' => [
                'employees' => [],
                'leave_balances' => [],
                'leave_transactions' => [
                    ['employee_code' => 'SAD016', 'leave_type' => 'ANN_LVE', 'from_date' => '2010-01-28', 'to_date' => '2010-01-29', 'taken_days' => 1, 'ref_no' => 'E000016-T0001-N1'],
                ],
                'leave_history' => [],
                'leave_provision' => [],
                'payslips' => [],
                'remuneration' => [],
                'twelve_month' => [],
            ],
        ]);

        $summary = $service->commit($batch, $hr)->commit_summary;

        $user = User::query()->where('tenant_id', $tenant->id)->where('employee_number', 'SAD016')->first();
        $this->assertNotNull($user, 'A code referenced only in leave data must still get an employee record.');
        $this->assertDatabaseHas('hr_personal_files', ['employee_id' => $user->id, 'employment_status' => 'historical_only', 'file_status' => 'legacy_review']);
        $this->assertGreaterThanOrEqual(1, $summary['legacy_profiles_created'] ?? 0);
    }

    public function test_leave_type_mapping_preserves_distinct_types(): void
    {
        $tenant = Tenant::factory()->create();
        $hr = $this->asHrManager($tenant)[1];

        $service = app(\App\Modules\Hr\Import\HrVipImportService::class);
        $batch = $service->createBatch($hr);
        $batch->update([
            'status' => HrVipImportBatch::STATUS_STAGED,
            'staged' => [
                'employees' => [['employee_code' => '2109-300', 'display_name' => 'Mr R Windwaai']],
                'leave_balances' => [],
                'leave_transactions' => [
                    ['employee_code' => '2109-300', 'leave_type' => 'COMP_LVE', 'from_date' => '2020-01-01', 'to_date' => '2020-01-01', 'taken_days' => 1, 'ref_no' => 'REF-COMP'],
                    ['employee_code' => '2109-300', 'leave_type' => 'COPEN_LV', 'from_date' => '2020-02-01', 'to_date' => '2020-02-01', 'taken_days' => 1, 'ref_no' => 'REF-COPEN'],
                    ['employee_code' => '2109-300', 'leave_type' => 'PAT_LVE', 'from_date' => '2020-03-01', 'to_date' => '2020-03-01', 'taken_days' => 1, 'ref_no' => 'REF-PAT'],
                ],
                'leave_history' => [],
                'leave_provision' => [],
                'payslips' => [],
                'remuneration' => [],
                'twelve_month' => [],
            ],
        ]);

        $service->commit($batch, $hr);

        $user = User::query()->where('tenant_id', $tenant->id)->where('employee_number', '2109-300')->first();
        $this->assertDatabaseHas('leave_requests', ['requester_id' => $user->id, 'leave_type' => 'compassionate']);
        $this->assertDatabaseHas('leave_requests', ['requester_id' => $user->id, 'leave_type' => 'compensatory']);
        $this->assertDatabaseHas('leave_requests', ['requester_id' => $user->id, 'leave_type' => 'paternity']);
    }

    public function test_reimporting_same_leave_transaction_does_not_duplicate(): void
    {
        $tenant = Tenant::factory()->create();
        $hr = $this->asHrManager($tenant)[1];

        $service = app(\App\Modules\Hr\Import\HrVipImportService::class);
        $staged = [
            'employees' => [['employee_code' => '2109-300', 'display_name' => 'Mr R Windwaai']],
            'leave_balances' => [],
            'leave_transactions' => [
                ['employee_code' => '2109-300', 'leave_type' => 'ANN_LVE', 'from_date' => '2020-01-01', 'to_date' => '2020-01-01', 'taken_days' => 1, 'ref_no' => 'REF-DUP'],
            ],
            'leave_history' => [],
            'leave_provision' => [],
            'payslips' => [],
            'remuneration' => [],
            'twelve_month' => [],
        ];

        $batch1 = $service->createBatch($hr);
        $batch1->update(['status' => HrVipImportBatch::STATUS_STAGED, 'staged' => $staged]);
        $service->commit($batch1, $hr);

        $batch2 = $service->createBatch($hr);
        $batch2->update(['status' => HrVipImportBatch::STATUS_STAGED, 'staged' => $staged]);
        $service->commit($batch2, $hr);

        $user = User::query()->where('tenant_id', $tenant->id)->where('employee_number', '2109-300')->first();
        $this->assertSame(
            1,
            \App\Models\LeaveLedgerEntry::query()->where('user_id', $user->id)->where('reference', 'REF-DUP')->count(),
            'Re-running the same import must not double-post the same historical transaction.'
        );
    }

    public function test_per_type_leave_balances_persist_full_precision_and_negative_values(): void
    {
        $tenant = Tenant::factory()->create();
        $hr = $this->asHrManager($tenant)[1];

        $service = app(\App\Modules\Hr\Import\HrVipImportService::class);
        $batch = $service->createBatch($hr);
        $batch->update([
            'status' => HrVipImportBatch::STATUS_STAGED,
            'staged' => [
                'employees' => [['employee_code' => '2082-300', 'display_name' => 'Mr US Mungendje']],
                'leave_balances' => [
                    ['employee_code' => '2082-300', 'leave_code' => 'ANN_LVE', 'entitlement' => 25, 'balance_bf' => 45.7477, 'accrued' => 2.0833, 'taken' => 0, 'balance_cf' => 47.8310],
                    ['employee_code' => '2082-300', 'leave_code' => 'COPEN_LV', 'entitlement' => 0, 'balance_bf' => -182.0000, 'accrued' => 0, 'taken' => 0, 'balance_cf' => -182.0000],
                ],
                'leave_transactions' => [],
                'leave_history' => [],
                'leave_provision' => [],
                'payslips' => [],
                'remuneration' => [],
                'twelve_month' => [],
            ],
        ]);

        $service->commit($batch, $hr);

        $user = User::query()->where('tenant_id', $tenant->id)->where('employee_number', '2082-300')->first();
        $annual = \App\Models\LeaveTypeBalance::query()->where('user_id', $user->id)->where('leave_type', 'annual')->first();
        $compensatory = \App\Models\LeaveTypeBalance::query()->where('user_id', $user->id)->where('leave_type', 'compensatory')->first();

        $this->assertNotNull($annual);
        $this->assertEqualsWithDelta(47.8310, (float) $annual->balance_carried_forward, 0.0001);
        $this->assertNotNull($compensatory, 'Negative compensatory balances must be preserved, not discarded.');
        $this->assertEqualsWithDelta(-182.0000, (float) $compensatory->balance_carried_forward, 0.0001);
    }
}
