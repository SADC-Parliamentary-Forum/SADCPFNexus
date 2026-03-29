<?php

namespace Database\Seeders;

use App\Models\GovernanceCommittee;
use App\Models\GovernanceMeetingType;
use App\Models\Tenant;
use Illuminate\Database\Seeder;

class GovernanceConfigSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::first();
        if (! $tenant) {
            return;
        }

        $this->seedCommittees($tenant->id);
        $this->seedMeetingTypes($tenant->id);
    }

    private function seedCommittees(int $tenantId): void
    {
        $defaults = [
            ['name' => 'Finance',                  'color' => '#3b82f6', 'sort_order' => 1],
            ['name' => 'Health & Safety',           'color' => '#f43f5e', 'sort_order' => 2],
            ['name' => 'Public Accounts',           'color' => '#f59e0b', 'sort_order' => 3],
            ['name' => 'Foreign Affairs',           'color' => '#6366f1', 'sort_order' => 4],
            ['name' => 'Education',                 'color' => '#a855f7', 'sort_order' => 5],
            ['name' => 'Infrastructure',            'color' => '#f97316', 'sort_order' => 6],
            ['name' => 'Legal & Constitutional',    'color' => '#14b8a6', 'sort_order' => 7],
            ['name' => 'Gender & Development',      'color' => '#ec4899', 'sort_order' => 8],
        ];

        foreach ($defaults as $row) {
            GovernanceCommittee::firstOrCreate(
                ['tenant_id' => $tenantId, 'name' => $row['name']],
                ['color' => $row['color'], 'is_active' => true, 'sort_order' => $row['sort_order']]
            );
        }
    }

    private function seedMeetingTypes(int $tenantId): void
    {
        $defaults = [
            ['name' => 'Staff Meeting',      'sort_order' => 1],
            ['name' => 'Committee Meeting',  'sort_order' => 2],
            ['name' => 'Board Meeting',      'sort_order' => 3],
            ['name' => 'Ad Hoc Meeting',     'sort_order' => 4],
            ['name' => 'Plenary Assembly',   'sort_order' => 5],
        ];

        foreach ($defaults as $row) {
            GovernanceMeetingType::firstOrCreate(
                ['tenant_id' => $tenantId, 'name' => $row['name']],
                ['is_active' => true, 'sort_order' => $row['sort_order']]
            );
        }
    }
}
