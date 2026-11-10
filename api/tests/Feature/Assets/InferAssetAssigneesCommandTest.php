<?php

namespace Tests\Feature\Assets;

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Tenant;
use App\Models\User;
use Tests\TestCase;

class InferAssetAssigneesCommandTest extends TestCase
{
    public function test_dry_run_reports_and_apply_assigns_only_clear_matches(): void
    {
        $tenant = Tenant::factory()->create();
        $boemo = $this->staff($tenant, 'Boemo Sekgoma');
        $other = $this->staff($tenant, 'Agnes Lilungwe');
        AssetCategory::create(['tenant_id' => $tenant->id, 'name' => 'Equipment', 'code' => 'equipment']);

        $clear = $this->asset($tenant, 'Laptop', 'SG-BS Office');
        $unknown = $this->asset($tenant, 'Projector', 'Boardroom');
        $twoPeople = $this->asset($tenant, 'Printer TMM / ALM', null);
        $noAccount = $this->asset($tenant, 'Desktop YNM', null);
        $taken = $this->asset($tenant, 'Monitor', 'SG-BS Office', $other);

        $this->artisan('assets:infer-assignees', ['--tenant' => $tenant->id])
            ->expectsOutputToContain('1 to assign, 1 with no recognised code, 1 naming more than one person, 1 naming someone without an account, 1 already assigned to someone else')
            ->expectsOutputToContain('Boardroom')
            ->assertSuccessful();
        $this->assertNull($clear->fresh()->assigned_to);

        $this->artisan('assets:infer-assignees', ['--tenant' => $tenant->id, '--apply' => true])->assertSuccessful();

        $this->assertSame($boemo->id, (int) $clear->fresh()->assigned_to);
        $this->assertSame('assigned', $clear->fresh()->status);
        $this->assertDatabaseHas('asset_assignment_histories', ['asset_id' => $clear->id, 'assigned_to' => $boemo->id]);
        $this->assertNull($unknown->fresh()->assigned_to);
        $this->assertNull($twoPeople->fresh()->assigned_to);
        $this->assertNull($noAccount->fresh()->assigned_to);
        $this->assertSame($other->id, (int) $taken->fresh()->assigned_to);
    }

    public function test_an_invited_account_that_has_not_signed_in_yet_can_hold_assets(): void
    {
        $tenant = Tenant::factory()->create();
        $invited = $this->staff($tenant, 'Boemo Mmandu Sekgoma');
        $invited->forceFill(['is_active' => false, 'account_status' => User::STATUS_INVITED])->save();
        $removed = $this->staff($tenant, 'Toivo Mwaala');
        $removed->forceFill(['is_active' => false, 'account_status' => User::STATUS_REMOVED])->save();
        AssetCategory::create(['tenant_id' => $tenant->id, 'name' => 'Equipment', 'code' => 'equipment']);
        $sofa = $this->asset($tenant, 'Sofa', 'SG-Residence');
        $desk = $this->asset($tenant, 'Desk', 'TMM Office');

        $this->artisan('assets:infer-assignees', ['--tenant' => $tenant->id, '--apply' => true])->assertSuccessful();

        $this->assertSame($invited->id, (int) $sofa->fresh()->assigned_to);
        $this->assertNull($desk->fresh()->assigned_to);
    }

    private function staff(Tenant $tenant, string $name): User
    {
        $user = $this->makeUser('staff', $tenant);
        $user->forceFill(['name' => $name, 'is_active' => true])->save();

        return $user;
    }

    private function asset(Tenant $tenant, string $name, ?string $location, ?User $assignee = null): Asset
    {
        return Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'AST-'.uniqid(),
            'name' => $name,
            'category' => 'equipment',
            'status' => $assignee ? 'assigned' : 'available',
            'legacy_location' => $location,
            'assigned_to' => $assignee?->id,
        ]);
    }
}
