<?php

namespace Tests;

use App\Http\Middleware\SetRlsContext;
use App\Models\Department;
use App\Models\SupplierCategory;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;

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
        // Salary advance policy v1 — required for create/submit/eligibility.
        $this->seed(\Database\Seeders\SalaryAdvancePolicySeeder::class);
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

    protected function makeMeOfficer(?Tenant $tenant = null): User
    {
        return $this->makeUser('M&E Officer', $tenant);
    }

    // ── Auth helpers ─────────────────────────────────────────────────────────

    /**
     * Sanctum actingAs is process-global. $http from asFinanceController() is $this;
     * a later asSG() replaces the actor. Re-bind with asUser($finance) before reuse.
     */
    protected function asUser(User $user): static
    {
        Sanctum::actingAs($user);

        return $this;
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

    /**
     * Create an active budget reservation for procurement Phase 1 hard-gate tests.
     */
    protected function reserveBudgetFor(\App\Models\ProcurementRequest $request, ?\App\Models\User $actor = null): \App\Models\BudgetReservation
    {
        $actor ??= $this->makeUser('Finance Controller', \App\Models\Tenant::find($request->tenant_id));
        $tenant = \App\Models\Tenant::find($request->tenant_id);

        $fy = \App\Models\FinancialYear::defaultAprilMarch((int) $tenant->id, (int) date('Y'));
        $budget = \App\Models\Budget::firstOrCreate(
            [
                'tenant_id' => $tenant->id,
                'year' => (string) date('Y'),
                'name' => 'Test Budget '.date('Y'),
            ],
            [
                'financial_year_id' => $fy->id,
                'type' => 'core',
                'status' => 'active',
                'currency' => $request->currency ?? 'NAD',
                'total_amount' => 0,
                'created_by' => $actor->id,
            ]
        );

        $line = \App\Models\BudgetLine::firstOrCreate(
            [
                'budget_id' => $budget->id,
                'code' => $request->budget_line ?? 'TEST-BUDGET-LINE',
            ],
            [
                'name' => $request->budget_line ?? 'TEST-BUDGET-LINE',
                'category' => 'test',
                'amount_allocated' => max((float) ($request->estimated_value ?: 1), 1_000_000),
                'original_allocation' => max((float) ($request->estimated_value ?: 1), 1_000_000),
                'amount_spent' => 0,
                'is_active' => true,
            ]
        );

        return app(\App\Modules\Budget\Services\BudgetCommitmentService::class)->reserve([
            'tenant_id' => $request->tenant_id,
            'budget_line_id' => $line->id,
            'amount' => (float) ($request->estimated_value ?: 1),
            'source_type' => 'procurement',
            'source_id' => $request->id,
            'source_key' => 'PROCUREMENT:'.$request->id,
            'currency' => $request->currency ?? 'NAD',
            'notes' => 'Test budget confirmation',
            'procurement_request_id' => $request->id,
            'idempotency_key' => 'test-proc-'.$request->id,
            'confirm' => true,
        ], $actor);
    }

    protected function asSG(?Tenant $tenant = null): array
    {
        $user = $this->makeSG($tenant);

        return [$this->asUser($user), $user];
    }

    protected function asGovernanceOfficer(?Tenant $tenant = null): array
    {
        $user = $this->makeGovernanceOfficer($tenant);

        return [$this->asUser($user), $user];
    }

    protected function asMeOfficer(?Tenant $tenant = null): array
    {
        $user = $this->makeMeOfficer($tenant);

        return [$this->asUser($user), $user];
    }

    // ── Department helpers ───────────────────────────────────────────────────

    protected function makeDepartment(Tenant $tenant, ?int $parentId = null): Department
    {
        return Department::create([
            'tenant_id' => $tenant->id,
            'name' => 'Dept '.uniqid(),
            'code' => strtoupper(substr(uniqid(), -5)),
            'parent_id' => $parentId,
        ]);
    }

    protected function makeSupplierCategory(Tenant $tenant, array $overrides = []): SupplierCategory
    {
        $suffix = strtolower(substr(uniqid(), -6));

        return SupplierCategory::create(array_merge([
            'tenant_id' => $tenant->id,
            'name' => 'Category '.strtoupper($suffix),
            'code' => 'cat_'.$suffix,
            'description' => 'Test supplier category',
            'is_active' => true,
        ], $overrides));
    }

    // ── Upload helpers (real magic bytes for UploadContentSniffer) ───────────

    /**
     * Laravel UploadedFile::fake()->create() writes empty/random bytes that
     * finfo rejects. Use real minimal PDF/PNG content so content sniffing passes.
     */
    protected function fakePdf(string $filename = 'document.pdf'): UploadedFile
    {
        return UploadedFile::fake()->createWithContent(
            $filename,
            "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
        );
    }

    protected function fakePng(string $filename = 'image.png'): UploadedFile
    {
        // 1x1 transparent PNG
        return UploadedFile::fake()->createWithContent(
            $filename,
            base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')
        );
    }
}
