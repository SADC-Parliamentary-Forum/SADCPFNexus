<?php

namespace Tests\Feature\Leave;

use App\Models\LeaveBalance;
use App\Models\LeaveRequest;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class HrLeaveOnBehalfAndBulkImportTest extends TestCase
{
    private function openingBalance(int $userId, float $amount = 20): void
    {
        LeaveBalance::query()->updateOrCreate(
            ['user_id' => $userId, 'period_year' => (int) date('Y')],
            ['annual_balance_days' => $amount, 'lil_hours_available' => 8.0, 'sick_leave_used_days' => 0]
        );
    }

    private function futureDates(): array
    {
        $start = now()->addWeeks(3)->next('Monday');

        return [$start->toDateString(), $start->copy()->addDay()->toDateString()];
    }

    public function test_hr_officer_can_create_leave_for_selected_employee_without_delegation(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $this->openingBalance($staff->id);
        $hr = $this->makeHrAdmin($tenant);
        [$start, $end] = $this->futureDates();

        $this->asUser($hr)
            ->postJson('/api/v1/leave/requests', [
                'leave_type' => 'annual',
                'start_date' => $start,
                'end_date' => $end,
                'reason' => 'HR captured paper leave',
                'prepared_on_behalf_of' => $staff->id,
                'submit' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('data.requester_id', $staff->id)
            ->assertJsonPath('data.status', 'submitted')
            ->assertJsonPath('data.prepared_on_behalf_of', $staff->id);

        $this->assertDatabaseHas('leave_requests', [
            'requester_id' => $staff->id,
            'prepared_by' => $hr->id,
            'status' => 'submitted',
        ]);
    }

    public function test_staff_cannot_create_leave_for_another_employee_without_delegation(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $other = $this->makeUser('staff', $tenant);
        $this->openingBalance($other->id);
        [$start, $end] = $this->futureDates();

        $this->asUser($staff)
            ->postJson('/api/v1/leave/requests', [
                'leave_type' => 'annual',
                'start_date' => $start,
                'end_date' => $end,
                'prepared_on_behalf_of' => $other->id,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['prepared_on_behalf_of']);
    }

    public function test_hr_officer_bulk_import_creates_leave_for_matched_emails_and_reports_row_errors(): void
    {
        $tenant = Tenant::factory()->create();
        $jane = User::factory()->create([
            'tenant_id' => $tenant->id,
            'name' => 'Jane Chirwa',
            'email' => 'jane.chirwa@sadcpf.org',
            'employee_number' => 'SADCPF-101',
        ]);
        $jane->assignRole('staff');
        $this->openingBalance($jane->id);

        $unknownEmail = 'missing.person@sadcpf.org';
        $hr = $this->makeHrAdmin($tenant);
        [$start, $end] = $this->futureDates();

        $response = $this->asUser($hr)
            ->postJson('/api/v1/leave/requests/bulk-import', [
                'submit' => true,
                'rows' => [
                    [
                        'employee_email' => 'jane.chirwa@sadcpf.org',
                        'employee_name' => 'Jane Chirwa',
                        'leave_type' => 'annual',
                        'start_date' => $start,
                        'end_date' => $end,
                        'reason' => 'Family visit',
                    ],
                    [
                        'employee_email' => $unknownEmail,
                        'leave_type' => 'annual',
                        'start_date' => $start,
                        'end_date' => $end,
                    ],
                ],
            ])
            ->assertOk();

        $response->assertJsonPath('data.created_count', 1)
            ->assertJsonPath('data.error_count', 1)
            ->assertJsonPath('data.created.0.requester_id', $jane->id)
            ->assertJsonPath('data.errors.0.row', 2);

        $this->assertDatabaseHas('leave_requests', [
            'requester_id' => $jane->id,
            'prepared_by' => $hr->id,
            'leave_type' => 'annual',
            'status' => 'submitted',
        ]);
    }

    public function test_hr_officer_can_bulk_import_csv_file(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = User::factory()->create([
            'tenant_id' => $tenant->id,
            'name' => 'Peter Moyo',
            'email' => 'peter.moyo@sadcpf.org',
        ]);
        $staff->assignRole('staff');
        $this->openingBalance($staff->id);
        $hr = $this->makeHrAdmin($tenant);
        [$start, $end] = $this->futureDates();

        $csv = implode("\n", [
            'employee_email,employee_name,leave_type,start_date,end_date,reason',
            "peter.moyo@sadcpf.org,Peter Moyo,annual,{$start},{$end},Conference",
        ]);

        $file = UploadedFile::fake()->createWithContent('leave-bulk.csv', $csv);

        $this->asUser($hr)
            ->post('/api/v1/leave/requests/bulk-import', [
                'submit' => '1',
                'file' => $file,
            ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.created_count', 1);

        $this->assertDatabaseHas('leave_requests', [
            'requester_id' => $staff->id,
            'reason' => 'Conference',
        ]);
    }

    public function test_staff_cannot_bulk_import_leave(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        [$start, $end] = $this->futureDates();

        $this->asUser($staff)
            ->postJson('/api/v1/leave/requests/bulk-import', [
                'rows' => [[
                    'employee_email' => $staff->email,
                    'leave_type' => 'annual',
                    'start_date' => $start,
                    'end_date' => $end,
                ]],
            ])
            ->assertForbidden();
    }

    public function test_tenant_user_search_matches_email_and_full_name(): void
    {
        $tenant = Tenant::factory()->create();
        $hr = $this->makeHrAdmin($tenant);
        $staff = User::factory()->create([
            'tenant_id' => $tenant->id,
            'name' => 'Amina Banda',
            'email' => 'amina.banda@sadcpf.org',
            'employee_number' => 'SADCPF-202',
        ]);

        $byEmail = $this->asUser($hr)
            ->getJson('/api/v1/tenant-users?search=amina.banda')
            ->assertOk();

        $ids = collect($byEmail->json('data'))->pluck('id');
        $this->assertTrue($ids->contains($staff->id));
        $this->assertNotNull(collect($byEmail->json('data'))->firstWhere('id', $staff->id)['email'] ?? null);

        $byName = $this->asUser($hr)
            ->getJson('/api/v1/tenant-users?search=Amina')
            ->assertOk();
        $this->assertTrue(collect($byName->json('data'))->pluck('id')->contains($staff->id));
    }

    public function test_bulk_import_template_is_available_to_hr_officer(): void
    {
        $tenant = Tenant::factory()->create();
        $hr = $this->makeHrAdmin($tenant);

        $this->asUser($hr)
            ->get('/api/v1/leave/requests/bulk-import/template')
            ->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8');
    }
}
