<?php

namespace Tests\Feature\AccessControl;

use App\Modules\AccessControl\Services\NavigationManifestService;
use App\Modules\AccessControl\Services\PolicyDecisionPoint;
use Database\Seeders\AccessControlPersonaSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Scripted persona smoke: menus / effective permissions / SoD-sensitive samples.
 * Safe for worktree/dev — uses factories, not live impersonation.
 */
class AccessControlPersonaSmokeTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return list<array{0: string, 1: list<string>, 2: list<string>}>
     */
    public static function personaMatrix(): array
    {
        return [
            ['staff', ['leave.create', 'leave.view'], ['admin.roles.manage', 'salary_advance.report.export']],
            ['HOD', ['leave.view', 'travel.view'], ['admin.roles.assign']],
            ['HR Manager', ['leave.approve'], ['admin.roles.assign']],
            ['Finance Controller', ['programme.finance_review.update.assigned', 'programme.finance-review', 'finance.view', 'finance.create'], ['procurement.evaluation.score.assigned']],
            ['Programme Officer', ['programme.module.view', 'programme.request.create'], ['programme.finance_review.update.assigned']],
            ['Procurement Evaluation Committee Member', ['procurement.evaluation.read.assigned', 'my_work.view'], ['procurement.module.view', 'procurement.approve']],
            ['Administration Officer', ['travel.view'], ['admin.roles.assign', 'leave.request.authorise.assigned']],
            ['ICT Platform Administrator', ['admin.platform.manage'], ['leave.request.authorise.assigned', 'salary_advance.report.export', 'programme.finance_review.update.assigned']],
            ['Security and Access Administrator', ['admin.roles.view', 'admin.access.simulate'], ['leave.request.authorise.assigned']],
            // Canonical Internal Auditor is report/assurance scoped, not self-service leave.view.
            ['Internal Auditor', ['leave.report.view', 'audit.view', 'audit.plan.manage'], ['leave.view', 'leave.request.authorise.assigned', 'admin.roles.assign']],
            ['Secretary General', ['leave.request.authorise.assigned', 'audit.plan.approve'], ['admin.roles.manage']],
        ];
    }

    /**
     * @dataProvider personaMatrix
     *
     * @param  list<string>  $mustHave
     * @param  list<string>  $mustDeny
     */
    public function test_persona_effective_permissions_and_navigation(string $role, array $mustHave, array $mustDeny): void
    {
        $user = $this->makeUser($role);
        $pdp = app(PolicyDecisionPoint::class);
        $nav = app(NavigationManifestService::class);

        foreach ($mustHave as $permission) {
            $this->assertTrue(
                $pdp->can($user, $permission) || in_array($permission, $pdp->effectivePermissions($user), true),
                "{$role} should hold {$permission}"
            );
        }

        foreach ($mustDeny as $permission) {
            $this->assertFalse(
                $pdp->can($user, $permission),
                "{$role} must be denied {$permission}"
            );
        }

        Sanctum::actingAs($user);
        $response = $this->getJson('/api/v1/access/navigation')->assertOk();
        $this->assertIsArray($response->json('data.items'));

        // Manifest helper stays consistent with API.
        $manifest = $nav->forUser($user);
        $this->assertArrayHasKey('items', $manifest);
    }

    public function test_system_admin_login_compatibility_still_resolves_admin_matrix(): void
    {
        $admin = $this->makeUser('System Admin');
        $pdp = app(PolicyDecisionPoint::class);

        $this->assertTrue($pdp->can($admin, 'admin.roles.view'));
        $this->assertTrue($pdp->can($admin, 'admin.roles.manage'));

        Sanctum::actingAs($admin);
        $this->getJson('/api/v1/admin/access/roles')->assertOk();
        $this->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('id', $admin->id);
    }

    public function test_persona_seeder_creates_all_pilot_accounts(): void
    {
        $this->seed(AccessControlPersonaSeeder::class);

        foreach (AccessControlPersonaSeeder::personaMap() as $meta) {
            $this->assertDatabaseHas('users', ['email' => $meta['email']]);
            $user = \App\Models\User::where('email', $meta['email'])->first();
            $this->assertNotNull($user);
            $this->assertTrue(
                $user->hasRole($meta['role']),
                "Persona {$meta['persona']} should have role {$meta['role']}"
            );
        }
    }
}
