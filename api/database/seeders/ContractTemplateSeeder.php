<?php

namespace Database\Seeders;

use App\Models\ContractTemplate;
use App\Models\ContractTemplateVersion;
use App\Models\ContractType;
use App\Models\Tenant;
use Illuminate\Database\Seeder;

/**
 * Seeds a couple of ACTIVE contract templates per tenant so the generation flow
 * works out of the box. Mirrors the structure of the uploaded interpreter and
 * consultant agreements (PRD §2).
 */
class ContractTemplateSeeder extends Seeder
{
    public function run(): void
    {
        $body = <<<'HTML'
<h1>{{contract.type}}</h1>
<p><strong>Reference:</strong> {{contract.number}}</p>
<p>This Agreement is made between the SADC Parliamentary Forum and
<strong>{{counterparty.full_name}}</strong> (email: {{counterparty.email}}).</p>
<h2>1. Assignment</h2>
<p>{{activity.title}} at {{activity.location}}.</p>
<h2>2. Duration</h2>
<p>From {{contract.start_date}} to {{contract.end_date}}.</p>
<h2>3. Remuneration</h2>
<p>{{financial.currency}} {{financial.rate}} per unit x {{financial.units}} =
<strong>{{financial.currency}} {{financial.total}}</strong>.</p>
<h2>4. Confidentiality</h2>
<p>The Contractor shall keep all SADC PF information confidential.</p>
<h2>5. Signatures</h2>
<p>For SADC PF: {{signatory.full_name}} ({{signatory.title}})</p>
<p>Contractor: {{counterparty.full_name}}</p>
HTML;

        $variables = [
            ['key' => 'contract.number', 'required' => true],
            ['key' => 'counterparty.full_name', 'required' => true],
            ['key' => 'contract.start_date', 'required' => true],
            ['key' => 'contract.end_date', 'required' => true],
            ['key' => 'financial.total', 'required' => true],
        ];

        Tenant::query()->each(function (Tenant $tenant) use ($body, $variables): void {
            foreach (['Interpreter Agreement', 'Independent Consultant Agreement'] as $typeName) {
                $type = ContractType::where('tenant_id', $tenant->id)->where('name', $typeName)->first();

                $template = ContractTemplate::firstOrCreate(
                    ['tenant_id' => $tenant->id, 'name' => $typeName.' Template'],
                    [
                        'contract_type_id' => $type?->id,
                        'counterparty_type' => 'individual',
                        'description' => 'Default '.$typeName.' template.',
                        'status' => 'ACTIVE',
                        'created_by' => null,
                    ],
                );

                if ($template->versions()->exists()) {
                    continue;
                }

                $version = ContractTemplateVersion::create([
                    'tenant_id' => $tenant->id,
                    'template_id' => $template->id,
                    'version' => 'v1.0',
                    'body' => $body,
                    'variables' => $variables,
                    'status' => 'ACTIVE',
                    'effective_date' => now()->toDateString(),
                ]);

                $template->update(['current_version_id' => $version->id, 'status' => 'ACTIVE']);
            }
        });
    }
}
