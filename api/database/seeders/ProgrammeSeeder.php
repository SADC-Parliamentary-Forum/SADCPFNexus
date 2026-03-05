<?php

namespace Database\Seeders;

use App\Models\Programme;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Seeder;

class ProgrammeSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::where('slug', 'sadcpf')->first();
        if (!$tenant) {
            return;
        }

        $admin   = User::where('email', 'admin@sadcpf.org')->first();
        $staff   = User::where('email', 'staff@sadcpf.org')->first();
        $finance = User::where('email', 'finance@sadcpf.org')->first();

        $creator  = $staff   ?? $admin;
        $approver = $admin   ?? $finance;

        if (!$creator) {
            return;
        }

        $programmes = [
            [
                'reference_number'        => 'PIF-2026-001',
                'title'                   => 'Parliamentary Strengthening Programme',
                'status'                  => 'active',
                'strategic_pillar'        => 'Institutional Strengthening',
                'implementing_department' => 'Programmes',
                'background'              => 'This programme aims to enhance the capacity of SADC parliaments through targeted training, knowledge sharing, and institutional support. It responds to the growing need for effective legislative oversight across Member States.',
                'overall_objective'       => 'To strengthen the capacity of SADC parliamentary institutions to effectively perform their legislative and oversight functions.',
                'specific_objectives'     => ['Conduct capacity-building workshops for MPs', 'Develop legislative drafting manuals', 'Facilitate peer learning exchanges'],
                'expected_outputs'        => ['120 MPs trained', '3 legislative manuals produced', '4 peer exchange missions completed'],
                'target_beneficiaries'    => ['MPs', 'Parliamentary Staff', 'Civil Society'],
                'gender_considerations'   => 'At least 50% of training participants must be women MPs or female parliamentary staff.',
                'primary_currency'        => 'USD',
                'base_currency'           => 'USD',
                'exchange_rate'           => 1.0,
                'contingency_pct'         => 10.00,
                'total_budget'            => 1500000.00,
                'funding_source'          => 'European Union',
                'responsible_officer'     => 'Programme Manager',
                'start_date'              => '2026-01-01',
                'end_date'                => '2027-12-31',
                'travel_required'         => true,
                'delegates_count'         => 120,
                'member_states'           => ['Botswana', 'Zambia', 'Zimbabwe', 'Tanzania', 'Mozambique'],
                'procurement_required'    => true,
                'submitted_at'            => now()->subDays(30),
                'approved_at'             => now()->subDays(25),
                'approved_by'             => $approver?->id,
                'activities' => [
                    ['name' => 'Capacity Building Workshop – Lusaka',   'description' => 'Workshop for 40 MPs on legislative drafting', 'budget_allocation' => 120000, 'responsible' => 'Programme Officer', 'location' => 'Lusaka, Zambia',     'start_date' => '2026-03-10', 'end_date' => '2026-03-14', 'status' => 'in_progress'],
                    ['name' => 'Peer Exchange Mission – Windhoek',       'description' => 'Study visit for 20 parliamentary staff',    'budget_allocation' =>  85000, 'responsible' => 'Programme Manager', 'location' => 'Windhoek, Namibia',  'start_date' => '2026-05-05', 'end_date' => '2026-05-08', 'status' => 'approved'],
                    ['name' => 'Legislative Drafting Manual Development','description' => 'Produce 3 model legislative manuals',       'budget_allocation' =>  45000, 'responsible' => 'Legal Officer',     'location' => 'Gaborone, Botswana', 'start_date' => '2026-04-01', 'end_date' => '2026-09-30', 'status' => 'in_progress'],
                ],
                'milestones' => [
                    ['name' => 'First training cohort completed',    'target_date' => '2026-03-31', 'completion_pct' => 60, 'status' => 'pending'],
                    ['name' => 'Legislative manuals drafted & reviewed', 'target_date' => '2026-09-30', 'completion_pct' =>  0, 'status' => 'pending'],
                ],
                'deliverables' => [
                    ['name' => 'Inception Report',           'description' => 'Detailed work plan and budget breakdown', 'due_date' => '2026-02-28', 'status' => 'accepted'],
                    ['name' => 'Mid-term Progress Report',   'description' => 'Narrative and financial report',         'due_date' => '2026-06-30', 'status' => 'pending'],
                ],
                'budget_lines' => [
                    ['category' => 'staff_costs',           'description' => 'Programme Officer salary (2 years)',     'amount' => 280000, 'actual_spent' => 46667, 'funding_source' => 'donor'],
                    ['category' => 'consultancy',           'description' => 'Training facilitators and experts',      'amount' => 320000, 'actual_spent' => 85000, 'funding_source' => 'donor'],
                    ['category' => 'travel_dsa',            'description' => 'Travel & DSA for workshops & missions',  'amount' => 250000, 'actual_spent' => 42000, 'funding_source' => 'donor'],
                    ['category' => 'meetings_workshops',    'description' => 'Venue, catering, equipment hire',        'amount' => 180000, 'actual_spent' => 36000, 'funding_source' => 'donor'],
                    ['category' => 'contingency',           'description' => '10% contingency reserve',               'amount' => 150000, 'actual_spent' =>     0, 'funding_source' => 'donor'],
                ],
                'procurement_items' => [
                    ['description' => 'Training materials & participant kits (120 sets)', 'estimated_cost' => 36000, 'method' => 'three_quotations', 'status' => 'ordered'],
                    ['description' => 'Conference venue hire – Lusaka (5 days)',          'estimated_cost' => 18000, 'method' => 'direct_purchase',  'status' => 'delivered'],
                ],
            ],
            [
                'reference_number'        => 'PIF-2026-002',
                'title'                   => 'Gender & Youth Inclusion Initiative',
                'status'                  => 'approved',
                'strategic_pillar'        => 'Gender Equality & Youth Empowerment',
                'implementing_department' => 'Programmes',
                'background'              => 'Gender disparities in parliamentary representation remain a persistent challenge across the SADC region. This initiative targets systemic barriers and promotes affirmative measures.',
                'overall_objective'       => 'To increase the representation and participation of women and youth in SADC parliamentary processes.',
                'specific_objectives'     => ['Conduct gender audits in 5 Member States', 'Train 80 women candidates', 'Develop a SADC Model Gender Policy'],
                'expected_outputs'        => ['5 gender audit reports', '80 women trained', '1 model policy adopted'],
                'target_beneficiaries'    => ['Women', 'Youth', 'MPs', 'Civil Society'],
                'gender_considerations'   => 'This initiative is entirely gender-focused; all activities prioritise women and girl beneficiaries.',
                'primary_currency'        => 'USD',
                'base_currency'           => 'USD',
                'exchange_rate'           => 1.0,
                'contingency_pct'         => 10.00,
                'total_budget'            => 800000.00,
                'funding_source'          => 'USAID',
                'responsible_officer'     => 'Gender Specialist',
                'start_date'              => '2026-04-01',
                'end_date'                => '2027-03-31',
                'travel_required'         => true,
                'delegates_count'         => 80,
                'member_states'           => ['Malawi', 'Lesotho', 'Eswatini', 'Namibia', 'Angola'],
                'procurement_required'    => false,
                'submitted_at'            => now()->subDays(10),
                'approved_at'             => now()->subDays(5),
                'approved_by'             => $approver?->id,
                'activities' => [
                    ['name' => 'Gender Audit – Malawi Parliament',     'budget_allocation' => 45000, 'responsible' => 'Gender Specialist', 'location' => 'Lilongwe, Malawi',  'start_date' => '2026-05-01', 'end_date' => '2026-05-15', 'status' => 'approved'],
                    ['name' => 'Women Candidates Training – Maseru',   'budget_allocation' => 62000, 'responsible' => 'Programme Officer', 'location' => 'Maseru, Lesotho',   'start_date' => '2026-06-10', 'end_date' => '2026-06-14', 'status' => 'draft'],
                    ['name' => 'Model Gender Policy Drafting Workshop','budget_allocation' => 38000, 'responsible' => 'Legal Officer',     'location' => 'Gaborone, Botswana','start_date' => '2026-07-01', 'end_date' => '2026-07-05', 'status' => 'draft'],
                ],
                'milestones' => [
                    ['name' => 'Gender audit methodology finalised', 'target_date' => '2026-04-30', 'completion_pct' => 30, 'status' => 'pending'],
                    ['name' => 'Model policy first draft',           'target_date' => '2026-08-31', 'completion_pct' =>  0, 'status' => 'pending'],
                ],
                'deliverables' => [
                    ['name' => 'Programme Inception Report', 'due_date' => '2026-04-30', 'status' => 'pending'],
                    ['name' => '5 Gender Audit Reports',     'due_date' => '2026-09-30', 'status' => 'pending'],
                ],
                'budget_lines' => [
                    ['category' => 'consultancy',        'description' => 'Gender audit consultants (5 countries)', 'amount' => 200000, 'actual_spent' =>     0, 'funding_source' => 'donor'],
                    ['category' => 'travel_dsa',         'description' => 'Travel & DSA for all missions',          'amount' => 160000, 'actual_spent' =>     0, 'funding_source' => 'donor'],
                    ['category' => 'meetings_workshops', 'description' => 'Training venue & logistics',             'amount' => 120000, 'actual_spent' =>     0, 'funding_source' => 'donor'],
                    ['category' => 'reporting',          'description' => 'Report production & translation',        'amount' =>  40000, 'actual_spent' =>     0, 'funding_source' => 'donor'],
                    ['category' => 'contingency',        'description' => '10% contingency',                       'amount' =>  80000, 'actual_spent' =>     0, 'funding_source' => 'donor'],
                ],
                'procurement_items' => [],
            ],
            [
                'reference_number'        => 'PIF-2025-003',
                'title'                   => 'Regional Trade Facilitation Study',
                'status'                  => 'completed',
                'strategic_pillar'        => 'Economic Integration',
                'implementing_department' => 'Research',
                'background'              => 'An analytical study into non-tariff barriers and customs harmonisation across SADC member states to inform parliamentary oversight of trade policy.',
                'overall_objective'       => 'To produce a comprehensive study on trade facilitation barriers and recommend legislative interventions.',
                'specific_objectives'     => ['Conduct data collection in 8 countries', 'Produce policy brief', 'Disseminate findings to parliaments'],
                'expected_outputs'        => ['Full research report', 'Executive policy brief', '1 dissemination conference'],
                'target_beneficiaries'    => ['MPs', 'Parliamentary Staff', 'Citizens'],
                'primary_currency'        => 'NAD',
                'base_currency'           => 'NAD',
                'exchange_rate'           => 1.0,
                'contingency_pct'         => 5.00,
                'total_budget'            => 350000.00,
                'funding_source'          => 'AfDB',
                'responsible_officer'     => 'Research Officer',
                'start_date'              => '2025-01-01',
                'end_date'                => '2025-12-31',
                'travel_required'         => true,
                'delegates_count'         => 20,
                'member_states'           => ['South Africa', 'Zimbabwe', 'Zambia', 'Tanzania', 'DRC', 'Angola', 'Mozambique', 'Botswana'],
                'procurement_required'    => false,
                'submitted_at'            => now()->subMonths(14),
                'approved_at'             => now()->subMonths(13),
                'approved_by'             => $approver?->id,
                'activities' => [
                    ['name' => 'Data Collection – Southern Cluster',  'budget_allocation' =>  85000, 'responsible' => 'Research Officer', 'location' => 'Johannesburg, SA',  'start_date' => '2025-02-01', 'end_date' => '2025-04-30', 'status' => 'completed'],
                    ['name' => 'Data Collection – Eastern Cluster',   'budget_allocation' =>  80000, 'responsible' => 'Research Officer', 'location' => 'Dar es Salaam, TZ', 'start_date' => '2025-05-01', 'end_date' => '2025-07-31', 'status' => 'completed'],
                    ['name' => 'Dissemination Conference – Gaborone', 'budget_allocation' =>  60000, 'responsible' => 'Programme Manager','location' => 'Gaborone, Botswana','start_date' => '2025-11-01', 'end_date' => '2025-11-03', 'status' => 'completed'],
                ],
                'milestones' => [
                    ['name' => 'Research report submitted',      'target_date' => '2025-09-30', 'achieved_date' => '2025-09-28', 'completion_pct' => 100, 'status' => 'achieved'],
                    ['name' => 'Dissemination conference held',  'target_date' => '2025-11-03', 'achieved_date' => '2025-11-03', 'completion_pct' => 100, 'status' => 'achieved'],
                ],
                'deliverables' => [
                    ['name' => 'Research Report',     'due_date' => '2025-09-30', 'status' => 'accepted'],
                    ['name' => 'Policy Brief',        'due_date' => '2025-10-31', 'status' => 'accepted'],
                ],
                'budget_lines' => [
                    ['category' => 'consultancy',        'description' => 'Research consultants',            'amount' => 120000, 'actual_spent' => 115000, 'funding_source' => 'donor'],
                    ['category' => 'travel_dsa',         'description' => 'Data collection travel',          'amount' =>  90000, 'actual_spent' =>  88000, 'funding_source' => 'donor'],
                    ['category' => 'meetings_workshops', 'description' => 'Dissemination conference costs',  'amount' =>  60000, 'actual_spent' =>  58500, 'funding_source' => 'donor'],
                    ['category' => 'reporting',          'description' => 'Report design & printing',        'amount' =>  25000, 'actual_spent' =>  22000, 'funding_source' => 'donor'],
                    ['category' => 'contingency',        'description' => '5% contingency',                 'amount' =>  17500, 'actual_spent' =>   9500, 'funding_source' => 'donor'],
                ],
                'procurement_items' => [],
            ],
            [
                'reference_number'        => 'PIF-2026-004',
                'title'                   => 'ICT Modernisation Project',
                'status'                  => 'draft',
                'strategic_pillar'        => 'Institutional Strengthening',
                'implementing_department' => 'ICT',
                'background'              => 'The Secretariat\'s ICT infrastructure requires modernisation to support hybrid work, secure document management, and improved connectivity with Member States.',
                'overall_objective'       => 'To upgrade the Secretariat\'s ICT systems and improve digital service delivery.',
                'specific_objectives'     => ['Deploy cloud document management system', 'Upgrade network infrastructure', 'Train staff on new systems'],
                'expected_outputs'        => ['Cloud DMS deployed', 'Network upgraded in all offices', '100% staff trained'],
                'target_beneficiaries'    => ['Parliamentary Staff'],
                'primary_currency'        => 'NAD',
                'base_currency'           => 'NAD',
                'exchange_rate'           => 1.0,
                'contingency_pct'         => 10.00,
                'total_budget'            => 250000.00,
                'funding_source'          => 'Core Budget',
                'responsible_officer'     => 'ICT Manager',
                'start_date'              => '2026-07-01',
                'end_date'                => '2026-12-31',
                'travel_required'         => false,
                'procurement_required'    => true,
                'activities' => [
                    ['name' => 'Cloud DMS Procurement & Setup', 'budget_allocation' => 90000, 'responsible' => 'ICT Manager',  'location' => 'Windhoek (HQ)', 'start_date' => '2026-07-01', 'end_date' => '2026-09-30', 'status' => 'draft'],
                    ['name' => 'Network Infrastructure Upgrade','budget_allocation' => 70000, 'responsible' => 'IT Technician','location' => 'Windhoek (HQ)', 'start_date' => '2026-08-01', 'end_date' => '2026-10-31', 'status' => 'draft'],
                    ['name' => 'Staff ICT Training',            'budget_allocation' => 25000, 'responsible' => 'ICT Manager',  'location' => 'Windhoek (HQ)', 'start_date' => '2026-11-01', 'end_date' => '2026-11-30', 'status' => 'draft'],
                ],
                'milestones' => [
                    ['name' => 'Procurement completed',   'target_date' => '2026-08-31', 'completion_pct' => 0, 'status' => 'pending'],
                    ['name' => 'Systems live',            'target_date' => '2026-10-31', 'completion_pct' => 0, 'status' => 'pending'],
                ],
                'deliverables' => [
                    ['name' => 'ICT Needs Assessment', 'due_date' => '2026-07-31', 'status' => 'pending'],
                    ['name' => 'Implementation Report', 'due_date' => '2026-12-31', 'status' => 'pending'],
                ],
                'budget_lines' => [
                    ['category' => 'equipment',     'description' => 'Servers, switches, access points',  'amount' => 80000, 'actual_spent' => 0, 'funding_source' => 'core_budget'],
                    ['category' => 'consultancy',   'description' => 'Cloud DMS vendor & configuration',  'amount' => 60000, 'actual_spent' => 0, 'funding_source' => 'core_budget'],
                    ['category' => 'staff_costs',   'description' => 'ICT project coordinator (6 months)','amount' => 45000, 'actual_spent' => 0, 'funding_source' => 'core_budget'],
                    ['category' => 'meetings_workshops','description' => 'Staff training sessions',        'amount' => 25000, 'actual_spent' => 0, 'funding_source' => 'core_budget'],
                    ['category' => 'contingency',   'description' => '10% contingency',                  'amount' => 25000, 'actual_spent' => 0, 'funding_source' => 'core_budget'],
                ],
                'procurement_items' => [
                    ['description' => 'Cloud Document Management System licence (3-year)',  'estimated_cost' => 36000, 'method' => 'tender',             'status' => 'pending'],
                    ['description' => 'Network switches & access points (HQ building)',     'estimated_cost' => 45000, 'method' => 'three_quotations',   'status' => 'pending'],
                ],
            ],
        ];

        foreach ($programmes as $data) {
            // Extract sub-records before creating programme
            $activities       = $data['activities']       ?? [];
            $milestones       = $data['milestones']       ?? [];
            $deliverables     = $data['deliverables']     ?? [];
            $budgetLines      = $data['budget_lines']     ?? [];
            $procurementItems = $data['procurement_items'] ?? [];

            unset($data['activities'], $data['milestones'], $data['deliverables'], $data['budget_lines'], $data['procurement_items']);

            $programme = Programme::firstOrCreate(
                ['reference_number' => $data['reference_number']],
                array_merge($data, [
                    'tenant_id'   => $tenant->id,
                    'created_by'  => $creator->id,
                    'strategic_alignment' => ['SADC PF Strategic Plan 2024–2028'],
                    'supporting_departments' => ['Finance', 'Administration'],
                ])
            );

            if (!$programme->wasRecentlyCreated) {
                continue;
            }

            foreach ($activities as $row) {
                $programme->activities()->create($row);
            }
            foreach ($milestones as $row) {
                $programme->milestones()->create($row);
            }
            foreach ($deliverables as $row) {
                $programme->deliverables()->create($row);
            }
            foreach ($budgetLines as $row) {
                $programme->budgetLines()->create($row);
            }
            foreach ($procurementItems as $row) {
                $programme->procurementItems()->create($row);
            }
        }
    }
}
