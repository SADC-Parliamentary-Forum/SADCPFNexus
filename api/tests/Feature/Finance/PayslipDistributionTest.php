<?php

namespace Tests\Feature\Finance;

use App\Models\Payslip;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;
use ZipArchive;

class PayslipDistributionTest extends TestCase
{
    public function test_staff_cannot_match_or_distribute(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);

        $http->postJson('/api/v1/admin/payslips/match', [
            'filenames' => ['EMP001.pdf'],
            'period_month' => 8,
            'period_year' => 2026,
        ])->assertForbidden();

        $http->post('/api/v1/admin/payslips/distribute', [
            'period_month' => 8,
            'period_year' => 2026,
            'files' => [UploadedFile::fake()->create('EMP001.pdf', 20, 'application/pdf')],
        ])->assertForbidden();
    }

    public function test_hr_matches_by_employee_number_and_flags_existing(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $hr] = $this->asHrManager($tenant);
        $staff = User::factory()->create([
            'tenant_id' => $tenant->id,
            'name' => 'Jane Doe',
            'employee_number' => 'EMP042',
        ]);
        $staff->assignRole('staff');
        $existing = Payslip::create([
            'tenant_id' => $tenant->id,
            'user_id' => $staff->id,
            'period_month' => 8,
            'period_year' => 2026,
            'gross_amount' => 0,
            'net_amount' => 0,
            'currency' => 'NAD',
        ]);

        $http->postJson('/api/v1/admin/payslips/match', [
            'filenames' => ['EMP042_August2026.pdf', 'nobody.pdf'],
            'period_month' => 8,
            'period_year' => 2026,
        ])
            ->assertOk()
            ->assertJsonPath('data.items.0.status', 'matched')
            ->assertJsonPath('data.items.0.user.id', $staff->id)
            ->assertJsonPath('data.items.0.existing_payslip_id', $existing->id)
            ->assertJsonPath('data.items.1.status', 'unmatched');
    }

    public function test_directory_is_tenant_scoped(): void
    {
        $tenant = Tenant::factory()->create();
        $other = Tenant::factory()->create();
        [$http] = $this->asHrManager($tenant);
        User::factory()->create([
            'tenant_id' => $tenant->id,
            'name' => 'Local Staff',
            'employee_number' => 'EMP100',
        ]);
        User::factory()->create([
            'tenant_id' => $other->id,
            'name' => 'Foreign Staff',
            'employee_number' => 'EMP100',
        ]);

        $http->getJson('/api/v1/admin/payslips/directory?q=EMP100')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Local Staff');
    }

    public function test_distribute_issues_matched_file_and_rejects_cross_tenant_assignment(): void
    {
        Storage::fake('local');
        $tenant = Tenant::factory()->create();
        $other = Tenant::factory()->create();
        [$http] = $this->asHrManager($tenant);
        $staff = User::factory()->create([
            'tenant_id' => $tenant->id,
            'name' => 'Jane Doe',
            'employee_number' => 'EMP042',
        ]);
        $foreign = User::factory()->create([
            'tenant_id' => $other->id,
            'name' => 'Other Person',
            'employee_number' => 'EMP999',
        ]);

        $response = $http->post('/api/v1/admin/payslips/distribute', [
            'period_month' => 8,
            'period_year' => 2026,
            'assignments' => json_encode([
                ['filename' => 'foreign.pdf', 'user_id' => $foreign->id],
            ]),
            'files' => [
                UploadedFile::fake()->create('EMP042_August2026.pdf', 12, 'application/pdf'),
                UploadedFile::fake()->create('foreign.pdf', 12, 'application/pdf'),
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.issued', 1)
            ->assertJsonPath('data.failed.0.filename', 'foreign.pdf');

        $this->assertDatabaseHas('payslips', [
            'user_id' => $staff->id,
            'period_month' => 8,
            'period_year' => 2026,
        ]);
        $this->assertDatabaseMissing('payslips', [
            'user_id' => $foreign->id,
        ]);
    }

    public function test_staff_cannot_download_another_users_payslip(): void
    {
        Storage::fake('local');
        $tenant = Tenant::factory()->create();
        $owner = User::factory()->create(['tenant_id' => $tenant->id]);
        $owner->assignRole('staff');
        $peer = User::factory()->create(['tenant_id' => $tenant->id]);
        $peer->assignRole('staff');
        $payslip = Payslip::create([
            'tenant_id' => $tenant->id,
            'user_id' => $owner->id,
            'period_month' => 8,
            'period_year' => 2026,
            'gross_amount' => 0,
            'net_amount' => 0,
            'currency' => 'NAD',
            'file_path' => 'payslips/x.pdf',
        ]);

        $this->asUser($peer)
            ->getJson('/api/v1/finance/payslips/'.$payslip->id)
            ->assertForbidden();
    }

    public function test_period_coverage_counts_missing_staff(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $hr] = $this->asHrManager($tenant);
        $staff = User::factory()->create(['tenant_id' => $tenant->id, 'name' => 'Covered']);
        Payslip::create([
            'tenant_id' => $tenant->id,
            'user_id' => $hr->id,
            'period_month' => 8,
            'period_year' => 2026,
            'gross_amount' => 0,
            'net_amount' => 0,
            'currency' => 'NAD',
        ]);

        $http->getJson('/api/v1/admin/payslips/period-coverage?period_month=8&period_year=2026')
            ->assertOk()
            ->assertJsonPath('data.totals.issued', 1)
            ->assertJsonPath('data.totals.missing', 1);

        $this->assertTrue(
            collect($http->getJson('/api/v1/admin/payslips/period-coverage?period_month=8&period_year=2026')->json('data.missing'))
                ->contains(fn ($row) => (int) $row['id'] === (int) $staff->id)
        );
    }

    public function test_zip_distribute_and_zip_slip_rejected(): void
    {
        if (! class_exists(ZipArchive::class)) {
            $this->markTestSkipped('ZipArchive not available');
        }
        Storage::fake('local');
        $tenant = Tenant::factory()->create();
        [$http] = $this->asHrManager($tenant);
        User::factory()->create([
            'tenant_id' => $tenant->id,
            'name' => 'Jane Doe',
            'employee_number' => 'EMP042',
        ]);

        $safe = $this->makeZip([
            'EMP042_August2026.pdf' => '%PDF-1.4 test',
        ]);
        $http->post('/api/v1/admin/payslips/distribute', [
            'period_month' => 8,
            'period_year' => 2026,
            'files' => [$safe],
        ])->assertCreated()->assertJsonPath('data.issued', 1);

        $slip = $this->makeZip([
            '../evil.pdf' => '%PDF-1.4 bad',
        ]);
        $http->post('/api/v1/admin/payslips/distribute', [
            'period_month' => 8,
            'period_year' => 2026,
            'files' => [$slip],
        ])->assertUnprocessable();
    }

    public function test_zip_match_expands_inner_filenames(): void
    {
        if (! class_exists(ZipArchive::class)) {
            $this->markTestSkipped('ZipArchive not available');
        }
        $tenant = Tenant::factory()->create();
        [$http] = $this->asHrManager($tenant);
        $staff = User::factory()->create([
            'tenant_id' => $tenant->id,
            'name' => 'Jane Doe',
            'employee_number' => 'EMP042',
        ]);

        $zip = $this->makeZip([
            'folder/EMP042_August2026.pdf' => '%PDF-1.4 test',
            'nobody.pdf' => '%PDF-1.4 test',
        ]);

        $items = collect($http->post('/api/v1/admin/payslips/match', [
            'period_month' => 8,
            'period_year' => 2026,
            'files' => [$zip],
        ])->assertOk()->json('data.items'))->keyBy('filename');

        $this->assertSame('matched', $items['EMP042_August2026.pdf']['status']);
        $this->assertSame($staff->id, $items['EMP042_August2026.pdf']['user']['id']);
        $this->assertSame('payslips.zip', $items['EMP042_August2026.pdf']['archive']);
        $this->assertSame('unmatched', $items['nobody.pdf']['status']);
    }

    public function test_duplicate_person_in_envelope_is_skipped(): void
    {
        Storage::fake('local');
        $tenant = Tenant::factory()->create();
        [$http] = $this->asHrManager($tenant);
        $staff = User::factory()->create([
            'tenant_id' => $tenant->id,
            'name' => 'Jane Doe',
            'employee_number' => 'EMP042',
        ]);

        $http->post('/api/v1/admin/payslips/distribute', [
            'period_month' => 8,
            'period_year' => 2026,
            'assignments' => json_encode([
                ['filename' => 'first.pdf', 'user_id' => $staff->id],
                ['filename' => 'second.pdf', 'user_id' => $staff->id],
            ]),
            'files' => [
                UploadedFile::fake()->create('first.pdf', 12, 'application/pdf'),
                UploadedFile::fake()->create('second.pdf', 12, 'application/pdf'),
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('data.issued', 1)
            ->assertJsonPath('data.failed.0.reason', 'duplicate_person');
    }

    /**
     * @param  array<string, string>  $entries
     */
    private function makeZip(array $entries): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'pszip');
        $zip = new ZipArchive();
        $this->assertTrue($zip->open($path, ZipArchive::OVERWRITE) === true);
        foreach ($entries as $name => $contents) {
            $zip->addFromString($name, $contents);
        }
        $zip->close();

        return new UploadedFile($path, 'payslips.zip', 'application/zip', null, true);
    }
}
