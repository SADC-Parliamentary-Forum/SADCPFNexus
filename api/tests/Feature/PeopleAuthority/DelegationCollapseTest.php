<?php

namespace Tests\Feature\PeopleAuthority;

use App\Models\DelegatedAuthority;
use App\Models\PeopleAuthority\IdentityDelegation;
use App\Models\Tenant;
use App\Modules\PeopleAuthority\Services\DelegationCollapseService;
use App\Services\DelegationService;
use Tests\TestCase;

class DelegationCollapseTest extends TestCase
{
    public function test_saam_delegation_mirrors_into_identity_delegation(): void
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

        $mirrored = app(DelegationCollapseService::class)->mirror($saam);

        $this->assertInstanceOf(IdentityDelegation::class, $mirrored);
        $this->assertSame($saam->id, $mirrored->legacy_delegated_authority_id);
        $this->assertSame('active', $mirrored->status);
        $this->assertDatabaseHas('identity_delegation_scopes', [
            'identity_delegation_id' => $mirrored->id,
            'module' => 'leave',
        ]);
    }

    public function test_delegation_service_uses_pa_effective_path(): void
    {
        $tenant = Tenant::factory()->create();
        $principal = $this->makeUser('staff', $tenant);
        $delegate = $this->makeUser('staff', $tenant);

        DelegatedAuthority::create([
            'tenant_id' => $tenant->id,
            'principal_user_id' => $principal->id,
            'delegate_user_id' => $delegate->id,
            'start_date' => now()->subDay()->toDateString(),
            'end_date' => now()->addMonth()->toDateString(),
            'module' => 'leave',
            'can_draft' => true,
            'can_submit' => true,
            'can_upload' => false,
            'can_act_on_behalf' => true,
            'reason' => 'cover',
            'created_by' => $principal->id,
        ]);

        $resolved = app(DelegationService::class)->authorise($delegate, $principal->id, 'leave', 'draft');
        $this->assertNotNull($resolved);
        $this->assertDatabaseHas('identity_delegations', [
            'legacy_delegated_authority_id' => $resolved->id,
            'delegate_user_id' => $delegate->id,
            'principal_user_id' => $principal->id,
        ]);
    }
}
