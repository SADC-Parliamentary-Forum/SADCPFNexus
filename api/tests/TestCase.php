<?php

namespace Tests;

use App\Http\Middleware\SetRlsContext;
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
        // SRHR permissions are created by migrations; core roles by this seeder.
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    // ── User helpers ─────────────────────────────────────────────────────────

    /**
     * Create a user optionally belonging to a specific tenant, and assign a role.
     */
    protected function makeUser(string $role = 'staff', ?Tenant $tenant = null): User
    {
        $tenant ??= Tenant::factory()->create();
        $user = User::factory()->create(['tenant_id' => $tenant->id]);
        $user->assignRole($role);
        return $user;
    }

    /**
     * Create a System Admin user (all permissions).
     */
    protected function makeAdmin(?Tenant $tenant = null): User
    {
        return $this->makeUser('System Admin', $tenant);
    }

    /**
     * Return $this with the Authorization header set for the given user.
     */
    protected function asUser(User $user): static
    {
        $token = $user->createToken('phpunit')->plainTextToken;
        return $this->withHeader('Authorization', "Bearer {$token}");
    }

    /**
     * Shorthand: create a staff user and authenticate as them.
     */
    protected function asStaff(?Tenant $tenant = null): array
    {
        $user = $this->makeUser('staff', $tenant);
        return [$this->asUser($user), $user];
    }

    /**
     * Shorthand: create a System Admin and authenticate.
     */
    protected function asAdmin(?Tenant $tenant = null): array
    {
        $user = $this->makeAdmin($tenant);
        return [$this->asUser($user), $user];
    }
}
