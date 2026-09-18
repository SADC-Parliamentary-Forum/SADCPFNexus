<?php

namespace Tests\Feature\Contracts;

use App\Models\Contract;
use App\Models\ContractTemplate;
use App\Models\ContractTemplateVersion;
use App\Models\ContractType;
use App\Models\Tenant;
use App\Models\Vendor;
use Database\Seeders\ContractTemplateSeeder;
use Database\Seeders\ContractTypeSeeder;
use Database\Seeders\WorkflowSeeder;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * WS7 — release-blocking acceptance tests not covered elsewhere:
 * §116 template version pinning and §118 approval separation of duties.
 */
class ContractAcceptanceTest extends TestCase
{
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenant = Tenant::factory()->create();
        Storage::fake();
        $this->seed(ContractTypeSeeder::class);
        $this->seed(ContractTemplateSeeder::class);
        $this->seed(WorkflowSeeder::class);
    }

    public function test_template_version_is_pinned_to_the_contract(): void
    {
        // §116 — generating on v1.0 pins v1.0; later activating v2.0 must not
        // change the existing contract's linked version.
        [$http] = $this->asProcurementOfficer($this->tenant);
        $vendor = Vendor::create(['tenant_id' => $this->tenant->id, 'name' => 'V', 'status' => 'approved', 'is_approved' => true, 'is_active' => true]);
        $type = ContractType::where('tenant_id', $this->tenant->id)->where('name', 'Interpreter Agreement')->firstOrFail();

        $id = $http->postJson('/api/v1/contracts', [
            'type_id' => $type->id, 'counterparty_type' => 'organisation', 'vendor_id' => $vendor->id,
            'title' => 'Pinned', 'start_date' => now()->addDay()->toDateString(), 'end_date' => now()->addDays(9)->toDateString(),
            'value' => 900, 'currency' => 'USD',
        ])->assertCreated()->json('data.id');

        $template = ContractTemplate::where('tenant_id', $this->tenant->id)->whereNotNull('current_version_id')->first();
        $v1 = $template->current_version_id;
        $http->postJson("/api/v1/contracts/{$id}/generate", ['template_version_id' => $v1])->assertOk();
        $this->assertSame($v1, Contract::find($id)->template_version_id);

        // Publish v2.0 and activate it (supersedes v1.0).
        $v2 = $http->postJson("/api/v1/contracts/templates/{$template->id}/versions", ['version' => 'v2.0', 'body' => 'Updated {{contract.number}}'])
            ->assertCreated()->json('data.id');
        $http->postJson("/api/v1/contracts/templates/{$template->id}/versions/{$v2}/activate")->assertOk();

        // Existing contract remains pinned to v1.0.
        $this->assertSame($v1, Contract::find($id)->template_version_id);
        $this->assertSame('SUPERSEDED', ContractTemplateVersion::find($v1)->status);
        $this->assertSame('ACTIVE', ContractTemplateVersion::find($v2)->status);
    }

    public function test_creating_officer_cannot_perform_finance_approval(): void
    {
        // §118 — the Procurement Officer who created the contract cannot act on
        // the Finance approval stage.
        [$http] = $this->asProcurementOfficer($this->tenant);
        $vendor = Vendor::create(['tenant_id' => $this->tenant->id, 'name' => 'V', 'status' => 'approved', 'is_approved' => true, 'is_active' => true]);
        $type = ContractType::where('tenant_id', $this->tenant->id)->where('name', 'Interpreter Agreement')->firstOrFail();

        $id = $http->postJson('/api/v1/contracts', [
            'type_id' => $type->id, 'counterparty_type' => 'organisation', 'vendor_id' => $vendor->id,
            'title' => 'SoD', 'start_date' => now()->addDay()->toDateString(), 'end_date' => now()->addDays(9)->toDateString(),
            'value' => 900, 'currency' => 'USD',
        ])->assertCreated()->json('data.id');

        $version = ContractTemplateVersion::whereHas('template', fn ($q) => $q->where('tenant_id', $this->tenant->id))->where('status', 'ACTIVE')->first();
        $http->postJson("/api/v1/contracts/{$id}/generate", ['template_version_id' => $version->id])->assertOk();
        $http->postJson("/api/v1/contracts/{$id}/submit")->assertOk();

        // The creator (Procurement Officer) is denied the approval action.
        $http->postJson("/api/v1/contracts/{$id}/approve", ['comment' => 'self approve'])->assertForbidden();
    }
}
