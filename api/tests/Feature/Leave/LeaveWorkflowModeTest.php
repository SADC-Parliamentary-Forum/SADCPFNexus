<?php

namespace Tests\Feature\Leave;

use App\Models\LeavePolicyVersion;
use App\Models\LeaveRequest;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Leave\Services\LeavePolicyService;
use App\Modules\Leave\Services\LeaveService;
use Carbon\Carbon;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class LeaveWorkflowModeTest extends TestCase
{
    public function test_default_policy_workflow_mode_is_standard(): void
    {
        $tenant = Tenant::factory()->create();
        $policy = app(LeavePolicyService::class)->activePolicyForTenant($tenant->id);

        $this->assertSame('standard', $policy->workflow_mode);
        $this->assertFalse((bool) $policy->admin_review_required);
        $this->assertSame('Director', $policy->principal_role);
        $this->assertSame(
            ['recommend', 'certify', 'authorise'],
            app(LeavePolicyService::class)->resolveApprovalStages($policy)
        );
    }

    public function test_finance_first_stages_start_with_finance(): void
    {
        $tenant = Tenant::factory()->create();
        $policy = app(LeavePolicyService::class)->activePolicyForTenant($tenant->id);
        $policy->update(['workflow_mode' => 'finance_first', 'admin_review_required' => false]);

        $this->assertSame(
            ['finance', 'certify', 'authorise'],
            app(LeavePolicyService::class)->resolveApprovalStages($policy->fresh())
        );
    }

    public function test_director_principal_inserts_principal_before_authorise(): void
    {
        $tenant = Tenant::factory()->create();
        $policy = app(LeavePolicyService::class)->activePolicyForTenant($tenant->id);
        $policy->update([
            'workflow_mode' => 'director_principal',
            'admin_review_required' => true,
            'principal_role' => 'Director',
        ]);

        $this->assertSame(
            ['recommend', 'certify', 'principal', 'authorise'],
            app(LeavePolicyService::class)->resolveApprovalStages($policy->fresh())
        );
    }

    public function test_director_requester_skips_recommend_on_standard_mode(): void
    {
        $tenant = Tenant::factory()->create();
        Role::findOrCreate('Director', 'web');
        $director = User::factory()->create(['tenant_id' => $tenant->id]);
        $director->assignRole('Director');

        $policy = app(LeavePolicyService::class)->activePolicyForTenant($tenant->id);
        $stages = app(LeavePolicyService::class)->resolveApprovalStages($policy, $director);

        $this->assertSame(['certify', 'authorise'], $stages);
    }

    public function test_submit_finance_first_routes_to_finance_controller(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $finance = $this->makeFinanceController($tenant);
        $this->makeHrManager($tenant);
        $this->makeSG($tenant);

        $policy = app(LeavePolicyService::class)->activePolicyForTenant($tenant->id);
        $policy->update(['workflow_mode' => 'finance_first']);

        $leave = $this->createDraftAnnualLeave($staff);
        $result = app(LeaveService::class)->submit($leave, $staff);

        $this->assertSame('Finance Certification', $result->current_stage);
        $this->assertSame($finance->id, $result->current_holder_user_id);
    }

    public function test_certify_director_principal_routes_to_director_then_sg(): void
    {
        $tenant = Tenant::factory()->create();
        Role::findOrCreate('Director', 'web');
        $staff = $this->makeUser('staff', $tenant);
        $hr = $this->makeHrManager($tenant);
        $director = User::factory()->create(['tenant_id' => $tenant->id, 'name' => 'Director One']);
        $director->assignRole('Director');
        $this->makeSG($tenant);

        $policy = app(LeavePolicyService::class)->activePolicyForTenant($tenant->id);
        $policy->update([
            'workflow_mode' => 'director_principal',
            'admin_review_required' => true,
            'principal_role' => 'Director',
        ]);

        $leave = $this->createDraftAnnualLeave($staff);
        $leave = app(LeaveService::class)->submit($leave, $staff);
        $this->assertSame('Supervisor/HOD Recommendation', $leave->current_stage);

        $hod = $this->makeUser('HOD', $tenant);
        $leave = app(LeaveService::class)->recommend($leave, $hod, 'recommend');
        $this->assertSame('Administration/HR Certification', $leave->current_stage);

        $leave = app(LeaveService::class)->certify($leave, $hr, 'certify');
        $this->assertSame('Director Principal Review', $leave->current_stage);
        $this->assertSame($director->id, $leave->current_holder_user_id);
    }

    public function test_create_policy_version_via_api_activates_mode(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asHrManager($tenant);
        app(LeavePolicyService::class)->activePolicyForTenant($tenant->id);

        $response = $http->postJson('/api/v1/leave/policies', [
            'version' => 'v2-finance',
            'effective_from' => now()->toDateString(),
            'workflow_mode' => 'finance_first',
            'admin_review_required' => false,
            'change_reason' => 'Align leave with Finance-first routing',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.workflow_mode', 'finance_first')
            ->assertJsonPath('data.is_active', true);

        $this->assertSame(
            1,
            LeavePolicyVersion::query()->where('tenant_id', $tenant->id)->where('is_active', true)->count()
        );
    }

    public function test_non_hr_cannot_create_leave_policy(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);
        app(LeavePolicyService::class)->activePolicyForTenant($tenant->id);

        $http->postJson('/api/v1/leave/policies', [
            'version' => 'v2',
            'effective_from' => now()->toDateString(),
            'workflow_mode' => 'finance_first',
            'change_reason' => 'Nope',
        ])->assertForbidden();
    }

    private function createDraftAnnualLeave(User $staff): LeaveRequest
    {
        \App\Models\LeaveLedgerEntry::create([
            'tenant_id' => $staff->tenant_id,
            'user_id' => $staff->id,
            'leave_type' => 'annual',
            'transaction_type' => \App\Models\LeaveLedgerEntry::OPENING_BALANCE,
            'amount' => 20,
            'unit' => 'days',
            'effective_date' => now()->startOfYear()->toDateString(),
            'reason' => 'Test opening balance',
        ]);

        $start = now()->next(Carbon::MONDAY)->addWeeks(2);
        $created = $this->asUser($staff)->postJson('/api/v1/leave/requests', [
            'leave_type' => 'annual',
            'start_date' => $start->toDateString(),
            'end_date' => $start->copy()->addDay()->toDateString(),
            'reason' => 'Workflow mode test',
        ])->assertCreated();

        return LeaveRequest::findOrFail($created->json('data.id'));
    }
}
