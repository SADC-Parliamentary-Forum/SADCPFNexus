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
}
