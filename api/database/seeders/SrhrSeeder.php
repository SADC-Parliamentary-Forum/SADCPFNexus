<?php

namespace Database\Seeders;

use App\Models\HrPersonalFile;
use App\Models\Parliament;
use App\Models\ResearcherReport;
use App\Models\StaffDeployment;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

/**
 * Seeds the SRHR module:
 *  - 14 SADC member state parliaments
 *  - 2 SRHR Researcher user accounts
 *  - 1 active deployment (researcher at Parliament of Zimbabwe)
 *  - 1 draft and 1 submitted sample report
 */
class SrhrSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::where('slug', 'sadcpf')->first();
        if (!$tenant) {
            $this->command->warn('Tenant not found — skipping SrhrSeeder.');
            return;
        }

        $admin = User::where('email', 'admin@sadcpf.org')->first();
        if (!$admin) {
            $this->command->warn('Admin user not found — skipping SrhrSeeder.');
            return;
        }

        $parliaments = $this->seedParliaments($tenant);
        $researchers = $this->seedResearchers($tenant);
        $this->seedDeployments($tenant, $researchers, $parliaments, $admin);

        $this->command->info('SRHR seeder complete: ' . count($parliaments) . ' parliaments, ' . count($researchers) . ' researchers.');
    }

    private function seedParliaments(Tenant $tenant): array
    {
        $data = [
            ['country_code' => 'BW', 'country_name' => 'Botswana',          'name' => 'National Assembly of Botswana',              'city' => 'Gaborone'],
            ['country_code' => 'SZ', 'country_name' => 'Eswatini',          'name' => 'Parliament of the Kingdom of Eswatini',      'city' => 'Lobamba'],
            ['country_code' => 'LS', 'country_name' => 'Lesotho',           'name' => 'Parliament of Lesotho',                      'city' => 'Maseru'],
            ['country_code' => 'MG', 'country_name' => 'Madagascar',        'name' => 'Parliament of Madagascar',                   'city' => 'Antananarivo'],
            ['country_code' => 'MW', 'country_name' => 'Malawi',            'name' => 'Parliament of Malawi',                      'city' => 'Lilongwe'],
            ['country_code' => 'MU', 'country_name' => 'Mauritius',         'name' => 'National Assembly of Mauritius',             'city' => 'Port Louis'],
            ['country_code' => 'MZ', 'country_name' => 'Mozambique',        'name' => 'Assembleia da República de Moçambique',      'city' => 'Maputo'],
            ['country_code' => 'NA', 'country_name' => 'Namibia',           'name' => 'National Assembly of Namibia',               'city' => 'Windhoek'],
            ['country_code' => 'SC', 'country_name' => 'Seychelles',        'name' => 'National Assembly of Seychelles',            'city' => 'Victoria'],
            ['country_code' => 'ZA', 'country_name' => 'South Africa',      'name' => 'Parliament of South Africa',                 'city' => 'Cape Town'],
            ['country_code' => 'TZ', 'country_name' => 'Tanzania',          'name' => 'National Assembly of Tanzania',              'city' => 'Dodoma'],
            ['country_code' => 'ZM', 'country_name' => 'Zambia',            'name' => 'National Assembly of Zambia',                'city' => 'Lusaka'],
            ['country_code' => 'ZW', 'country_name' => 'Zimbabwe',          'name' => 'Parliament of Zimbabwe',                    'city' => 'Harare'],
            ['country_code' => 'CD', 'country_name' => 'DR Congo',          'name' => 'Assemblée Nationale de la RDC',             'city' => 'Kinshasa'],
        ];

        $parliaments = [];
        foreach ($data as $row) {
            $parliament = Parliament::firstOrCreate(
                ['tenant_id' => $tenant->id, 'country_code' => $row['country_code']],
                [
                    'name'        => $row['name'],
                    'country_name' => $row['country_name'],
                    'city'        => $row['city'],
                    'is_active'   => true,
                ]
            );
            $parliaments[$row['country_code']] = $parliament;
        }

        return $parliaments;
    }

    private function seedResearchers(Tenant $tenant): array
    {
        $researcherRole = Role::where('name', 'Field Researcher')->where('guard_name', 'sanctum')->first();

        $users = [];

        // Researcher 1 — deployed to Zimbabwe
        $researcher1 = User::firstOrCreate(
            ['email' => 'srhr.zw@sadcpf.org'],
            [
                'tenant_id'       => $tenant->id,
                'name'            => 'Tendai Moyo',
                'password'        => Hash::make('SRHR@2024!', ['rounds' => (int) env('BCRYPT_ROUNDS', 12)]),
                'employee_number' => 'SADCPF-R01',
                'job_title'       => 'Field Researcher',
                'classification'  => 'UNCLASSIFIED',
                'is_active'       => true,
            ]
        );
        if ($researcherRole) {
            $researcher1->syncRoles([$researcherRole]);
        }

        // Researcher 2 — deployed to Zambia
        $researcher2 = User::firstOrCreate(
            ['email' => 'srhr.zm@sadcpf.org'],
            [
                'tenant_id'       => $tenant->id,
                'name'            => 'Chanda Mwansa',
                'password'        => Hash::make('SRHR@2024!', ['rounds' => (int) env('BCRYPT_ROUNDS', 12)]),
                'employee_number' => 'SADCPF-R02',
                'job_title'       => 'Field Researcher',
                'classification'  => 'UNCLASSIFIED',
                'is_active'       => true,
            ]
        );
        if ($researcherRole) {
            $researcher2->syncRoles([$researcherRole]);
        }

        $users = [$researcher1, $researcher2];

        // Create HR Personal Files for both
        foreach ($users as $researcher) {
            HrPersonalFile::firstOrCreate(
                ['tenant_id' => $tenant->id, 'employee_id' => $researcher->id],
                [
                    'created_by'            => User::where('email', 'admin@sadcpf.org')->first()?->id,
                    'file_status'           => 'active',
                    'staff_number'          => $researcher->employee_number,
                    'employment_status'     => 'contract',
                    'confidentiality_classification' => 'standard',
                    'hr_managed_externally' => false, // will be set to true when deployment is activated
                ]
            );
        }

        return $users;
    }

    private function seedDeployments(Tenant $tenant, array $researchers, array $parliaments, User $admin): void
    {
        [$researcher1, $researcher2] = $researchers;

        $zwParliament = $parliaments['ZW'] ?? null;
        $zmParliament = $parliaments['ZM'] ?? null;

        // Active deployment: Tendai at Parliament of Zimbabwe
        if ($zwParliament && !StaffDeployment::where('employee_id', $researcher1->id)->exists()) {
            $deployment1 = StaffDeployment::create([
                'tenant_id'             => $tenant->id,
                'employee_id'           => $researcher1->id,
                'parliament_id'         => $zwParliament->id,
                'reference_number'      => 'DPMT-2026-001',
                'deployment_type'       => 'field_researcher',
                'research_area'         => 'SRHR',
                'research_focus'        => 'Sexual and Reproductive Health Rights policy research, parliamentary committee engagement, and stakeholder outreach.',
                'start_date'            => '2026-01-06',
                'end_date'              => '2026-12-31',
                'status'                => 'active',
                'supervisor_name'       => 'Hon. Grace Mutasa',
                'supervisor_title'      => 'Chairperson, Portfolio Committee on Health',
                'supervisor_email'      => 'g.mutasa@parlzim.gov.zw',
                'terms_of_reference'    => 'Conduct SRHR policy research, engage parliamentary committees on reproductive health legislation, and produce monthly activity reports for SADC-PF.',
                'hr_managed_externally' => true,
                'payroll_active'        => true,
                'created_by'            => $admin->id,
            ]);

            // Update HR file
            HrPersonalFile::where('employee_id', $researcher1->id)->update([
                'hr_managed_externally' => true,
                'active_deployment_id'  => $deployment1->id,
            ]);

            // Seed a submitted report (Feb 2026)
            ResearcherReport::create([
                'tenant_id'        => $tenant->id,
                'deployment_id'    => $deployment1->id,
                'employee_id'      => $researcher1->id,
                'parliament_id'    => $zwParliament->id,
                'reference_number' => 'RRP-2026-001',
                'report_type'      => 'monthly',
                'period_start'     => '2026-02-01',
                'period_end'       => '2026-02-28',
                'title'            => 'February 2026 — Monthly Activity Report',
                'status'           => 'submitted',
                'executive_summary' => 'February was a productive month with significant engagement with the Portfolio Committee on Health. Key highlights include a stakeholder workshop on reproductive health policy and a briefing note submitted to the Committee Chairperson.',
                'activities_undertaken' => [
                    ['title' => 'Stakeholder Workshop', 'description' => 'Facilitated a workshop on SRHR policy gaps with 24 participants (MPs and civil society).', 'date' => '2026-02-11', 'outcome' => 'Produced a 4-page policy brief submitted to the Chairperson.'],
                    ['title' => 'Committee Briefing Note', 'description' => 'Drafted a briefing note on teenage pregnancy statistics for the portfolio committee.', 'date' => '2026-02-19', 'outcome' => 'Accepted and tabled at the February 20 committee session.'],
                    ['title' => 'Media Monitoring', 'description' => 'Compiled monthly media monitoring report on SRHR coverage in Zimbabwean press.', 'date' => '2026-02-28', 'outcome' => '12 articles identified; summary submitted to SADC-PF.'],
                ],
                'challenges_faced'  => 'Limited access to committee scheduling information made planning difficult. One planned parliamentary visit was postponed due to a plenary session override.',
                'recommendations'   => 'SADC-PF should engage the Parliament secretariat directly for advance scheduling of researcher access.',
                'next_period_plan'  => 'March focus: SRHR bill tracking, engagement with women\'s caucus, and preparation of Q1 quarterly report.',
                'srhr_indicators'   => ['workshops_held' => 1, 'mps_engaged' => 7, 'policy_briefs_submitted' => 1, 'media_items_monitored' => 12],
                'submitted_at'      => '2026-03-05 09:00:00',
            ]);

            // Seed a draft report (March 2026)
            ResearcherReport::create([
                'tenant_id'        => $tenant->id,
                'deployment_id'    => $deployment1->id,
                'employee_id'      => $researcher1->id,
                'parliament_id'    => $zwParliament->id,
                'reference_number' => 'RRP-2026-002',
                'report_type'      => 'monthly',
                'period_start'     => '2026-03-01',
                'period_end'       => '2026-03-31',
                'title'            => 'March 2026 — Monthly Activity Report',
                'status'           => 'draft',
                'executive_summary' => null,
                'activities_undertaken' => null,
            ]);
        }

        // Active deployment: Chanda at National Assembly of Zambia
        if ($zmParliament && !StaffDeployment::where('employee_id', $researcher2->id)->exists()) {
            $deployment2 = StaffDeployment::create([
                'tenant_id'             => $tenant->id,
                'employee_id'           => $researcher2->id,
                'parliament_id'         => $zmParliament->id,
                'reference_number'      => 'DPMT-2026-002',
                'deployment_type'       => 'field_researcher',
                'research_area'         => 'Gender & Equality',
                'research_focus'        => 'Gender-responsive budgeting, women\'s political participation, and GBV policy tracking.',
                'start_date'            => '2026-02-01',
                'end_date'              => null, // open-ended
                'status'                => 'active',
                'supervisor_name'       => 'Mr. David Sichilima',
                'supervisor_title'      => 'Director, Parliamentary Research Services',
                'supervisor_email'      => 'd.sichilima@parliament.gov.zm',
                'terms_of_reference'    => 'Provide SRHR research support to the Committee on Health, Community Development, and Social Services. Submit quarterly reports to SADC-PF.',
                'hr_managed_externally' => true,
                'payroll_active'        => true,
                'created_by'            => $admin->id,
            ]);

            HrPersonalFile::where('employee_id', $researcher2->id)->update([
                'hr_managed_externally' => true,
                'active_deployment_id'  => $deployment2->id,
            ]);
        }
    }
}
