<?php

namespace Database\Seeders;

use App\Modules\Leave\Services\LeavePolicyService;
use Illuminate\Database\Seeder;

class DefaultLeavePolicySeeder extends Seeder
{
    public function run(): void
    {
        app(LeavePolicyService::class)->ensureForAllTenants();
    }
}
