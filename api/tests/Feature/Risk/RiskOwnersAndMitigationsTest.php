<?php

namespace Tests\Feature\Risk;

use App\Models\Risk;
use App\Models\RiskAction;
use App\Models\Tenant;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class RiskOwnersAndMitigationsTest extends TestCase
{
    private function makeDraftRisk(int $tenantId, int $userId, string $title = 'Operational disruption risk'): Risk
    {
        return Risk::create([
            'tenant_id'    => $tenantId,
            'submitted_by' => $userId,
            'title'        => $title,
            'description'  => 'Risk of key system downtime impacting operations',
            'category'     => 'operational',
            'likelihood'   => 3,
            'impact'       => 3,
        ]);
    }

    public function test_staff_can_list_risk_owners_including_themselves(): void
    {
        [$http, $user] = $this->asStaff();
        $other = $this->makeUser('staff', Tenant::find($user->tenant_id));

        $http->getJson('/api/v1/risk/lookups/owners')
            ->assertOk()
            ->assertJsonPath('data.0.id', $user->id)
            ->assertJsonFragment(['id' => $other->id, 'name' => $other->name]);
    }

    public function test_staff_can_apply_a_mitigation_to_multiple_risks(): void
    {
        Storage::fake('local');
        [$http, $user] = $this->asStaff();
        $a = $this->makeDraftRisk($user->tenant_id, $user->id, 'Risk A');
        $b = $this->makeDraftRisk($user->tenant_id, $user->id, 'Risk B');

        $file = UploadedFile::fake()->createWithContent('mitigation-plan.txt', "Deploy backup power and document the runbook.\n");

        $http->post('/api/v1/risk/mitigations', [
            'risk_ids' => [$a->id, $b->id],
            'description' => 'Deploy backup power and document the runbook',
            'treatment_type' => 'mitigate',
            'due_date' => now()->addDays(14)->toDateString(),
            'file' => $file,
        ])->assertCreated()
            ->assertJsonPath('applied', 2);

        $this->assertDatabaseHas('risk_actions', [
            'risk_id' => $a->id,
            'description' => 'Deploy backup power and document the runbook',
        ]);
        $this->assertDatabaseHas('risk_actions', [
            'risk_id' => $b->id,
            'description' => 'Deploy backup power and document the runbook',
        ]);
        $this->assertSame(2, RiskAction::query()->whereIn('risk_id', [$a->id, $b->id])->count());
        $this->assertDatabaseHas('attachments', [
            'attachable_id' => $a->id,
            'document_type' => 'risk_mitigation_plan',
        ]);
        $this->assertDatabaseHas('attachments', [
            'attachable_id' => $b->id,
            'document_type' => 'risk_mitigation_plan',
        ]);
    }

    public function test_guest_cannot_list_owners_or_apply_mitigations(): void
    {
        $this->getJson('/api/v1/risk/lookups/owners')->assertUnauthorized();
        $this->postJson('/api/v1/risk/mitigations', [
            'risk_ids' => [1],
            'description' => 'Should not apply',
        ])->assertUnauthorized();
    }

    public function test_apply_mitigation_requires_description(): void
    {
        [$http, $user] = $this->asStaff();
        $risk = $this->makeDraftRisk($user->tenant_id, $user->id);

        $http->postJson('/api/v1/risk/mitigations', [
            'risk_ids' => [$risk->id],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['description']);
    }

    public function test_cannot_apply_mitigation_to_another_tenants_risk(): void
    {
        [$http] = $this->asStaff();
        $foreignTenant = Tenant::factory()->create();
        $foreignUser = $this->makeUser('staff', $foreignTenant);
        $foreign = $this->makeDraftRisk($foreignTenant->id, $foreignUser->id, 'Foreign');

        $http->postJson('/api/v1/risk/mitigations', [
            'risk_ids' => [$foreign->id],
            'description' => 'Should not apply',
        ])->assertStatus(404);

        $this->assertDatabaseMissing('risk_actions', ['risk_id' => $foreign->id]);
    }
}
