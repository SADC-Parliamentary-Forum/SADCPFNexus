<?php

namespace Tests\Feature\Contracts;

use App\Models\Contract;
use App\Models\ContractTemplate;
use App\Models\ContractTemplateVersion;
use App\Models\ContractType;
use App\Models\ProcurementRequest;
use App\Models\Tenant;
use App\Models\Vendor;
use Database\Seeders\ContractTemplateSeeder;
use Database\Seeders\ContractTypeSeeder;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * WS2 — creation wizard: auto-calc, origin prefill, deliverables/obligations,
 * template generation (mandatory-field gated) and readiness.
 */
class ContractCreationTest extends TestCase
{
    private function seedTypes(Tenant $tenant): void
    {
        $this->seed(ContractTypeSeeder::class);
        $this->seed(ContractTemplateSeeder::class);
    }

    private function interpreterType(Tenant $tenant): ContractType
    {
        return ContractType::where('tenant_id', $tenant->id)->where('name', 'Interpreter Agreement')->firstOrFail();
    }

    public function test_create_auto_calculates_value_and_persists_children(): void
    {
        $tenant = Tenant::factory()->create();
        $this->seedTypes($tenant);
        [$http, $officer] = $this->asProcurementOfficer($tenant);

        $res = $http->postJson('/api/v1/contracts', [
            'origin_type' => 'standalone',
            'origin_reference' => 'Ad-hoc interpretation need',
            'type_id' => $this->interpreterType($tenant)->id,
            'counterparty_type' => 'individual',
            'counterparty' => ['first_name' => 'Stephane', 'surname' => 'Aduya-Ngandu', 'email' => 's@example.test'],
            'title' => 'French Interpretation — Legal Drafters Meeting',
            'start_date' => now()->addDays(10)->toDateString(),
            'end_date' => now()->addDays(11)->toDateString(),
            'rate' => 450,
            'rate_basis' => 'per day',
            'units' => 2,
            'currency' => 'USD',
            'deliverables' => [['name' => 'Interpretation Day 1'], ['name' => 'Interpretation Day 2']],
            'obligations' => [['obligation' => 'Maintain confidentiality', 'responsible_party' => 'counterparty']],
        ])->assertCreated();

        // USD 450 x 2 days = USD 900, derived automatically (PRD §20).
        $res->assertJsonPath('data.value', '900.00')
            ->assertJsonPath('data.original_value', '900.00')
            ->assertJsonPath('data.current_value', '900.00')
            ->assertJsonPath('data.counterparty_type', 'individual');

        $contract = Contract::firstWhere('title', 'French Interpretation — Legal Drafters Meeting');
        $this->assertSame('Stephane Aduya-Ngandu', $contract->counterparty_name);
        $this->assertCount(2, $contract->deliverables);
        $this->assertCount(1, $contract->obligations);
    }

    public function test_prefill_from_procurement_award_prepopulates_controlled_values(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);

        $pr = ProcurementRequest::create([
            'tenant_id' => $tenant->id,
            'requester_id' => $officer->id,
            'reference_number' => 'PRQ-TESTAWARD',
            'title' => 'Conference Interpretation Services',
            'description' => 'Interpretation for annual meeting',
            'category' => 'services',
            'estimated_value' => 12000,
            'currency' => 'USD',
            'status' => 'awarded',
            'budget_line' => 'OP-01',
        ]);

        $res = $http->postJson('/api/v1/contracts/prefill', [
            'origin_type' => 'procurement', 'origin_id' => $pr->id,
        ])->assertOk();

        $res->assertJsonPath('data.title', 'Conference Interpretation Services')
            ->assertJsonPath('data.award_reference', 'PRQ-TESTAWARD')
            ->assertJsonPath('data.value', 12000)
            ->assertJsonPath('data.procurement_request_id', $pr->id);
    }

    public function test_generate_working_draft_and_readiness(): void
    {
        Storage::fake();
        $tenant = Tenant::factory()->create();
        $this->seedTypes($tenant);
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $vendor = Vendor::create(['tenant_id' => $tenant->id, 'name' => 'Lingua CC', 'status' => 'approved', 'is_approved' => true, 'is_active' => true]);

        $contract = $http->postJson('/api/v1/contracts', [
            'type_id' => $this->interpreterType($tenant)->id,
            'counterparty_type' => 'organisation',
            'vendor_id' => $vendor->id,
            'title' => 'Interpretation Retainer',
            'start_date' => now()->addDays(5)->toDateString(),
            'end_date' => now()->addDays(20)->toDateString(),
            'value' => 5000, 'currency' => 'USD',
        ])->assertCreated()->json('data.id');

        $version = ContractTemplateVersion::whereHas('template', fn ($q) => $q->where('tenant_id', $tenant->id))
            ->where('status', 'ACTIVE')->first();

        // Not ready before a document is generated (blocking check).
        $before = $http->getJson("/api/v1/contracts/{$contract}/readiness")->assertOk()->json('data.ready');
        $this->assertFalse($before);

        $doc = $http->postJson("/api/v1/contracts/{$contract}/generate", ['template_version_id' => $version->id])
            ->assertOk();
        $doc->assertJsonPath('data.kind', 'working');
        $this->assertNotEmpty($doc->json('data.hash'));

        $after = $http->getJson("/api/v1/contracts/{$contract}/readiness")->assertOk()->json('data.ready');
        $this->assertTrue($after);
    }

    public function test_generate_blocks_when_mandatory_merge_field_missing(): void
    {
        Storage::fake();
        $tenant = Tenant::factory()->create();
        $this->seedTypes($tenant);
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $vendor = Vendor::create(['tenant_id' => $tenant->id, 'name' => 'Lingua CC', 'status' => 'approved', 'is_approved' => true, 'is_active' => true]);

        // Template that requires a field which never resolves (signatory not yet assigned).
        $template = ContractTemplate::create([
            'tenant_id' => $tenant->id, 'name' => 'Strict', 'status' => 'ACTIVE', 'counterparty_type' => 'organisation',
        ]);
        $version = ContractTemplateVersion::create([
            'tenant_id' => $tenant->id, 'template_id' => $template->id, 'version' => 'v1.0',
            'body' => 'Signed by {{signatory.full_name}}',
            'variables' => [['key' => 'signatory.full_name', 'required' => true]],
            'status' => 'ACTIVE',
        ]);

        $contract = $http->postJson('/api/v1/contracts', [
            'counterparty_type' => 'organisation', 'vendor_id' => $vendor->id,
            'title' => 'Strict Contract', 'start_date' => now()->addDay()->toDateString(),
            'end_date' => now()->addDays(9)->toDateString(), 'value' => 100, 'currency' => 'USD',
        ])->assertCreated()->json('data.id');

        $http->postJson("/api/v1/contracts/{$contract}/generate", ['template_version_id' => $version->id])
            ->assertStatus(422)
            ->assertJsonValidationErrors('template');
    }
}
