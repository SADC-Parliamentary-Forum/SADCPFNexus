<?php

namespace Database\Seeders;

use App\Models\Currency;
use App\Models\Tenant;
use Illuminate\Database\Seeder;

/**
 * Seeds the central currency reference per tenant. NAD is the institutional
 * default; USD is common for consultant/interpreter engagements. Idempotent.
 */
class CurrencySeeder extends Seeder
{
    public function run(): void
    {
        // code, name, symbol, is_default
        $currencies = [
            ['NAD', 'Namibian Dollar', 'N$', true],
            ['USD', 'US Dollar', '$', false],
            ['ZAR', 'South African Rand', 'R', false],
            ['EUR', 'Euro', '€', false],
            ['GBP', 'Pound Sterling', '£', false],
            ['BWP', 'Botswana Pula', 'P', false],
            ['ZMW', 'Zambian Kwacha', 'ZK', false],
        ];

        Tenant::query()->each(function (Tenant $tenant) use ($currencies): void {
            foreach ($currencies as $i => [$code, $name, $symbol, $isDefault]) {
                Currency::updateOrCreate(
                    ['tenant_id' => $tenant->id, 'code' => $code],
                    ['name' => $name, 'symbol' => $symbol, 'is_default' => $isDefault, 'is_active' => true, 'sort_order' => $i],
                );
            }
        });
    }
}
