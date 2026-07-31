<?php

namespace Tests\Feature\AccessControl;

use App\Models\AccessControl\AccessRoleCatalogue;
use App\Models\AccessControl\AccessRoleVersion;
use App\Models\Correspondence;
use App\Models\LeaveRequest;
use App\Models\Risk;
use App\Models\Tenant;
use App\Modules\AccessControl\Services\PrivilegedAccessDualControlService;
use App\Modules\Correspondence\Services\CorrespondenceRegisterService;
use App\Modules\Risk\Services\RiskService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ResidualCloseoutAccessControlTest extends TestCase
{
    use RefreshDatabase;

    public function test_correspondence_list_is_party_scoped_for_staff(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $other = $this->makeUser('staff', $tenant);
        $staff->givePermissionTo('correspondence.view');

        $mine = Correspondence::create([
            'tenant_id' => $tenant->id,
            'created_by' => $staff->id,
            'primary_owner_id' => $staff->id,
            'title' => 'Mine letter',
            'subject' => 'Mine letter',
            'type' => 'internal_memo',
            'status' => 'draft',
            'direction' => 'outgoing',
            'confidentiality' => 'internal',
        ]);
        Correspondence::create([
            'tenant_id' => $tenant->id,
            'created_by' => $other->id,
            'primary_owner_id' => $other->id,
            'title' => 'Other letter',
            'subject' => 'Other letter',
            'type' => 'internal_memo',
            'status' => 'draft',
            'direction' => 'outgoing',
            'confidentiality' => 'internal',
        ]);

        $ids = app(CorrespondenceRegisterService::class)
            ->accessibleQuery($staff)
            ->pluck('id');

        $this->assertTrue($ids->contains($mine->id));
        $this->assertFalse($ids->contains(
            Correspondence::where('created_by', $other->id)->value('id')
        ));
    }

    public function test_risk_list_scoped_via_access_scope_resolver(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $other = $this->makeUser('staff', $tenant);

        $mine = Risk::create([
            'tenant_id' => $tenant->id,
            'submitted_by' => $staff->id,
            'title' => 'My risk',
            'description' => 'Desc',
            'category' => 'operational',
            'likelihood' => 2,
            'impact' => 2,
            'is_confidential' => false,
            'status' => 'draft',
        ]);
        $theirs = Risk::create([
            'tenant_id' => $tenant->id,
            'submitted_by' => $other->id,
            'title' => 'Other risk',
            'description' => 'Desc',
            'category' => 'operational',
            'likelihood' => 2,
            'impact' => 2,
            'is_confidential' => false,
            'status' => 'draft',
        ]);

        $page = app(RiskService::class)->list(['per_page' => 50], $staff);
        $ids = collect($page->items())->pluck('id');

        $this->assertTrue($ids->contains($mine->id));
        $this->assertFalse($ids->contains($theirs->id));
    }

    public function test_risk_detail_404_when_out_of_scope(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $other = $this->makeUser('staff', $tenant);
        $staff->givePermissionTo('risk.view');

        $theirs = Risk::create([
            'tenant_id' => $tenant->id,
            'submitted_by' => $other->id,
            'title' => 'Hidden risk',
            'description' => 'Desc',
            'category' => 'operational',
            'likelihood' => 2,
            'impact' => 2,
            'is_confidential' => false,
            'status' => 'draft',
        ]);

        Sanctum::actingAs($staff);
        $this->getJson('/api/v1/risk/risks/'.$theirs->id)->assertNotFound();
    }

    public function test_dashboard_counts_do_not_include_out_of_scope_leave(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $other = $this->makeUser('staff', $tenant);
        $staff->givePermissionTo('leave.view');

        LeaveRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'status' => 'submitted',
        ]);
        LeaveRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $other->id,
            'status' => 'submitted',
        ]);

        Sanctum::actingAs($staff);
        $res = $this->getJson('/api/v1/dashboard/stats')->assertOk();
        $this->assertSame(1, (int) $res->json('breakdown.pending_leave'));
        $this->assertSame(1, (int) $res->json('leave_requests'));
    }

    public function test_privileged_grant_requires_second_approver(): void
    {
        $tenant = Tenant::factory()->create();
        $adminA = $this->makeUser('System Admin', $tenant);
        $target = $this->makeUser('staff', $tenant);

        $dual = app(PrivilegedAccessDualControlService::class);
        $grant = $dual->createGrant($target, [
            'permission_key' => 'admin.roles.manage',
            'reason' => 'temp elevated',
        ], $adminA);

        $this->assertSame('pending_approval', $grant->status);

        $this->expectException(\Illuminate\Validation\ValidationException::class);
        $dual->approveGrant($grant, $adminA);
    }

    public function test_privileged_grant_activates_after_distinct_approver(): void
    {
        $tenant = Tenant::factory()->create();
        $adminA = $this->makeUser('System Admin', $tenant);
        $adminB = $this->makeUser('System Admin', $tenant);
        $target = $this->makeUser('staff', $tenant);

        $dual = app(PrivilegedAccessDualControlService::class);
        $grant = $dual->createGrant($target, [
            'permission_key' => 'admin.roles.manage',
            'reason' => 'temp elevated',
        ], $adminA);

        $approved = $dual->approveGrant($grant, $adminB);
        $this->assertSame('active', $approved->status);
        $this->assertSame($adminB->id, $approved->approved_by);
    }

    public function test_access_admin_cannot_self_grant_privileged(): void
    {
        $admin = $this->makeUser('System Admin');
        $dual = app(PrivilegedAccessDualControlService::class);

        $this->expectException(\Illuminate\Validation\ValidationException::class);
        $dual->createGrant($admin, [
            'permission_key' => 'roles.manage',
            'reason' => 'self',
        ], $admin);
    }

    public function test_high_risk_role_assignment_pending_until_second_approver(): void
    {
        $tenant = Tenant::factory()->create();
        $adminA = $this->makeUser('System Admin', $tenant);
        $adminB = $this->makeUser('System Admin', $tenant);
        $target = $this->makeUser('staff', $tenant);

        $catalogue = AccessRoleCatalogue::create([
            'tenant_id' => $tenant->id,
            'key' => 'priv_role',
            'name' => 'Privileged Test Role',
            'risk_level' => 'critical',
            'status' => 'active',
            'owner_user_id' => $adminA->id,
        ]);
        $version = AccessRoleVersion::create([
            'role_catalogue_id' => $catalogue->id,
            'version' => 1,
            'status' => 'active',
            'permissions' => ['admin.roles.view'],
            'published_by' => $adminA->id,
            'published_at' => now(),
        ]);

        // Spatie role must exist for assignRole after approval
        \Spatie\Permission\Models\Role::findOrCreate('Privileged Test Role', 'web');
        \Spatie\Permission\Models\Role::findOrCreate('Privileged Test Role', 'sanctum');

        $dual = app(PrivilegedAccessDualControlService::class);
        $assignment = $dual->createRoleAssignment($target, $version->load('catalogue'), [
            'reason' => 'need access',
        ], $adminA);

        $this->assertSame('pending_approval', $assignment->status);
        $this->assertFalse($target->fresh()->hasRole('Privileged Test Role'));

        $dual->approveRoleAssignment($assignment, $adminB);
        $this->assertTrue($target->fresh()->hasRole('Privileged Test Role'));
    }
}
