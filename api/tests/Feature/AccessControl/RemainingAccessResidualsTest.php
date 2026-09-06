<?php

namespace Tests\Feature\AccessControl;

use App\Models\Assignment;
use App\Models\AuditEngagement;
use App\Models\DelegatedAuthority;
use App\Models\Documents\ManagedDocument;
use App\Models\PeopleAuthority\IdentityDelegation;
use App\Models\SalaryAdvanceRequest;
use App\Models\StockRequest;
use App\Models\Tenant;
use App\Models\TenantSetting;
use App\Models\Timesheet;
use App\Modules\PeopleAuthority\Services\DelegationCollapseService;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RemainingAccessResidualsTest extends TestCase
{
    public function test_staff_salary_advance_list_excludes_peer_records(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $other = $this->makeUser('staff', $tenant);
        $staff->givePermissionTo('salary_advance.view');

        $mine = $this->makeAdvance($tenant, $staff);
        $theirs = $this->makeAdvance($tenant, $other);

        Sanctum::actingAs($staff);
        $ids = collect($this->getJson('/api/v1/finance/advances')->assertOk()->json('data'))->pluck('id');

        $this->assertTrue($ids->contains($mine->id));
        $this->assertFalse($ids->contains($theirs->id));
    }

    public function test_finance_salary_advance_queue_still_sees_submitted_peer(): void
    {
        $tenant = Tenant::factory()->create();
        $finance = $this->makeFinanceController($tenant);
        $staff = $this->makeUser('staff', $tenant);
        $theirs = $this->makeAdvance($tenant, $staff, ['status' => 'submitted']);

        Sanctum::actingAs($finance);
        $ids = collect($this->getJson('/api/v1/finance/advances?queue=certify')->assertOk()->json('data'))->pluck('id');
        $this->assertTrue($ids->contains($theirs->id));
    }

    public function test_staff_assignment_list_excludes_peer_records(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $other = $this->makeUser('staff', $tenant);
        $staff->givePermissionTo('assignments.view');

        $mine = $this->makeAssignment($staff);
        $theirs = $this->makeAssignment($other);

        Sanctum::actingAs($staff);
        $ids = collect($this->getJson('/api/v1/assignments')->assertOk()->json('data'))->pluck('id');

        $this->assertTrue($ids->contains($mine->id));
        $this->assertFalse($ids->contains($theirs->id));
    }

    public function test_staff_stock_request_list_excludes_peer_records(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $other = $this->makeUser('staff', $tenant);
        $staff->givePermissionTo('stock.view');
        $other->givePermissionTo('stock.view');

        $mine = $this->makeStockRequest($staff);
        $theirs = $this->makeStockRequest($other);

        Sanctum::actingAs($staff);
        $ids = collect($this->getJson('/api/v1/stock/requests')->assertOk()->json('data'))->pluck('id');

        $this->assertTrue($ids->contains($mine->id));
        $this->assertFalse($ids->contains($theirs->id));
    }

    public function test_document_register_is_owner_scoped_for_viewers(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $other = $this->makeUser('staff', $tenant);
        $staff->givePermissionTo('documents.view');

        $mine = ManagedDocument::create([
            'tenant_id' => $tenant->id,
            'owner_user_id' => $staff->id,
            'title' => 'Mine doc',
            'module' => 'general',
        ]);
        $theirs = ManagedDocument::create([
            'tenant_id' => $tenant->id,
            'owner_user_id' => $other->id,
            'title' => 'Other doc',
            'module' => 'general',
        ]);

        Sanctum::actingAs($staff);
        $ids = collect($this->getJson('/api/v1/documents')->assertOk()->json('data'))->pluck('id');

        $this->assertTrue($ids->contains($mine->id));
        $this->assertFalse($ids->contains($theirs->id));
    }

    public function test_audit_engagement_list_is_scoped_for_staff(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $auditor = $this->makeUser('Internal Auditor', $tenant);
        $staff->givePermissionTo('audit.view');

        $mine = AuditEngagement::create([
            'tenant_id' => $tenant->id,
            'title' => 'Staff engagement',
            'status' => 'planned',
            'created_by' => $staff->id,
            'lead_auditor_id' => $staff->id,
            'confidentiality_level' => 'standard',
        ]);
        $theirs = AuditEngagement::create([
            'tenant_id' => $tenant->id,
            'title' => 'Auditor engagement',
            'status' => 'planned',
            'created_by' => $auditor->id,
            'lead_auditor_id' => $auditor->id,
            'confidentiality_level' => 'restricted',
        ]);

        Sanctum::actingAs($staff);
        $ids = collect($this->getJson('/api/v1/audit-management/engagements')->assertOk()->json('data'))->pluck('id');

        $this->assertTrue($ids->contains($mine->id));
        $this->assertFalse($ids->contains($theirs->id));
    }

    public function test_dashboard_badges_do_not_count_peer_salary_or_timesheet(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $other = $this->makeUser('staff', $tenant);
        $staff->givePermissionTo(['salary_advance.view', 'timesheets.view', 'assignments.view', 'stock.view']);

        $this->makeAdvance($tenant, $staff, ['status' => 'submitted']);
        $this->makeAdvance($tenant, $other, ['status' => 'submitted']);
        $this->makeTimesheet($staff, 'submitted');
        $this->makeTimesheet($other, 'submitted');
        $this->makeAssignment($staff, ['status' => 'active']);
        $this->makeAssignment($other, ['status' => 'active']);
        $this->makeStockRequest($staff, 'submitted');
        $this->makeStockRequest($other, 'submitted');

        Sanctum::actingAs($staff);
        $res = $this->getJson('/api/v1/dashboard/stats')->assertOk();

        $this->assertSame(1, (int) $res->json('breakdown.pending_salary_advances'));
        $this->assertSame(1, (int) $res->json('breakdown.pending_timesheets'));
        $this->assertSame(1, (int) $res->json('breakdown.open_assignments'));
        $this->assertSame(1, (int) $res->json('breakdown.pending_stock_requests'));
        $this->assertSame(1, (int) $res->json('pending_salary_advances'));
        $this->assertSame(1, (int) $res->json('pending_timesheets'));
        $this->assertSame(1, (int) $res->json('open_assignments'));
        $this->assertSame(1, (int) $res->json('pending_stock_requests'));
    }

    public function test_staff_role_sync_requires_dual_control(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $target = $this->makeUser('staff', $tenant);
        Sanctum::actingAs($admin);

        $res = $this->patchJson('/api/v1/admin/users/'.$target->id.'/roles', [
            'roles' => ['HOD'],
        ]);
        $res->assertStatus(202)->assertJsonPath('data.status', 'pending_approval');
        $this->assertFalse($target->fresh()->hasRole('HOD'));
        $this->assertTrue($target->fresh()->hasRole('staff'));
    }

    public function test_second_admin_can_approve_staff_role_sync(): void
    {
        $tenant = Tenant::factory()->create();
        $adminA = $this->makeAdmin($tenant);
        $adminB = $this->makeAdmin($tenant);
        $target = $this->makeUser('staff', $tenant);
        Sanctum::actingAs($adminA);

        $pendingId = $this->patchJson('/api/v1/admin/users/'.$target->id.'/roles', [
            'roles' => ['HOD'],
        ])->assertStatus(202)->json('data.request_id');

        Sanctum::actingAs($adminB);
        $this->postJson('/api/v1/admin/users/role-sync-requests/'.$pendingId.'/approve')
            ->assertOk();
        $this->assertTrue($target->fresh()->hasRole('HOD'));
    }

    public function test_frozen_legacy_role_edits_return_423(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $target = $this->makeUser('staff', $tenant);
        Sanctum::actingAs($admin);

        $this->putJson('/api/v1/admin/access/cutover/freeze', ['frozen' => true])
            ->assertOk()
            ->assertJsonPath('data.frozen', true);

        $this->patchJson('/api/v1/admin/users/'.$target->id.'/roles', [
            'roles' => ['HOD'],
        ])->assertStatus(423);

        $this->assertFalse($target->fresh()->hasRole('HOD'));
        $this->assertDatabaseHas('tenant_settings', [
            'tenant_id' => $tenant->id,
            'key' => 'access.legacy_role_edits_frozen',
        ]);
        $this->assertTrue(
            filter_var(TenantSetting::forTenant($tenant->id)['access.legacy_role_edits_frozen'] ?? false, FILTER_VALIDATE_BOOLEAN)
        );
    }

    public function test_cutover_status_reports_freeze_flag(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);

        $this->putJson('/api/v1/admin/access/cutover/freeze', ['frozen' => true])->assertOk();
        $status = $this->getJson('/api/v1/admin/access/cutover')->assertOk()->json('data.checklist');
        $freeze = collect($status)->firstWhere('id', 'freeze_legacy_edits');
        $this->assertSame('ready', $freeze['status']);
        $this->assertStringContainsString('frozen', strtolower($freeze['detail']));
    }

    public function test_saam_collapse_command_mirrors_unmatched_rows(): void
    {
        $tenant = Tenant::factory()->create();
        $principal = $this->makeUser('staff', $tenant);
        $delegate = $this->makeUser('staff', $tenant);

        $saam = DelegatedAuthority::create([
            'tenant_id' => $tenant->id,
            'principal_user_id' => $principal->id,
            'delegate_user_id' => $delegate->id,
            'start_date' => now()->subDay()->toDateString(),
            'end_date' => now()->addMonth()->toDateString(),
            'module' => 'leave',
            'can_draft' => true,
            'can_submit' => true,
            'can_upload' => true,
            'can_act_on_behalf' => true,
            'reason' => 'leave cover',
            'created_by' => $principal->id,
        ]);

        $this->assertFalse(
            IdentityDelegation::query()->where('legacy_delegated_authority_id', $saam->id)->exists()
        );

        $this->artisan('people-authority:collapse-saam-delegations', ['--tenant' => $tenant->id])
            ->assertSuccessful();

        $this->assertTrue(
            IdentityDelegation::query()->where('legacy_delegated_authority_id', $saam->id)->exists()
        );
        $this->assertSame(1, app(DelegationCollapseService::class)->migrateTenant($tenant->id)['mirrored']);
    }

    private function makeAdvance(Tenant $tenant, $user, array $overrides = []): SalaryAdvanceRequest
    {
        return SalaryAdvanceRequest::create(array_merge([
            'tenant_id' => $tenant->id,
            'requester_id' => $user->id,
            'reference_number' => 'ADV-'.uniqid(),
            'advance_type' => 'salary',
            'amount' => 1000,
            'currency' => 'NAD',
            'repayment_months' => 1,
            'purpose' => 'Test',
            'justification' => 'Test justification',
            'status' => 'submitted',
        ], $overrides));
    }

    private function makeAssignment($user, array $extra = []): Assignment
    {
        return Assignment::create(array_merge([
            'tenant_id' => $user->tenant_id,
            'title' => 'Task '.uniqid(),
            'description' => 'Scoped assignment',
            'status' => 'draft',
            'priority' => 'medium',
            'created_by' => $user->id,
            'assigned_to' => $user->id,
            'is_template' => false,
            'due_date' => now()->addDays(7)->toDateString(),
        ], $extra));
    }

    private function makeStockRequest($user, string $status = 'submitted'): StockRequest
    {
        return StockRequest::create([
            'tenant_id' => $user->tenant_id,
            'reference_number' => 'SR-'.uniqid(),
            'status' => $status,
            'requested_by' => $user->id,
            'purpose' => 'Stationery',
        ]);
    }

    private function makeTimesheet($user, string $status = 'submitted'): Timesheet
    {
        return Timesheet::create([
            'tenant_id' => $user->tenant_id,
            'user_id' => $user->id,
            'week_start' => now()->startOfWeek()->toDateString(),
            'week_end' => now()->endOfWeek()->toDateString(),
            'status' => $status,
            'total_hours' => 40,
        ]);
    }
}
