<?php

namespace Database\Seeders;

use App\Models\ImprestRequest;
use App\Models\LeaveBalance;
use App\Models\LeaveRequest;
use App\Models\OvertimeAccrual;
use App\Models\Payslip;
use App\Models\ProcurementRequest;
use App\Models\SalaryAdvanceRequest;
use App\Models\Tenant;
use App\Models\Timesheet;
use App\Models\TimesheetEntry;
use App\Models\TravelRequest;
use App\Models\TravelItinerary;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        $tenant  = Tenant::where('slug', 'sadcpf')->first();
        if (!$tenant) return;

        $admin   = User::where('email', 'admin@sadcpf.org')->first();
        $staff   = User::where('email', 'staff@sadcpf.org')->first();   // Demo Staff
        $hr      = User::where('email', 'hr@sadcpf.org')->first();
        $finance = User::where('email', 'finance@sadcpf.org')->first();
        $maria   = User::where('email', 'maria@sadcpf.org')->first();   // Maria Dlamini
        $john    = User::where('email', 'john@sadcpf.org')->first();    // John Mutamba
        $thabo   = User::where('email', 'thabo@sadcpf.org')->first();   // Thabo Nkosi

        if (!$staff) return;

        $approver = $admin ?? $hr;

        $this->seedTravelRequests($tenant, $staff, $maria, $john, $approver);
        $this->seedLeaveRequests($tenant, $staff, $maria, $thabo, $approver);
        $this->seedImprestRequests($tenant, $staff, $maria, $john, $approver);
        $this->seedProcurementRequests($tenant, $staff, $john, $approver);
        $this->seedSalaryAdvanceRequests($tenant, $staff, $maria, $finance);
        $this->seedTimesheets($tenant, $staff, $maria, $john, $hr);
        $this->seedPayslips($tenant, $staff, $maria, $john, $thabo, $hr, $finance);
        $this->seedLeaveBalances($staff, $maria, $john, $thabo);
        $this->seedOvertimeAccruals($staff, $maria, $john);
    }

    /* ──────────────────────────────────────────────────── TRAVEL ── */

    private function seedTravelRequests(Tenant $tenant, User $staff, ?User $maria, ?User $john, User $approver): void
    {
        $today = Carbon::today();

        $records = [
            // 1 – Draft (staff)
            [
                'reference_number'    => 'TRV-DEMO001',
                'requester'           => $staff,
                'purpose'             => 'Regional Workshop – Lusaka',
                'status'              => 'draft',
                'departure_date'      => $today->copy()->addDays(21),
                'return_date'         => $today->copy()->addDays(25),
                'destination_country' => 'Zambia',
                'destination_city'    => 'Lusaka',
                'estimated_dsa'       => 600.00,
                'currency'            => 'USD',
            ],
            // 2 – Submitted (staff)
            [
                'reference_number'    => 'TRV-DEMO002',
                'requester'           => $staff,
                'purpose'             => 'Committee Meeting – Gaborone',
                'status'              => 'submitted',
                'departure_date'      => $today->copy()->addDays(14),
                'return_date'         => $today->copy()->addDays(17),
                'destination_country' => 'Botswana',
                'destination_city'    => 'Gaborone',
                'estimated_dsa'       => 450.00,
                'currency'            => 'USD',
                'submitted_at'        => $today->copy()->subDays(2),
            ],
            // 3 – Approved future (staff)
            [
                'reference_number'    => 'TRV-DEMO003',
                'requester'           => $staff,
                'purpose'             => 'Stakeholder Engagement – Johannesburg',
                'status'              => 'approved',
                'departure_date'      => $today->copy()->addDays(30),
                'return_date'         => $today->copy()->addDays(34),
                'destination_country' => 'South Africa',
                'destination_city'    => 'Johannesburg',
                'estimated_dsa'       => 520.00,
                'currency'            => 'USD',
                'submitted_at'        => $today->copy()->subDays(5),
                'approved_at'         => $today->copy()->subDays(3),
                'approved_by'         => $approver->id,
            ],
            // 4 – ACTIVE TODAY (Maria) – for Alerts "Active Missions" & "Away Today"
            [
                'reference_number'    => 'TRV-ACTIVE1',
                'requester'           => $maria ?? $staff,
                'purpose'             => 'Parliamentary Strengthening Workshop – Dar es Salaam',
                'status'              => 'approved',
                'departure_date'      => $today->copy()->subDays(2),
                'return_date'         => $today->copy()->addDays(3),
                'destination_country' => 'Tanzania',
                'destination_city'    => 'Dar es Salaam',
                'estimated_dsa'       => 750.00,
                'currency'            => 'USD',
                'submitted_at'        => $today->copy()->subDays(10),
                'approved_at'         => $today->copy()->subDays(8),
                'approved_by'         => $approver->id,
            ],
            // 5 – Rejected (staff)
            [
                'reference_number'    => 'TRV-DEMO005',
                'requester'           => $staff,
                'purpose'             => 'Conference – Nairobi',
                'status'              => 'rejected',
                'departure_date'      => $today->copy()->subDays(20),
                'return_date'         => $today->copy()->subDays(15),
                'destination_country' => 'Kenya',
                'destination_city'    => 'Nairobi',
                'estimated_dsa'       => 800.00,
                'currency'            => 'USD',
                'submitted_at'        => $today->copy()->subDays(30),
                'rejection_reason'    => 'Budget not available for this quarter.',
                'approved_by'         => $approver->id,
            ],
            // 6 – Approved past (John)
            [
                'reference_number'    => 'TRV-DEMO006',
                'requester'           => $john ?? $staff,
                'purpose'             => 'Procurement Due Diligence – Harare',
                'status'              => 'approved',
                'departure_date'      => $today->copy()->subDays(14),
                'return_date'         => $today->copy()->subDays(11),
                'destination_country' => 'Zimbabwe',
                'destination_city'    => 'Harare',
                'estimated_dsa'       => 380.00,
                'currency'            => 'USD',
                'submitted_at'        => $today->copy()->subDays(21),
                'approved_at'         => $today->copy()->subDays(18),
                'approved_by'         => $approver->id,
            ],
            // 7 – Draft (Thabo via john)
            [
                'reference_number'    => 'TRV-DEMO007',
                'requester'           => $john ?? $staff,
                'purpose'             => 'Governance Forum – Maputo',
                'status'              => 'draft',
                'departure_date'      => $today->copy()->addDays(45),
                'return_date'         => $today->copy()->addDays(48),
                'destination_country' => 'Mozambique',
                'destination_city'    => 'Maputo',
                'estimated_dsa'       => 420.00,
                'currency'            => 'USD',
            ],
            // 8 – Submitted (Maria)
            [
                'reference_number'    => 'TRV-DEMO008',
                'requester'           => $maria ?? $staff,
                'purpose'             => 'Gender Audit Mission – Maseru',
                'status'              => 'submitted',
                'departure_date'      => $today->copy()->addDays(10),
                'return_date'         => $today->copy()->addDays(14),
                'destination_country' => 'Lesotho',
                'destination_city'    => 'Maseru',
                'estimated_dsa'       => 500.00,
                'currency'            => 'USD',
                'submitted_at'        => $today->copy()->subDay(),
            ],
        ];

        foreach ($records as $data) {
            $requester = $data['requester'];
            unset($data['requester']);

            $travel = TravelRequest::firstOrCreate(
                ['reference_number' => $data['reference_number']],
                array_merge($data, [
                    'tenant_id'    => $tenant->id,
                    'requester_id' => $requester->id,
                    'justification' => 'Official mission per approved workplan.',
                    'currency'     => $data['currency'] ?? 'USD',
                ])
            );

            if ($travel->wasRecentlyCreated && $travel->itineraries()->count() === 0) {
                $travel->itineraries()->create([
                    'from_location'  => 'Windhoek',
                    'to_location'    => $data['destination_city'] ?? $data['destination_country'],
                    'travel_date'    => $data['departure_date'],
                    'transport_mode' => 'Flight',
                    'dsa_rate'       => $data['estimated_dsa'] / 3,
                    'days_count'     => 3,
                    'calculated_dsa' => $data['estimated_dsa'],
                ]);
            }
        }
    }

    /* ───────────────────────────────────────────────────── LEAVE ── */

    private function seedLeaveRequests(Tenant $tenant, User $staff, ?User $maria, ?User $thabo, User $approver): void
    {
        $today = Carbon::today();
        $year  = (int) $today->year;

        $records = [
            // 1 – Draft annual (staff)
            [
                'reference_number' => 'LV-DEMO001',
                'requester'        => $staff,
                'leave_type'       => 'annual',
                'start_date'       => $today->copy()->addDays(10),
                'end_date'         => $today->copy()->addDays(12),
                'days_requested'   => 3,
                'reason'           => 'Family vacation',
                'status'           => 'draft',
            ],
            // 2 – Submitted sick (staff)
            [
                'reference_number' => 'LV-DEMO002',
                'requester'        => $staff,
                'leave_type'       => 'sick',
                'start_date'       => $today->copy()->addDays(5),
                'end_date'         => $today->copy()->addDays(6),
                'days_requested'   => 2,
                'reason'           => 'Medical appointment',
                'status'           => 'submitted',
                'submitted_at'     => $today->copy()->subDays(2),
            ],
            // 3 – Approved annual future (staff)
            [
                'reference_number' => 'LV-DEMO003',
                'requester'        => $staff,
                'leave_type'       => 'annual',
                'start_date'       => $today->copy()->addDays(30),
                'end_date'         => $today->copy()->addDays(39),
                'days_requested'   => 10,
                'reason'           => 'Annual leave',
                'status'           => 'approved',
                'submitted_at'     => $today->copy()->subDays(7),
                'approved_at'      => $today->copy()->subDays(5),
                'approved_by'      => $approver->id,
            ],
            // 4 – AWAY TODAY (Maria) – for Alerts "Away Today"
            [
                'reference_number' => 'LV-AWAY001',
                'requester'        => $maria ?? $staff,
                'leave_type'       => 'annual',
                'start_date'       => $today->copy()->subDay(),
                'end_date'         => $today->copy()->addDays(2),
                'days_requested'   => 4,
                'reason'           => 'Annual leave – already approved',
                'status'           => 'approved',
                'submitted_at'     => $today->copy()->subDays(14),
                'approved_at'      => $today->copy()->subDays(12),
                'approved_by'      => $approver->id,
            ],
            // 5 – Rejected (staff)
            [
                'reference_number' => 'LV-DEMO005',
                'requester'        => $staff,
                'leave_type'       => 'unpaid',
                'start_date'       => $today->copy()->subDays(10),
                'end_date'         => $today->copy()->subDays(8),
                'days_requested'   => 3,
                'reason'           => 'Personal reasons',
                'status'           => 'rejected',
                'submitted_at'     => $today->copy()->subDays(20),
                'approved_by'      => $approver->id,
                'rejection_reason' => 'Insufficient leave balance.',
            ],
            // 6 – LIL leave (staff)
            [
                'reference_number'   => 'LV-LIL001',
                'requester'          => $staff,
                'leave_type'         => 'lil',
                'start_date'         => $today->copy()->addDays(20),
                'end_date'           => $today->copy()->addDays(21),
                'days_requested'     => 2,
                'reason'             => 'LIL compensation days',
                'status'             => 'draft',
                'has_lil_linking'    => true,
                'lil_hours_required' => 16,
                'lil_hours_linked'   => 16,
            ],
            // 7 – Approved sick (Thabo)
            [
                'reference_number' => 'LV-DEMO007',
                'requester'        => $thabo ?? $staff,
                'leave_type'       => 'sick',
                'start_date'       => $today->copy()->subDays(5),
                'end_date'         => $today->copy()->subDays(3),
                'days_requested'   => 3,
                'reason'           => 'Flu',
                'status'           => 'approved',
                'submitted_at'     => $today->copy()->subDays(7),
                'approved_at'      => $today->copy()->subDays(6),
                'approved_by'      => $approver->id,
            ],
            // 8 – Submitted maternity (Maria)
            [
                'reference_number' => 'LV-DEMO008',
                'requester'        => $maria ?? $staff,
                'leave_type'       => 'maternity',
                'start_date'       => $today->copy()->addDays(60),
                'end_date'         => $today->copy()->addDays(144),
                'days_requested'   => 84,
                'reason'           => 'Maternity leave',
                'status'           => 'submitted',
                'submitted_at'     => $today->copy()->subDays(3),
            ],
        ];

        foreach ($records as $data) {
            $requester = $data['requester'];
            unset($data['requester']);

            LeaveRequest::firstOrCreate(
                ['reference_number' => $data['reference_number']],
                array_merge($data, [
                    'tenant_id'       => $tenant->id,
                    'requester_id'    => $requester->id,
                    'has_lil_linking' => $data['has_lil_linking'] ?? false,
                ])
            );
        }
    }

    /* ─────────────────────────────────────────────────── IMPREST ── */

    private function seedImprestRequests(Tenant $tenant, User $staff, ?User $maria, ?User $john, User $approver): void
    {
        $today = Carbon::today();

        $records = [
            // 1 – Approved, liquidation DUE IN 10 DAYS (for Alerts "Upcoming Deadlines")
            [
                'reference_number'          => 'IMP-DEMO001',
                'requester'                 => $staff,
                'budget_line'               => 'OP-TRAVEL-2026',
                'amount_requested'          => 5500.00,
                'amount_approved'           => 5500.00,
                'amount_liquidated'         => 0,
                'currency'                  => 'NAD',
                'expected_liquidation_date' => $today->copy()->addDays(10),
                'purpose'                   => 'Travel advance – Lusaka workshop',
                'justification'             => 'Pre-advance for approved mission.',
                'status'                    => 'approved',
                'submitted_at'              => $today->copy()->subDays(7),
                'approved_at'               => $today->copy()->subDays(5),
                'approved_by'               => $approver->id,
            ],
            // 2 – Partially liquidated
            [
                'reference_number'          => 'IMP-DEMO002',
                'requester'                 => $staff,
                'budget_line'               => 'OP-WORKSHOP-2026',
                'amount_requested'          => 8000.00,
                'amount_approved'           => 7500.00,
                'amount_liquidated'         => 3200.00,
                'currency'                  => 'NAD',
                'expected_liquidation_date' => $today->copy()->addDays(25),
                'purpose'                   => 'Workshop advance – Gaborone',
                'justification'             => 'Official workshop expenses.',
                'status'                    => 'approved',
                'submitted_at'              => $today->copy()->subDays(14),
                'approved_at'               => $today->copy()->subDays(12),
                'approved_by'               => $approver->id,
            ],
            // 3 – Submitted (Maria)
            [
                'reference_number'          => 'IMP-DEMO003',
                'requester'                 => $maria ?? $staff,
                'budget_line'               => 'PROG-001-TRAVEL',
                'amount_requested'          => 12000.00,
                'amount_approved'           => null,
                'amount_liquidated'         => 0,
                'currency'                  => 'NAD',
                'expected_liquidation_date' => $today->copy()->addDays(40),
                'purpose'                   => 'Gender programme travel advance',
                'justification'             => 'Mission to Tanzania (TRV-ACTIVE1).',
                'status'                    => 'submitted',
                'submitted_at'              => $today->copy()->subDays(5),
            ],
            // 4 – Liquidated (John)
            [
                'reference_number'          => 'IMP-DEMO004',
                'requester'                 => $john ?? $staff,
                'budget_line'               => 'PROC-2026-Q1',
                'amount_requested'          => 3000.00,
                'amount_approved'           => 3000.00,
                'amount_liquidated'         => 3000.00,
                'currency'                  => 'NAD',
                'expected_liquidation_date' => $today->copy()->subDays(5),
                'purpose'                   => 'Procurement site visit advance',
                'justification'             => 'Vendor assessment trip.',
                'status'                    => 'liquidated',
                'submitted_at'              => $today->copy()->subDays(25),
                'approved_at'               => $today->copy()->subDays(22),
                'approved_by'               => $approver->id,
            ],
        ];

        foreach ($records as $data) {
            $requester = $data['requester'];
            unset($data['requester']);

            ImprestRequest::firstOrCreate(
                ['reference_number' => $data['reference_number']],
                array_merge($data, ['tenant_id' => $tenant->id, 'requester_id' => $requester->id])
            );
        }
    }

    /* ───────────────────────────────────────────────── PROCUREMENT ── */

    private function seedProcurementRequests(Tenant $tenant, User $staff, ?User $john, User $approver): void
    {
        $today = Carbon::today();

        $records = [
            [
                'reference_number'   => 'PROC-DEMO01',
                'requester'          => $staff,
                'title'              => 'Office Equipment – Laptops & Monitors',
                'description'        => '10 laptops and 10 external monitors for programme staff.',
                'category'           => 'goods',
                'estimated_value'    => 85000.00,
                'currency'           => 'NAD',
                'procurement_method' => 'request_for_quotation',
                'status'             => 'approved',
                'budget_line'        => 'CAPEX-IT-2026',
                'justification'      => 'Staff equipment refresh.',
                'required_by_date'   => $today->copy()->addDays(30),
                'submitted_at'       => $today->copy()->subDays(10),
                'approved_at'        => $today->copy()->subDays(7),
                'approved_by'        => $approver->id,
            ],
            [
                'reference_number'   => 'PROC-DEMO02',
                'requester'          => $john ?? $staff,
                'title'              => 'Microsoft 365 Licences (Annual Renewal)',
                'description'        => 'Annual renewal of 25 Microsoft 365 Business Premium licences.',
                'category'           => 'services',
                'estimated_value'    => 42000.00,
                'currency'           => 'NAD',
                'procurement_method' => 'direct_purchase',
                'status'             => 'submitted',
                'budget_line'        => 'ICT-OPEX-2026',
                'justification'      => 'Core operational licence renewal.',
                'required_by_date'   => $today->copy()->addDays(14),
                'submitted_at'       => $today->copy()->subDays(3),
            ],
            [
                'reference_number'   => 'PROC-DEMO03',
                'requester'          => $john ?? $staff,
                'title'              => 'Conference Room AV Equipment',
                'description'        => 'Projector, screen, and sound system for main conference room.',
                'category'           => 'goods',
                'estimated_value'    => 35000.00,
                'currency'           => 'NAD',
                'procurement_method' => 'request_for_quotation',
                'status'             => 'draft',
                'budget_line'        => 'CAPEX-INFRA-2026',
                'justification'      => 'AV upgrade for hybrid meetings.',
                'required_by_date'   => $today->copy()->addDays(60),
            ],
            [
                'reference_number'   => 'PROC-DEMO04',
                'requester'          => $staff,
                'title'              => 'Consultancy – Programme Evaluation',
                'description'        => 'Mid-term evaluation of Parliamentary Strengthening Programme.',
                'category'           => 'services',
                'estimated_value'    => 180000.00,
                'currency'           => 'NAD',
                'procurement_method' => 'tender',
                'status'             => 'approved',
                'budget_line'        => 'PROG-001-EVAL',
                'justification'      => 'Required by EU donor agreement.',
                'required_by_date'   => $today->copy()->addDays(45),
                'submitted_at'       => $today->copy()->subDays(21),
                'approved_at'        => $today->copy()->subDays(14),
                'approved_by'        => $approver->id,
            ],
        ];

        foreach ($records as $data) {
            $requester = $data['requester'];
            unset($data['requester']);

            ProcurementRequest::firstOrCreate(
                ['reference_number' => $data['reference_number']],
                array_merge($data, ['tenant_id' => $tenant->id, 'requester_id' => $requester->id])
            );
        }
    }

    /* ──────────────────────────────────────────── SALARY ADVANCES ── */

    private function seedSalaryAdvanceRequests(Tenant $tenant, User $staff, ?User $maria, ?User $finance): void
    {
        $today = Carbon::today();

        $records = [
            [
                'reference_number'  => 'SAR-DEMO001',
                'requester'         => $staff,
                'advance_type'      => 'rental',
                'amount'            => 12000.00,
                'currency'          => 'NAD',
                'repayment_months'  => 6,
                'purpose'           => 'Rental deposit for new apartment.',
                'justification'     => 'Relocating closer to office.',
                'status'            => 'approved',
                'submitted_at'      => $today->copy()->subDays(14),
                'approved_at'       => $today->copy()->subDays(10),
                'approved_by'       => $finance?->id,
            ],
            [
                'reference_number'  => 'SAR-DEMO002',
                'requester'         => $maria ?? $staff,
                'advance_type'      => 'medical',
                'amount'            => 8500.00,
                'currency'          => 'NAD',
                'repayment_months'  => 4,
                'purpose'           => 'Medical treatment not covered by insurance.',
                'justification'     => 'Specialist consultation required.',
                'status'            => 'submitted',
                'submitted_at'      => $today->copy()->subDays(3),
            ],
            [
                'reference_number'  => 'SAR-DEMO003',
                'requester'         => $staff,
                'advance_type'      => 'school',
                'amount'            => 6000.00,
                'currency'          => 'NAD',
                'repayment_months'  => 3,
                'purpose'           => 'Children school fees – January intake.',
                'justification'     => 'School fees due before salary date.',
                'status'            => 'draft',
            ],
        ];

        foreach ($records as $data) {
            $requester = $data['requester'];
            unset($data['requester']);

            SalaryAdvanceRequest::firstOrCreate(
                ['reference_number' => $data['reference_number']],
                array_merge($data, ['tenant_id' => $tenant->id, 'requester_id' => $requester->id])
            );
        }
    }

    /* ─────────────────────────────────────────────── TIMESHEETS ── */

    private function seedTimesheets(Tenant $tenant, User $staff, ?User $maria, ?User $john, User $approver): void
    {
        $users = array_filter([$staff, $maria, $john], fn($u) => $u !== null);

        foreach ($users as $idx => $user) {
            // Two weeks back + last week for each user
            foreach ([2, 1] as $weeksAgo) {
                $weekStart = Carbon::now()->startOfWeek()->subWeeks($weeksAgo);
                $weekEnd   = $weekStart->copy()->addDays(6);

                $ts = Timesheet::firstOrCreate(
                    ['tenant_id' => $tenant->id, 'user_id' => $user->id, 'week_start' => $weekStart],
                    [
                        'week_end'       => $weekEnd,
                        'total_hours'    => $weeksAgo === 1 ? 40 : 42,
                        'overtime_hours' => $weeksAgo === 1 ? 0 : 2,
                        'status'         => 'approved',
                        'submitted_at'   => $weekEnd->copy()->addDay(),
                        'approved_at'    => $weekEnd->copy()->addDays(3),
                        'approved_by'    => $approver->id,
                    ]
                );

                if ($ts->wasRecentlyCreated) {
                    for ($d = 0; $d < 5; $d++) {
                        $workDate = $weekStart->copy()->addDays($d);
                        $ot = ($weeksAgo === 2 && $d === 4) ? 2 : 0;
                        TimesheetEntry::firstOrCreate(
                            ['timesheet_id' => $ts->id, 'work_date' => $workDate],
                            [
                                'hours'          => 8,
                                'overtime_hours' => $ot,
                                'description'    => 'Office work – ' . $workDate->format('D d M'),
                            ]
                        );
                    }
                }
            }
        }
    }

    /* ─────────────────────────────────────────────────── PAYSLIPS ── */

    private function seedPayslips(Tenant $tenant, User ...$users): void
    {
        $year   = (int) Carbon::today()->year;
        $months = [1, 2, 3];

        $salaries = [
            'staff@sadcpf.org'   => ['gross' => 45000.00,  'net' => 35100.00],
            'maria@sadcpf.org'   => ['gross' => 58000.00,  'net' => 45240.00],
            'john@sadcpf.org'    => ['gross' => 42000.00,  'net' => 32760.00],
            'thabo@sadcpf.org'   => ['gross' => 40000.00,  'net' => 31200.00],
            'hr@sadcpf.org'      => ['gross' => 62000.00,  'net' => 48360.00],
            'finance@sadcpf.org' => ['gross' => 65000.00,  'net' => 50700.00],
        ];

        foreach ($users as $user) {
            if (!$user) continue;
            $pay = $salaries[$user->email] ?? ['gross' => 45000.00, 'net' => 35100.00];

            foreach ($months as $month) {
                Payslip::firstOrCreate(
                    ['user_id' => $user->id, 'period_year' => $year, 'period_month' => $month],
                    [
                        'tenant_id'    => $tenant->id,
                        'gross_amount' => $pay['gross'],
                        'net_amount'   => $pay['net'],
                        'currency'     => 'NAD',
                        'issued_at'    => Carbon::create($year, $month, 25),
                    ]
                );
            }
        }
    }

    /* ──────────────────────────────────────────── LEAVE BALANCES ── */

    private function seedLeaveBalances(User ...$users): void
    {
        $year = (int) Carbon::today()->year;

        $balances = [
            'staff@sadcpf.org'   => ['annual' => 18, 'lil' => 42.5, 'sick_used' => 3],
            'maria@sadcpf.org'   => ['annual' => 15, 'lil' => 24.0, 'sick_used' => 0],
            'john@sadcpf.org'    => ['annual' => 20, 'lil' => 16.0, 'sick_used' => 2],
            'thabo@sadcpf.org'   => ['annual' => 22, 'lil' => 8.0,  'sick_used' => 3],
            'hr@sadcpf.org'      => ['annual' => 12, 'lil' => 32.0, 'sick_used' => 1],
            'finance@sadcpf.org' => ['annual' => 14, 'lil' => 20.0, 'sick_used' => 0],
        ];

        foreach ($users as $user) {
            if (!$user) continue;
            $bal = $balances[$user->email] ?? ['annual' => 18, 'lil' => 0, 'sick_used' => 0];

            LeaveBalance::firstOrCreate(
                ['user_id' => $user->id, 'period_year' => $year],
                [
                    'annual_balance_days'  => $bal['annual'],
                    'lil_hours_available'  => $bal['lil'],
                    'sick_leave_used_days' => $bal['sick_used'],
                ]
            );
        }
    }

    /* ────────────────────────────────────────── OVERTIME ACCRUALS ── */

    private function seedOvertimeAccruals(User $staff, ?User $maria, ?User $john): void
    {
        $today = Carbon::today();

        $items = [
            // Staff accruals
            ['user' => $staff,          'code' => 'OT-2391',  'description' => 'Overtime: ExCo meeting preparation',    'hours' => 8,  'date' => $today->copy()->subDays(20), 'verified' => true,  'approved_by' => 'HR Manager'],
            ['user' => $staff,          'code' => 'WE-8821',  'description' => 'Weekend Support: Plenary coordination', 'hours' => 8,  'date' => $today->copy()->subDays(18), 'verified' => true,  'approved_by' => 'HR Manager'],
            ['user' => $staff,          'code' => 'LS-1102',  'description' => 'Late Shift: Server migration',          'hours' => 4,  'date' => $today->copy()->subDays(25), 'verified' => false, 'approved_by' => null],
            // Maria accruals
            ['user' => $maria ?? $staff,'code' => 'OT-3105',  'description' => 'Overtime: Gender audit report writing', 'hours' => 10, 'date' => $today->copy()->subDays(12), 'verified' => true,  'approved_by' => 'HR Manager'],
            ['user' => $maria ?? $staff,'code' => 'WE-0012',  'description' => 'Weekend travel – Lilongwe mission',     'hours' => 16, 'date' => $today->copy()->subDays(10), 'verified' => true,  'approved_by' => 'HR Manager'],
            // John accrual
            ['user' => $john  ?? $staff,'code' => 'OT-4422',  'description' => 'Overtime: Tender evaluation committee', 'hours' => 6,  'date' => $today->copy()->subDays(8),  'verified' => true,  'approved_by' => 'Finance Controller'],
        ];

        foreach ($items as $item) {
            $user = $item['user'];
            OvertimeAccrual::firstOrCreate(
                ['user_id' => $user->id, 'code' => $item['code'], 'accrual_date' => $item['date']],
                [
                    'description'      => $item['description'],
                    'hours'            => $item['hours'],
                    'approved_by_name' => $item['approved_by'],
                    'is_verified'      => $item['verified'],
                    'is_linked'        => false,
                ]
            );
        }
    }
}
