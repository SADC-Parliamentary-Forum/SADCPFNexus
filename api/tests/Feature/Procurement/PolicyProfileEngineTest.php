<?php

namespace Tests\Feature\Procurement;

use App\Models\ProcurementPolicyProfile;
use App\Models\Tenant;
use Tests\TestCase;

class PolicyProfileEngineTest extends TestCase
{
    public function test_can_create_list_and_activate_policy_profile(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asProcurementOfficer($tenant);

        // Seed default via list ensure
        $list = $http->getJson('/api/v1/procurement/policy-profiles')->assertOk();
        $this->assertGreaterThanOrEqual(1, count($list->json('data')));
        $this->assertTrue(collect($list->json('data'))->contains(fn ($p) => $p['key'] === 'sadc_pf_core'));

        $created = $http->postJson('/api/v1/procurement/policy-profiles', [
            'key'                   => 'eu_donor',
            'name'                  => 'EU Donor Profile',
            'description'           => 'EU-funded procurements',
            'donor_codes'           => ['EU', 'EDF'],
            'direct_purchase_limit' => 5_000,
            'quotation_limit'       => 50_000,
            'tender_threshold'      => 50_000,
            'minimum_quotes_required' => 3,
            'split_lookback_days'   => 30,
            'split_enforcement'     => 'hard',
        ])->assertCreated()
            ->assertJsonPath('data.key', 'eu_donor')
            ->assertJsonPath('data.donor_codes.0', 'EU');

        $id = $created->json('data.id');

        $http->postJson("/api/v1/procurement/policy-profiles/{$id}/activate")
            ->assertOk()
            ->assertJsonPath('data.policy_profile_key', 'eu_donor');

        $http->getJson('/api/v1/procurement/settings')
            ->assertOk()
            ->assertJsonPath('data.policy_profile_key', 'eu_donor')
            ->assertJsonPath('data.direct_purchase_limit', 5000)
            ->assertJsonPath('data.quotation_limit', 50000)
            ->assertJsonPath('data.multi_donor_policy_ui', 'enabled');
    }

    public function test_default_sadc_pf_core_preserves_phase1_bands(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asProcurementOfficer($tenant);

        $http->getJson('/api/v1/procurement/policy-profiles')->assertOk();

        $profile = ProcurementPolicyProfile::query()
            ->where('tenant_id', $tenant->id)
            ->where('key', 'sadc_pf_core')
            ->first();

        $this->assertNotNull($profile);
        $this->assertSame(10_000.0, (float) $profile->direct_purchase_limit);
        $this->assertSame(100_000.0, (float) $profile->quotation_limit);
        $this->assertSame(100_000.0, (float) $profile->tender_threshold);
        $this->assertTrue($profile->is_default);
    }

    public function test_cannot_delete_default_profile(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asProcurementOfficer($tenant);

        $http->getJson('/api/v1/procurement/policy-profiles')->assertOk();
        $default = ProcurementPolicyProfile::query()
            ->where('tenant_id', $tenant->id)
            ->where('key', 'sadc_pf_core')
            ->firstOrFail();

        $http->deleteJson("/api/v1/procurement/policy-profiles/{$default->id}")
            ->assertUnprocessable();
    }
}
