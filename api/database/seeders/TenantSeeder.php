<?php

namespace Database\Seeders;

use App\Models\Tenant;
use Illuminate\Database\Seeder;

class TenantSeeder extends Seeder
{
    /**
     * Create the default demo tenant. Used by all other seeders.
     * Safe for migrate:fresh --seed (dev/demo only).
     */
    public function run(): void
    {
        Tenant::firstOrCreate(
            ['slug' => 'sadcpf'],
            [
                'name'      => 'SADC Parliamentary Forum',
                'domain'    => 'sadcpf.org',
                'is_active' => true,
            ]
        );
    }
}
