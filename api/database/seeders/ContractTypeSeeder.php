<?php

namespace Database\Seeders;

use App\Models\ContractType;
use App\Models\Tenant;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeds the initial configurable contract categories (PRD §9) for every tenant.
 * Idempotent — safe to re-run.
 */
class ContractTypeSeeder extends Seeder
{
    public function run(): void
    {
        // name, counterparty_type, category, requires_legal_review
        $types = [
            ['Independent Consultant Agreement', 'individual', 'services', false],
            ['Interpreter Agreement', 'individual', 'services', false],
            ['Rapporteur Agreement', 'individual', 'services', false],
            ['Resource Person Agreement', 'individual', 'services', false],
            ['Professional Services Agreement', 'either', 'services', true],
            ['Contractual Agreement', 'organisation', 'services', true],
            ['Goods Supply Agreement', 'organisation', 'goods', false],
            ['ICT/Technology Agreement', 'organisation', 'goods', true],
            ['Software Subscription Agreement', 'organisation', 'services', true],
            ['Maintenance Agreement', 'organisation', 'services', false],
            ['Venue/Conference Services Agreement', 'organisation', 'services', false],
            ['Framework Agreement', 'organisation', 'services', true],
            ['Call-Off Contract', 'organisation', 'services', false],
            ['Works Contract', 'organisation', 'works', true],
            ['Other Procurement Contract', 'either', 'services', false],
        ];

        Tenant::query()->each(function (Tenant $tenant) use ($types): void {
            foreach ($types as $i => [$name, $counterparty, $category, $legal]) {
                ContractType::updateOrCreate(
                    ['tenant_id' => $tenant->id, 'slug' => Str::slug($name)],
                    [
                        'name' => $name,
                        'counterparty_type' => $counterparty,
                        'category' => $category,
                        'requires_legal_review' => $legal,
                        'is_active' => true,
                        'sort_order' => $i,
                    ],
                );
            }
        });
    }
}
