<?php

namespace Database\Seeders;

use App\Models\HrGradeBand;
use App\Models\HrJobFamily;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Seeds HR Settings master data for SADC-PF:
 * - 6 Job Families
 * - 8 Grade Bands (A1–D2, matching existing positions.grade codes)
 *
 * All grade bands are seeded as 'published' so they are immediately usable.
 */
class HrSettingsSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::where('slug', 'sadcpf')->first();
        if (! $tenant) {
            return;
        }

        // Use admin user as creator/approver/publisher for seeded records
        $admin = User::where('tenant_id', $tenant->id)
            ->where('email', 'admin@sadcpf.org')
            ->first();
        $adminId = $admin?->id ?? 1;

        // ── Job Families ───────────────────────────────────────────────────────

        $families = [
            ['code' => 'EXEC', 'name' => 'Executive & Administration', 'color' => '#7c3aed', 'icon' => 'star'],
            ['code' => 'FIN',  'name' => 'Finance & Accounting',        'color' => '#059669', 'icon' => 'account_balance'],
            ['code' => 'HR',   'name' => 'Human Resources',             'color' => '#db2777', 'icon' => 'people'],
            ['code' => 'ICT',  'name' => 'Information Technology',      'color' => '#2563eb', 'icon' => 'computer'],
            ['code' => 'PAF',  'name' => 'Parliamentary Affairs',       'color' => '#1d85ed', 'icon' => 'gavel'],
            ['code' => 'PSC',  'name' => 'Procurement & Supply Chain',  'color' => '#d97706', 'icon' => 'shopping_cart'],
        ];

        $familyIds = [];
        foreach ($families as $f) {
            $jf = HrJobFamily::firstOrCreate(
                ['tenant_id' => $tenant->id, 'code' => $f['code']],
                [
                    'name'   => $f['name'],
                    'color'  => $f['color'],
                    'icon'   => $f['icon'],
                    'status' => 'active',
                ]
            );
            $familyIds[$f['code']] = $jf->id;
        }

        // ── Grade Bands ────────────────────────────────────────────────────────
        // Aligned with the grade strings used in positions table (A1–D2)

        $now = now();

        $bands = [
            [
                'code'                      => 'A1',
                'label'                     => 'Secretary General',
                'band_group'                => 'A',
                'employment_category'       => 'regional',
                'min_notch'                 => 1,
                'max_notch'                 => 5,
                'probation_months'          => 0,
                'notice_period_days'        => 90,
                'leave_days_per_year'       => 30.0,
                'overtime_eligible'         => false,
                'acting_allowance_rate'     => null,
                'travel_class'              => 'business',
                'medical_aid_eligible'      => true,
                'housing_allowance_eligible'=> true,
            ],
            [
                'code'                      => 'B1',
                'label'                     => 'Director',
                'band_group'                => 'B',
                'employment_category'       => 'regional',
                'min_notch'                 => 1,
                'max_notch'                 => 8,
                'probation_months'          => 3,
                'notice_period_days'        => 60,
                'leave_days_per_year'       => 25.0,
                'overtime_eligible'         => false,
                'acting_allowance_rate'     => 0.10,
                'travel_class'              => 'business',
                'medical_aid_eligible'      => true,
                'housing_allowance_eligible'=> true,
            ],
            [
                'code'                      => 'B2',
                'label'                     => 'Senior Manager',
                'band_group'                => 'B',
                'employment_category'       => 'regional',
                'min_notch'                 => 1,
                'max_notch'                 => 10,
                'probation_months'          => 6,
                'notice_period_days'        => 60,
                'leave_days_per_year'       => 25.0,
                'overtime_eligible'         => false,
                'acting_allowance_rate'     => 0.10,
                'travel_class'              => 'economy',
                'medical_aid_eligible'      => true,
                'housing_allowance_eligible'=> true,
            ],
            [
                'code'                      => 'B3',
                'label'                     => 'Manager',
                'band_group'                => 'B',
                'employment_category'       => 'local',
                'min_notch'                 => 1,
                'max_notch'                 => 12,
                'probation_months'          => 6,
                'notice_period_days'        => 30,
                'leave_days_per_year'       => 21.0,
                'overtime_eligible'         => false,
                'acting_allowance_rate'     => 0.075,
                'travel_class'              => 'economy',
                'medical_aid_eligible'      => true,
                'housing_allowance_eligible'=> false,
            ],
            [
                'code'                      => 'C1',
                'label'                     => 'Senior Officer',
                'band_group'                => 'C',
                'employment_category'       => 'local',
                'min_notch'                 => 1,
                'max_notch'                 => 12,
                'probation_months'          => 6,
                'notice_period_days'        => 30,
                'leave_days_per_year'       => 21.0,
                'overtime_eligible'         => false,
                'acting_allowance_rate'     => 0.075,
                'travel_class'              => 'economy',
                'medical_aid_eligible'      => true,
                'housing_allowance_eligible'=> false,
            ],
            [
                'code'                      => 'C2',
                'label'                     => 'Officer',
                'band_group'                => 'C',
                'employment_category'       => 'local',
                'min_notch'                 => 1,
                'max_notch'                 => 12,
                'probation_months'          => 6,
                'notice_period_days'        => 30,
                'leave_days_per_year'       => 21.0,
                'overtime_eligible'         => false,
                'acting_allowance_rate'     => null,
                'travel_class'              => 'economy',
                'medical_aid_eligible'      => true,
                'housing_allowance_eligible'=> false,
            ],
            [
                'code'                      => 'D1',
                'label'                     => 'Senior Support Staff',
                'band_group'                => 'D',
                'employment_category'       => 'local',
                'min_notch'                 => 1,
                'max_notch'                 => 12,
                'probation_months'          => 6,
                'notice_period_days'        => 30,
                'leave_days_per_year'       => 21.0,
                'overtime_eligible'         => true,
                'acting_allowance_rate'     => null,
                'travel_class'              => 'economy',
                'medical_aid_eligible'      => true,
                'housing_allowance_eligible'=> false,
            ],
            [
                'code'                      => 'D2',
                'label'                     => 'Support Staff',
                'band_group'                => 'D',
                'employment_category'       => 'local',
                'min_notch'                 => 1,
                'max_notch'                 => 12,
                'probation_months'          => 6,
                'notice_period_days'        => 30,
                'leave_days_per_year'       => 21.0,
                'overtime_eligible'         => true,
                'acting_allowance_rate'     => null,
                'travel_class'              => 'economy',
                'medical_aid_eligible'      => true,
                'housing_allowance_eligible'=> false,
            ],
        ];

        foreach ($bands as $band) {
            HrGradeBand::firstOrCreate(
                [
                    'tenant_id'      => $tenant->id,
                    'code'           => $band['code'],
                    'version_number' => 1,
                ],
                array_merge($band, [
                    'tenant_id'      => $tenant->id,
                    'status'         => 'published',
                    'effective_from' => '2024-01-01',
                    'version_number' => 1,
                    'created_by'     => $adminId,
                    'approved_by'    => $adminId,
                    'published_by'   => $adminId,
                    'approved_at'    => $now,
                    'published_at'   => $now,
                ])
            );
        }
    }
}
