<?php

namespace Database\Seeders;

use App\Models\ContractClause;
use App\Models\ContractClauseVersion;
use App\Models\Tenant;
use Illuminate\Database\Seeder;

/**
 * Seeds a starter clause library per tenant (PRD §30/§31). The termination-by-
 * SADC-PF clause is mandatory locked per the Accounting Manual; confidentiality
 * and anti-fraud are mandatory editable; donor audit access is donor-specific.
 */
class ContractClauseSeeder extends Seeder
{
    public function run(): void
    {
        // key, title, category, clause_type, body, donor
        $clauses = [
            ['termination_sadcpf', 'Termination by SADC PF', 'termination', 'mandatory_locked', 'SADC PF may terminate this agreement by written notice where the Contractor fails to perform.', null],
            ['confidentiality', 'Confidentiality', 'confidentiality', 'mandatory_editable', 'The Contractor shall keep all SADC PF information confidential during and after the term.', null],
            ['anti_fraud', 'Anti-Fraud and Anti-Corruption', 'compliance', 'mandatory_editable', 'The parties warrant they will not engage in fraudulent or corrupt practices.', null],
            ['data_protection', 'Data Protection', 'compliance', 'mandatory_editable', 'Personal data shall be processed lawfully and only for the purposes of this agreement.', null],
            ['dispute_resolution', 'Dispute Resolution', 'governance', 'optional', 'Disputes shall be resolved amicably, failing which by arbitration.', null],
            ['force_majeure', 'Force Majeure', 'governance', 'optional', 'Neither party is liable for delay caused by events beyond its reasonable control.', null],
            ['donor_audit_access', 'Donor Audit Access', 'donor', 'donor_specific', 'The donor and its auditors may access records relating to donor-funded activities.', null],
        ];

        Tenant::query()->each(function (Tenant $tenant) use ($clauses): void {
            foreach ($clauses as $i => [$key, $title, $category, $type, $body, $donor]) {
                if (ContractClause::where('tenant_id', $tenant->id)->where('key', $key)->exists()) {
                    continue;
                }
                $clause = ContractClause::create([
                    'tenant_id' => $tenant->id, 'key' => $key, 'title' => $title, 'category' => $category,
                    'clause_type' => $type, 'donor' => $donor, 'is_active' => true, 'sort_order' => $i,
                ]);
                $version = ContractClauseVersion::create([
                    'tenant_id' => $tenant->id, 'clause_id' => $clause->id, 'version' => 'v1.0',
                    'body' => $body, 'status' => 'ACTIVE', 'effective_date' => now()->toDateString(),
                ]);
                $clause->update(['current_version_id' => $version->id]);
            }
        });
    }
}
