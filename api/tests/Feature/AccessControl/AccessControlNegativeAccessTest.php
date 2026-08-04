<?php

namespace Tests\Feature\AccessControl;

use App\Models\AccessControl\UserPermissionGrant;
use App\Models\LeaveRequest;
use App\Models\ProcurementRequest;
use App\Models\Programme;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AccessControlNegativeAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_employee_cannot_approve_own_leave(): void
    {
        $user = $this->makeUser('staff');
        $user->givePermissionTo('leave.approve');

        $leave = LeaveRequest::factory()->create([
            'tenant_id' => $user->tenant_id,
            'requester_id' => $user->id,
            'status' => 'submitted',
        ]);

        Sanctum::actingAs($user);
        $this->postJson("/api/v1/leave/requests/{$leave->id}/approve", [
            'comment' => 'self',
        ])->assertStatus(403);
    }

    public function test_programme_officer_cannot_change_finance_fields_via_update(): void
    {
        $user = $this->makeUser('Programme Officer');
        $programme = Programme::create([
            'tenant_id' => $user->tenant_id,
            'created_by' => $user->id,
            'title' => 'PIF Finance Gate',
            'reference_number' => 'PIF-TEST-001',
            'status' => 'draft',
            'budget_availability_status' => 'not_checked',
        ]);

        Sanctum::actingAs($user);
        $this->putJson("/api/v1/programmes/{$programme->id}", [
            'budget_availability_status' => 'available',
            'finance_comments' => 'sneaky',
        ])->assertStatus(403);
    }

    public function test_non_finance_user_cannot_hit_finance_review_endpoint(): void
    {
        $user = $this->makeUser('Programme Officer');
        $programme = Programme::create([
            'tenant_id' => $user->tenant_id,
            'created_by' => $user->id,
            'title' => 'PIF Finance Endpoint',
            'reference_number' => 'PIF-TEST-002',
            'status' => 'submitted',
            'budget_availability_status' => 'not_checked',
        ]);

        Sanctum::actingAs($user);
        $this->putJson("/api/v1/programmes/{$programme->id}/finance-review", [
            'budget_availability_status' => 'available',
            'finance_comments' => 'nope',
        ])->assertStatus(403);
    }

    public function test_feature_only_evaluator_cannot_open_unrelated_procurement(): void
    {
        $evaluator = $this->makeUser('Procurement Evaluation Committee Member');
        $owner = $this->makeUser('staff', $evaluator->tenant);

        $assigned = ProcurementRequest::create([
            'tenant_id' => $evaluator->tenant_id,
            'requester_id' => $owner->id,
            'reference_number' => 'PRQ-EVAL-001',
            'title' => 'Assigned RFQ',
            'description' => 'Assigned evaluation',
            'status' => 'evaluation',
            'category' => 'goods',
            'estimated_value' => 1000,
            'currency' => 'USD',
        ]);
        $other = ProcurementRequest::create([
            'tenant_id' => $evaluator->tenant_id,
            'requester_id' => $owner->id,
            'reference_number' => 'PRQ-EVAL-002',
            'title' => 'Other RFQ',
            'description' => 'Unrelated',
            'status' => 'evaluation',
            'category' => 'goods',
            'estimated_value' => 2000,
            'currency' => 'USD',
        ]);

        UserPermissionGrant::create([
            'tenant_id' => $evaluator->tenant_id,
            'user_id' => $evaluator->id,
            'permission_key' => 'procurement.evaluation.read.assigned',
            'scope_type' => 'specific_records',
            'scope_reference' => (string) $assigned->id,
            'status' => 'active',
            'reason' => 'Committee assignment',
            'granted_by' => $evaluator->id,
        ]);

        Sanctum::actingAs($evaluator);

        // Distinct from tender board GET /procurement/evaluations (officer-gated).
        $this->getJson('/api/v1/procurement/committee-evaluations')->assertOk()
            ->assertJsonPath('meta.feature_only', true);

        $this->getJson("/api/v1/procurement/committee-evaluations/{$assigned->id}")->assertOk();
        $this->getJson("/api/v1/procurement/committee-evaluations/{$other->id}")->assertStatus(404);

        $list = $this->getJson('/api/v1/procurement/requests')->assertOk()->json();
        $ids = collect($list['data'] ?? [])->pluck('id')->all();
        $this->assertNotContains($other->id, $ids);
        $this->assertNotContains($assigned->id, $ids);
    }

    public function test_ict_admin_cannot_export_salary_advances(): void
    {
        $ict = $this->makeUser('ICT Platform Administrator');
        $decision = app(\App\Modules\AccessControl\Services\PolicyDecisionPoint::class)
            ->authorize($ict, 'salary_advance.report.export');

        $this->assertFalse($decision->allowed);
    }

    public function test_access_navigation_hides_procurement_for_feature_only_evaluator(): void
    {
        $evaluator = $this->makeUser('Procurement Evaluation Committee Member');
        Sanctum::actingAs($evaluator);

        $response = $this->getJson('/api/v1/access/navigation');
        $response->assertOk();
        $labels = collect($response->json('data.items'))->pluck('label')->all();
        $this->assertNotContains('Procurement', $labels);
        $this->assertContains('My Work', $labels);
    }

    public function test_role_catalogue_endpoint_requires_admin_roles_view(): void
    {
        // Security Access Admin gets admin.roles.view from template; System Admin via system.admin alias.
        // Plain staff must NOT reach the role catalogue (roles.view is PA-only, not admin matrix).
        $staff = $this->makeUser('staff');
        Sanctum::actingAs($staff);
        $this->getJson('/api/v1/admin/access/roles')->assertStatus(403);

        $admin = $this->makeUser('Security and Access Administrator');
        Sanctum::actingAs($admin);
        $this->getJson('/api/v1/admin/access/roles')->assertOk();
    }

    public function test_access_simulator_does_not_impersonate(): void
    {
        $admin = $this->makeUser('Security and Access Administrator');
        $target = $this->makeUser('staff', $admin->tenant);

        Sanctum::actingAs($admin);
        $response = $this->postJson("/api/v1/admin/access/users/{$target->id}/simulate");

        $response->assertOk();
        // Simulator must not switch the authenticated principal.
        $this->assertAuthenticatedAs($admin);
        $this->getJson('/api/v1/auth/me')->assertOk()
            ->assertJsonPath('id', $admin->id);
    }

    public function test_revoke_via_denial_blocks_within_cache_window(): void
    {
        $user = $this->makeUser('staff');
        $user->givePermissionTo('leave.approve');

        $pdp = app(\App\Modules\AccessControl\Services\PolicyDecisionPoint::class);
        $this->assertTrue($pdp->can($user, 'leave.request.authorise.assigned'));

        // Warm effective-permission cache.
        $pdp->effectivePermissions($user);

        \App\Models\AccessControl\UserPermissionDenial::create([
            'tenant_id' => $user->tenant_id,
            'user_id' => $user->id,
            'permission_key' => 'leave.request.authorise.assigned',
            'status' => 'active',
            'reason' => 'Revoked for test',
            'denied_by' => $user->id,
        ]);

        app(\App\Modules\AccessControl\Services\AccessCacheInvalidator::class)->invalidate($user);

        $this->assertFalse(
            $pdp->can($user, 'leave.request.authorise.assigned'),
            'Denial must take effect after cache invalidation within the short TTL window.'
        );
    }

    public function test_expired_acting_approver_cannot_approve(): void
    {
        $actor = $this->makeUser('staff');
        $owner = $this->makeUser('staff', $actor->tenant);

        UserPermissionGrant::create([
            'tenant_id' => $actor->tenant_id,
            'user_id' => $actor->id,
            'permission_key' => 'leave.request.authorise.assigned',
            'scope_type' => 'assigned',
            'status' => 'active',
            'valid_from' => now()->subDays(7),
            'valid_until' => now()->subMinute(),
            'reason' => 'Acting HOD — expired',
            'granted_by' => $owner->id,
        ]);

        $leave = LeaveRequest::factory()->create([
            'tenant_id' => $actor->tenant_id,
            'requester_id' => $owner->id,
            'status' => 'submitted',
        ]);

        $pdp = app(\App\Modules\AccessControl\Services\PolicyDecisionPoint::class);
        $this->assertFalse($pdp->can($actor, 'leave.request.authorise.assigned', $leave, [
            'assigned' => true,
            'assignee_ids' => [$actor->id],
        ]));

        Sanctum::actingAs($actor);
        $this->postJson("/api/v1/leave/requests/{$leave->id}/approve", [
            'comment' => 'too late',
        ])->assertStatus(403);
    }

    public function test_self_privileged_role_assignment_blocked(): void
    {
        $admin = $this->makeUser('Security and Access Administrator');
        $sod = app(\App\Modules\AccessControl\Services\SegregationOfDutiesService::class);

        $decision = $sod->evaluate($admin, 'admin.roles.assign', null, [
            'target_user_id' => $admin->id,
            'is_privileged' => true,
        ]);

        $this->assertFalse($decision->allowed);
        $this->assertSame('access_admin_no_self_privileged', $decision->reasonCode);
    }

    public function test_employee_cannot_view_unrelated_leave_idor(): void
    {
        $viewer = $this->makeUser('staff');
        $owner = $this->makeUser('staff', $viewer->tenant);
        $leave = LeaveRequest::factory()->create([
            'tenant_id' => $viewer->tenant_id,
            'requester_id' => $owner->id,
            'status' => 'submitted',
        ]);

        Sanctum::actingAs($viewer);
        // Safe 404 — do not confirm leave existence (Phase 7 residual).
        $this->getJson("/api/v1/leave/requests/{$leave->id}")->assertStatus(404);
        $this->getJson("/api/v1/leave/requests/{$leave->id}/attachments")->assertStatus(404);
    }

    public function test_employee_travel_list_is_self_scoped(): void
    {
        $viewer = $this->makeUser('staff');
        $owner = $this->makeUser('staff', $viewer->tenant);

        $mine = \App\Models\TravelRequest::factory()->create([
            'tenant_id' => $viewer->tenant_id,
            'requester_id' => $viewer->id,
            'status' => 'submitted',
        ]);
        $theirs = \App\Models\TravelRequest::factory()->create([
            'tenant_id' => $viewer->tenant_id,
            'requester_id' => $owner->id,
            'status' => 'submitted',
        ]);

        Sanctum::actingAs($viewer);
        $list = $this->getJson('/api/v1/travel/requests')->assertOk()->json();
        $ids = collect($list['data'] ?? $list)->pluck('id')->filter()->all();
        // Paginator may wrap under data; also accept plain list shapes.
        if ($ids === [] && isset($list['data']) && is_array($list['data'])) {
            $ids = collect($list['data'])->pluck('id')->all();
        }

        $this->assertContains($mine->id, $ids);
        $this->assertNotContains($theirs->id, $ids);
    }

    public function test_employee_cannot_view_unrelated_travel_detail(): void
    {
        $viewer = $this->makeUser('staff');
        $owner = $this->makeUser('staff', $viewer->tenant);
        $travel = \App\Models\TravelRequest::factory()->create([
            'tenant_id' => $viewer->tenant_id,
            'requester_id' => $owner->id,
            'status' => 'submitted',
        ]);

        Sanctum::actingAs($viewer);
        $this->getJson("/api/v1/travel/requests/{$travel->id}")->assertStatus(403);
    }

    public function test_role_revoke_forces_session_refresh(): void
    {
        $admin = $this->makeUser('Security and Access Administrator');
        $target = $this->makeUser('staff', $admin->tenant);
        $target->assignRole('HOD');

        $token = $target->createToken('pilot')->plainTextToken;
        \App\Models\UserSession::create([
            'user_id' => $target->id,
            'token_id' => $target->tokens()->latest('id')->value('id'),
            'ip_address' => '127.0.0.1',
            'user_agent' => 'phpunit',
            'last_active_at' => now(),
        ]);

        $this->assertGreaterThan(0, $target->tokens()->count());

        app(\App\Modules\AccessControl\Services\AccessCacheInvalidator::class)->invalidate($target->fresh());

        $this->assertSame(0, $target->fresh()->tokens()->count());
        $this->assertSame(0, \App\Models\UserSession::where('user_id', $target->id)->count());
        // Avoid unused-var lint; token string proves createToken worked before invalidate.
        $this->assertNotSame('', $token);
    }

    public function test_cutover_status_endpoint_requires_admin_roles_view(): void
    {
        $staff = $this->makeUser('staff');
        Sanctum::actingAs($staff);
        $this->getJson('/api/v1/admin/access/cutover')->assertStatus(403);

        $admin = $this->makeUser('Security and Access Administrator');
        Sanctum::actingAs($admin);
        $this->getJson('/api/v1/admin/access/cutover')->assertOk()
            ->assertJsonStructure(['data' => ['checklist', 'validated_assignments']]);
    }

    public function test_seeder_merge_preserves_template_permissions_on_reseed(): void
    {
        $role = \Spatie\Permission\Models\Role::findByName('Internal Auditor', 'sanctum');
        $templatePerm = 'audit.event.read.organisation';
        // Ensure template merge present (migration + seeder).
        if (! $role->hasPermissionTo($templatePerm)) {
            $role->givePermissionTo($templatePerm);
        }
        $this->assertTrue($role->hasPermissionTo($templatePerm));

        // Re-seed should not wipe template-merged permission.
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);
        $role = $role->fresh();
        $this->assertTrue(
            $role->hasPermissionTo($templatePerm),
            'Re-seed must preserve curated/template permission merges on Internal Auditor'
        );
    }

    public function test_hidden_menu_api_still_blocked_for_evaluator(): void
    {
        $evaluator = $this->makeUser('Procurement Evaluation Committee Member');
        Sanctum::actingAs($evaluator);

        // Tender board evaluations remain officer-gated even if URL is guessed.
        $this->getJson('/api/v1/procurement/evaluations')->assertStatus(403);
        $this->getJson('/api/v1/procurement/tenders')->assertStatus(403);
        $this->getJson('/api/v1/procurement/settings')->assertStatus(403);
    }

    public function test_retired_role_version_cannot_be_assigned(): void
    {
        $admin = $this->makeUser('Security and Access Administrator');
        $target = $this->makeUser('staff', $admin->tenant);
        $catalogue = \App\Models\AccessControl\AccessRoleCatalogue::create([
            'tenant_id' => null,
            'key' => 'temporary_read_only',
            'name' => 'Temporary Read Only',
            'status' => 'active',
            'risk_level' => 'low',
            'default_scopes' => ['self'],
        ]);
        $version = \App\Models\AccessControl\AccessRoleVersion::create([
            'role_catalogue_id' => $catalogue->id,
            'version' => 1,
            'status' => 'retired',
            'permissions' => ['dashboard.view'],
        ]);

        Sanctum::actingAs($admin);
        $this->postJson("/api/v1/admin/access/users/{$target->id}/role-versions/{$version->id}", [
            'reason' => 'Retired version must be rejected',
        ])->assertStatus(422);
    }

    public function test_legacy_role_permission_sync_cannot_bypass_catalogue(): void
    {
        $admin = $this->makeUser('System Admin');
        $role = \Spatie\Permission\Models\Role::findByName('General Employee', 'sanctum');

        Sanctum::actingAs($admin);
        $this->putJson("/api/v1/admin/roles/{$role->id}/permissions", [
            'permissions' => ['dashboard.view'],
        ])->assertStatus(409);
    }

    public function test_access_profile_cannot_cross_tenant_boundary(): void
    {
        $admin = $this->makeUser('Security and Access Administrator');
        $otherTenant = \App\Models\Tenant::factory()->create();
        $target = $this->makeUser('staff', $otherTenant);

        Sanctum::actingAs($admin);
        $this->getJson("/api/v1/admin/access/users/{$target->id}/profile")->assertStatus(404);
    }

    public function test_role_draft_owner_cannot_publish_own_tenant_role(): void
    {
        $owner = $this->makeUser('Security and Access Administrator');
        $catalogue = \App\Models\AccessControl\AccessRoleCatalogue::create([
            'tenant_id' => $owner->tenant_id,
            'key' => 'owner-publish-test',
            'name' => 'Owner Publish Test',
            'owner_user_id' => $owner->id,
            'status' => 'draft',
            'risk_level' => 'low',
            'default_scopes' => ['self'],
        ]);

        $this->expectException(\Illuminate\Validation\ValidationException::class);
        app(\App\Modules\AccessControl\Services\RoleCatalogueService::class)
            ->publishVersion($catalogue, ['dashboard.view'], $owner);
    }

    public function test_direct_permission_grant_rejects_unregistered_key(): void
    {
        $admin = $this->makeUser('Security and Access Administrator');
        $target = $this->makeUser('staff', $admin->tenant);

        Sanctum::actingAs($admin);
        $this->postJson("/api/v1/admin/access/users/{$target->id}/grants", [
            'permission_key' => 'unregistered.permission',
            'scope_type' => 'self',
            'reason' => 'Must be rejected',
        ])->assertStatus(422);
    }

    public function test_access_request_rejects_unregistered_permission(): void
    {
        $requester = $this->makeUser('staff');

        Sanctum::actingAs($requester);
        $this->postJson('/api/v1/admin/access/requests', [
            'permission_key' => 'unregistered.permission',
            'scope_type' => 'self',
            'business_reason' => 'Must be rejected',
        ])->assertStatus(422);
    }
}
