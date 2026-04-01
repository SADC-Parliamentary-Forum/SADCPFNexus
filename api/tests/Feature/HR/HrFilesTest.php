<?php

namespace Tests\Feature\HR;

use App\Models\HrPersonalFile;
use App\Models\Tenant;
use Tests\TestCase;

class HrFilesTest extends TestCase
{
    public function test_unauthenticated_cannot_list_hr_files(): void
    {
        $this->getJson('/api/v1/hr/files')->assertUnauthorized();
    }

    public function test_staff_can_list_own_file(): void
    {
        [$http] = $this->asStaff();

        $http->getJson('/api/v1/hr/files')->assertOk();
    }

    public function test_hr_admin_can_create_hr_file(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asHrAdmin($tenant);
        $staff = $this->makeUser('staff', $tenant);

        $response = $http->postJson('/api/v1/hr/files', [
            'employee_id'       => $staff->id,
            'staff_number'      => 'STAFF-001',
            'current_position'  => 'Programme Officer',
            'employment_status' => 'permanent',
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('hr_personal_files', [
            'employee_id' => $staff->id,
            'staff_number'=> 'STAFF-001',
        ]);
    }

    public function test_staff_cannot_create_hr_file(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $http->postJson('/api/v1/hr/files', [
            'employee_id' => $user->id,
        ])->assertForbidden();
    }

    public function test_hr_file_requires_employee_id(): void
    {
        [$http] = $this->asHrAdmin();

        $http->postJson('/api/v1/hr/files', [
            'staff_number' => 'STAFF-XYZ',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['employee_id']);
    }

    public function test_hr_admin_can_view_any_file(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asHrAdmin($tenant);
        $staff = $this->makeUser('staff', $tenant);

        $file = HrPersonalFile::create([
            'tenant_id'   => $tenant->id,
            'employee_id' => $staff->id,
            'created_by'  => $staff->id,
            'file_status' => 'active',
        ]);

        $http->getJson("/api/v1/hr/files/{$file->id}")->assertOk();
    }

    public function test_staff_can_view_own_file(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $file = HrPersonalFile::create([
            'tenant_id'   => $tenant->id,
            'employee_id' => $user->id,
            'created_by'  => $user->id,
            'file_status' => 'active',
        ]);

        $http->getJson("/api/v1/hr/files/{$file->id}")->assertOk();
    }

    public function test_staff_cannot_view_another_employees_file(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);
        $other = $this->makeUser('staff', $tenant);

        $file = HrPersonalFile::create([
            'tenant_id'   => $tenant->id,
            'employee_id' => $other->id,
            'created_by'  => $other->id,
            'file_status' => 'active',
        ]);

        $http->getJson("/api/v1/hr/files/{$file->id}")->assertForbidden();
    }

    public function test_hr_documents_aggregate_returns_data(): void
    {
        [$http] = $this->asHrAdmin();

        $http->getJson('/api/v1/hr/documents')->assertOk();
    }
}
