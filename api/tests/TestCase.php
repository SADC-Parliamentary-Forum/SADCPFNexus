<?php

namespace Tests;

use App\Http\Middleware\SetRlsContext;
use App\Models\ApprovalRequest;
use App\Models\Department;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    /**
     * Do NOT run the full DatabaseSeeder — it seeds 15+ seeders and requires
     * a fully wired demo environment. Each test seeds only what it needs.
     */
    protected bool $seed = false;

    protected function setUp(): void
    {
        parent::setUp();

        // Bypass the PostgreSQL-specific SET ROLE / SET app.* statements.
        // RLS enforcement is a DB-layer concern; business-logic tests validate
        // application code, not PostgreSQL policy enforcement.
        $this->withoutMiddleware(SetRlsContext::class);

        // Seed roles + permissions (required for assignRole / hasPermissionTo).
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    // ── User factories ───────────────────────────────────────────────────────

    protected function makeUser(string $role = 'staff', ?Tenant $tenant = null): User
    {
        $tenant ??= Tenant::factory()->create();
        $user = User::factory()->create(['tenant_id' => $tenant->id]);
        $user->assignRole($role);
        return $user;
    }

    protected function makeAdmin(?Tenant $tenant = null): User
    {
        return $this->makeUser('System Admin', $tenant);
    }

    protected function makeHrManager(?Tenant $tenant = null): User
    {
        return $this->makeUser('HR Manager', $tenant);
    }

    protected function makeHrAdmin(?Tenant $tenant = null): User
    {
        return $this->makeUser('HR Administrator', $tenant);
    }

    protected function makeFinanceController(?Tenant $tenant = null): User
    {
        return $this->makeUser('Finance Controller', $tenant);
    }

    protected function makeProcurementOfficer(?Tenant $tenant = null): User
    {
        return $this->makeUser('Procurement Officer', $tenant);
    }

    protected function makeSG(?Tenant $tenant = null): User
    {
        return $this->makeUser('Secretary General', $tenant);
    }

    protected function makeGovernanceOfficer(?Tenant $tenant = null): User
    {
        return $this->makeUser('Governance Officer', $tenant);
    }

    // ── Auth helpers ─────────────────────────────────────────────────────────

    protected function asUser(User $user): static
    {
        $token = $user->createToken('phpunit')->plainTextToken;
        return $this->withHeader('Authorization', "Bearer {$token}");
    }

    protected function asStaff(?Tenant $tenant = null): array
    {
        $user = $this->makeUser('staff', $tenant);
        return [$this->asUser($user), $user];
    }

    protected function asAdmin(?Tenant $tenant = null): array
    {
        $user = $this->makeAdmin($tenant);
        return [$this->asUser($user), $user];
    }

    protected function asHrManager(?Tenant $tenant = null): array
    {
        $user = $this->makeHrManager($tenant);
        return [$this->asUser($user), $user];
    }

    protected function asHrAdmin(?Tenant $tenant = null): array
    {
        $user = $this->makeHrAdmin($tenant);
        return [$this->asUser($user), $user];
    }

    protected function asFinanceController(?Tenant $tenant = null): array
    {
        $user = $this->makeFinanceController($tenant);
        return [$this->asUser($user), $user];
    }

    protected function asProcurementOfficer(?Tenant $tenant = null): array
    {
        $user = $this->makeProcurementOfficer($tenant);
        return [$this->asUser($user), $user];
    }

    protected function asSG(?Tenant $tenant = null): array
    {
        $user = $this->makeSG($tenant);
        return [$this->asUser($user), $user];
    }

    // ── Department helpers ───────────────────────────────────────────────────

    protected function makeDepartment(Tenant $tenant, ?int $parentId = null): Department
    {
        return Department::create([
            'tenant_id' => $tenant->id,
            'name'      => 'Dept ' . uniqid(),
            'code'      => strtoupper(substr(uniqid(), -5)),
            'parent_id' => $parentId,
        ]);
    }
}
