<?php

namespace Tests\Feature\Leave;

use App\Models\LeaveBalance;
use App\Models\LeaveLedgerEntry;
use App\Models\LeaveRequest;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class LeaveImportTest extends TestCase
{
    private function csvFile(string $body, string $name = 'leave-import.csv'): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, $body);
    }

    public function test_guest_cannot_download_template_or_import(): void
    {
        $this->getJson('/api/v1/leave/import/template')->assertUnauthorized();
        $this->post('/api/v1/leave/import', [
            'file' => $this->csvFile(LeaveImportCsv::sample()),
        ], ['Accept' => 'application/json'])->assertUnauthorized();
    }

    public function test_staff_cannot_import_leave(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);

        $http->post('/api/v1/leave/import', [
            'file' => $this->csvFile(LeaveImportCsv::sampleFor($this->makeUser('staff', $tenant))),
            'commit' => '1',
        ], ['Accept' => 'application/json'])->assertForbidden();
    }

    public function test_hr_can_preview_historical_leave_without_writing(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asHrManager($tenant);
        $staff = $this->makeUser('staff', $tenant);

        $response = $http->post('/api/v1/leave/import', [
            'file' => $this->csvFile(LeaveImportCsv::leaveRow($staff, '2025-01-06', '2025-01-10')),
        ], ['Accept' => 'application/json']);

        $response->assertOk()
            ->assertJsonPath('data.created', 1)
            ->assertJsonPath('data.skipped', 0)
            ->assertJsonPath('data.errors', [])
            ->assertJsonPath('data.rows.0.record_type', 'leave')
            ->assertJsonPath('data.rows.0.email', $staff->email)
            ->assertJsonPath('data.rows.0.days_requested', 5)
            ->assertJsonPath('data.rows.0.duplicate', false);

        $this->assertDatabaseMissing('leave_requests', [
            'requester_id' => $staff->id,
            'leave_type' => 'annual',
        ]);
    }

    public function test_hr_can_commit_historical_leave_and_opening_balances(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asHrManager($tenant);
        $staff = $this->makeUser('staff', $tenant);

        $csv = LeaveImportCsv::header()
            .LeaveImportCsv::leaveLine($staff, '2025-01-06', '2025-01-10')
            .LeaveImportCsv::balanceLine($staff, 18, 8, 2026);

        $http->post('/api/v1/leave/import', [
            'file' => $this->csvFile($csv),
            'commit' => '1',
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.created', 1)
            ->assertJsonPath('data.balances', 1)
            ->assertJsonPath('data.errors', []);

        $this->assertDatabaseHas('leave_requests', [
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'leave_type' => 'annual',
            'status' => 'approved',
            'days_requested' => 5,
        ]);

        $this->assertDatabaseHas('leave_balances', [
            'user_id' => $staff->id,
            'period_year' => 2026,
            'annual_balance_days' => 18,
        ]);

        $this->assertDatabaseHas('leave_ledger_entries', [
            'user_id' => $staff->id,
            'leave_type' => 'annual',
            'transaction_type' => LeaveLedgerEntry::OPENING_BALANCE,
            'amount' => 18,
        ]);

        $this->assertTrue(
            LeaveLedgerEntry::query()
                ->where('user_id', $staff->id)
                ->where('transaction_type', LeaveLedgerEntry::LEAVE_TAKEN)
                ->exists()
        );
    }

    public function test_import_skips_duplicate_leave_rows_on_second_commit(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asHrManager($tenant);
        $staff = $this->makeUser('staff', $tenant);
        $csv = LeaveImportCsv::leaveRow($staff, '2025-01-06', '2025-01-10');

        $http->post('/api/v1/leave/import', [
            'file' => $this->csvFile($csv),
            'commit' => '1',
        ], ['Accept' => 'application/json'])->assertOk()->assertJsonPath('data.created', 1);

        $http->post('/api/v1/leave/import', [
            'file' => $this->csvFile($csv),
            'commit' => '1',
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.created', 0)
            ->assertJsonPath('data.skipped', 1);

        $this->assertSame(1, LeaveRequest::query()->where('requester_id', $staff->id)->count());
    }

    public function test_import_skips_duplicate_leave_rows_in_the_same_file(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asHrManager($tenant);
        $staff = $this->makeUser('staff', $tenant);
        $line = LeaveImportCsv::leaveLine($staff, '2025-01-06', '2025-01-10');
        $csv = LeaveImportCsv::header().$line.$line;

        $http->post('/api/v1/leave/import', [
            'file' => $this->csvFile($csv),
            'commit' => '1',
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.created', 1)
            ->assertJsonPath('data.skipped', 1)
            ->assertJsonPath('data.rows.1.duplicate', true);

        $this->assertSame(1, LeaveRequest::query()->where('requester_id', $staff->id)->count());
    }

    public function test_leave_balance_import_permission_can_commit(): void
    {
        $tenant = Tenant::factory()->create();
        $importer = $this->makeUser('staff', $tenant);
        $importer->givePermissionTo('leave.balance.import');
        $staff = $this->makeUser('staff', $tenant);
        $http = $this->asUser($importer);

        $http->post('/api/v1/leave/import', [
            'file' => $this->csvFile(LeaveImportCsv::leaveRow($staff, '2025-01-06', '2025-01-10')),
            'commit' => '1',
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.created', 1);

        $this->assertDatabaseHas('leave_requests', [
            'requester_id' => $staff->id,
            'leave_type' => 'annual',
        ]);
    }

    public function test_unknown_email_is_reported_and_does_not_commit(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asHrManager($tenant);

        $csv = LeaveImportCsv::header()
            ."leave,missing@example.org,annual,2025-01-06,2025-01-10,Historical,approved,,,\n";

        $http->post('/api/v1/leave/import', [
            'file' => $this->csvFile($csv),
            'commit' => '1',
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.created', 0)
            ->assertJsonPath('data.errors.0.row', 2);

        $this->assertSame(0, LeaveRequest::query()->count());
        $this->assertSame(0, LeaveBalance::query()->count());
    }

    public function test_other_tenant_staff_email_is_rejected(): void
    {
        $tenant = Tenant::factory()->create();
        $other = Tenant::factory()->create();
        [$http] = $this->asHrManager($tenant);
        $foreign = $this->makeUser('staff', $other);

        $http->post('/api/v1/leave/import', [
            'file' => $this->csvFile(LeaveImportCsv::leaveRow($foreign, '2025-01-06', '2025-01-10')),
            'commit' => '1',
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.created', 0);

        $this->assertDatabaseMissing('leave_requests', ['requester_id' => $foreign->id]);
    }

    public function test_hr_can_download_csv_template(): void
    {
        [$http] = $this->asHrManager();

        $http->get('/api/v1/leave/import/template', ['Accept' => 'text/csv'])
            ->assertOk()
            ->assertSee('record_type,email,leave_type', false);
    }
}

final class LeaveImportCsv
{
    public static function header(): string
    {
        return "record_type,email,leave_type,start_date,end_date,reason,status,annual_days,lil_hours,year\n";
    }

    public static function leaveLine(User $staff, string $start, string $end): string
    {
        return "leave,{$staff->email},annual,{$start},{$end},Historical annual leave,approved,,,\n";
    }

    public static function balanceLine(User $staff, int $days, float $lil, int $year): string
    {
        return "balance,{$staff->email},annual,,,,,{$days},{$lil},{$year}\n";
    }

    public static function leaveRow(User $staff, string $start, string $end): string
    {
        return self::header().self::leaveLine($staff, $start, $end);
    }

    public static function sample(): string
    {
        return self::header()."leave,staff@example.org,annual,2025-01-06,2025-01-10,Historical annual leave,approved,,,\n";
    }

    public static function sampleFor(User $staff): string
    {
        return self::leaveRow($staff, '2025-01-06', '2025-01-10');
    }
}
