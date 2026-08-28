<?php

namespace Tests\Feature\Programmes;

use Illuminate\Support\Facades\Artisan;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class ProgrammeFinanceReviewTest extends TestCase
{
    public function test_finance_review_permission_is_seeded_and_assigned_to_finance_controller(): void
    {
        Artisan::call('db:seed', ['--class' => 'Database\\Seeders\\RolesAndPermissionsSeeder']);

        $this->assertTrue(Permission::where('name', 'programme.finance-review')->exists());

        $role = \Spatie\Permission\Models\Role::where('name', 'Finance Controller')->where('guard_name', 'sanctum')->first();
        $this->assertNotNull($role);
        $this->assertTrue($role->hasPermissionTo('programme.finance-review', 'sanctum'));
    }

    public function test_staff_cannot_update_finance_only_fields_via_finance_review_endpoint(): void
    {
        $tenant = \App\Models\Tenant::factory()->create();
        [$officer] = $this->asProgrammeOfficer($tenant);
        $programmeId = $officer->postJson('/api/v1/programmes', ['title' => 'Finance Gate Test'])->json('data.id');

        [$staff] = $this->asStaff($tenant);
        $staff->putJson("/api/v1/programmes/{$programmeId}/finance-review", [
            'budget_availability_status' => 'available',
            'finance_comments'           => 'Confirmed.',
        ])->assertForbidden();
    }

    public function test_authors_cannot_smuggle_finance_fields_through_normal_update(): void
    {
        [$http] = $this->asProgrammeOfficer();
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'Finance Smuggle Test'])->json('data.id');

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'budget_availability_status' => 'available',
        ])->assertForbidden();

        $this->assertDatabaseHas('programmes', [
            'id'                         => $programmeId,
            'budget_availability_status' => 'not_checked',
        ]);
    }

    public function test_finance_controller_can_update_finance_only_fields(): void
    {
        $tenant = \App\Models\Tenant::factory()->create();
        [$http] = $this->asProgrammeOfficer($tenant);
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'Finance OK Test'])->json('data.id');

        [$financeHttp] = $this->asFinanceController($tenant);

        $financeHttp->putJson("/api/v1/programmes/{$programmeId}/finance-review", [
            'budget_availability_status' => 'available',
            'finance_comments'           => 'Confirmed with Finance.',
        ])->assertOk();

        $this->assertDatabaseHas('programmes', [
            'id'                          => $programmeId,
            'budget_availability_status'  => 'available',
            'finance_comments'            => 'Confirmed with Finance.',
        ]);
    }

    public function test_finance_review_preserves_existing_comment_when_omitted(): void
    {
        $tenant = \App\Models\Tenant::factory()->create();
        [$http] = $this->asProgrammeOfficer($tenant);
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'Finance Preserve Test'])->json('data.id');

        [$financeHttp] = $this->asFinanceController($tenant);

        $financeHttp->putJson("/api/v1/programmes/{$programmeId}/finance-review", [
            'budget_availability_status' => 'partially_available',
            'finance_comments'           => 'Initial comment.',
        ])->assertOk();

        // Follow-up call updates only the status, without resending the comment.
        $financeHttp->putJson("/api/v1/programmes/{$programmeId}/finance-review", [
            'budget_availability_status' => 'available',
        ])->assertOk();

        $this->assertDatabaseHas('programmes', [
            'id'                          => $programmeId,
            'budget_availability_status'  => 'available',
            'finance_comments'            => 'Initial comment.',
        ]);
    }
}
