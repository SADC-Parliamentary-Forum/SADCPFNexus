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
        $tenant = Tenant::where('slug', 'sadcpf')->first();
        if (!$tenant) {
            return;
        }

        $admin = User::where('email', 'admin@sadcpf.org')->first();
        $staff = User::where('email', 'staff@sadcpf.org')->first();
        $hr = User::where('email', 'hr@sadcpf.org')->first();
        $finance = User::where('email', 'finance@sadcpf.org')->first();

        if (!$staff) {
            return;
        }

        $this->seedTravelRequests($tenant, $staff, $admin ?? $hr);
        $this->seedLeaveRequests($tenant, $staff, $admin ?? $hr);
        $this->seedImprestRequests($tenant, $staff, $admin ?? $finance);
        $this->seedProcurementRequests($tenant, $staff, $admin ?? $finance);
        $this->seedSalaryAdvanceRequests($tenant, $staff, $finance);
        $this->seedTimesheets($tenant, $staff, $hr);
        $this->seedPayslips($tenant, $staff);
        $this->seedLeaveBalances($staff);
        $this->seedOvertimeAccruals($staff);
    }

    private function seedTravelRequests(Tenant $tenant, User $requester, User $approver): void
    {
        $refs = ['TRV-DEMO001', 'TRV-DEMO002', 'TRV-DEMO003'];
        $statuses = ['draft', 'submitted', 'approved'];
        $purposes = ['Regional workshop', 'Committee meeting', 'Stakeholder engagement'];

        foreach ($refs as $i => $ref) {
            $dep = now()->addDays(14 + $i * 7);
            $ret = $dep->copy()->addDays(3);
            $travel = TravelRequest::firstOrCreate(
                ['reference_number' => $ref],
                [
                    'tenant_id'           => $tenant->id,
                    'requester_id'        => $requester->id,
                    'approved_by'         => in_array($statuses[$i], ['approved'], true) ? $approver->id : null,
                    'purpose'             => $purposes[$i],
                    'status'              => $statuses[$i],
                    'departure_date'      => $dep,
                    'return_date'         => $ret,
                    'destination_country' => 'Namibia',
                    'destination_city'    => 'Windhoek',
                    'estimated_dsa'       => 450.00,
                    'currency'            => 'USD',
                    'justification'       => 'Official mission.',
                    'submitted_at'        => in_array($statuses[$i], ['submitted', 'approved'], true) ? now()->subDays(2) : null,
                    'approved_at'         => $statuses[$i] === 'approved' ? now()->subDay() : null,
                ]
            );
            if ($travel->wasRecentlyCreated && $travel->itineraries()->count() === 0) {
                $travel->itineraries()->create([
                    'from_location'   => 'Windhoek',
                    'to_location'     => 'Windhoek',
                    'travel_date'     => $dep,
                    'transport_mode'  => 'Flight',
                    'dsa_rate'        => 150,
                    'days_count'      => 3,
                    'calculated_dsa'  => 450,
                ]);
            }
        }
    }

    private function seedLeaveRequests(Tenant $tenant, User $requester, User $approver): void
    {
        $refs = ['LV-DEMO001', 'LV-DEMO002', 'LV-DEMO003'];
        $statuses = ['draft', 'submitted', 'approved'];
        $types = ['annual', 'sick', 'unpaid'];

        foreach ($refs as $i => $ref) {
            $start = now()->addDays(7 + $i * 5);
            $days = [3, 5, 2][$i];
            $end = $start->copy()->addDays($days - 1);
            LeaveRequest::firstOrCreate(
                ['reference_number' => $ref],
                [
                    'tenant_id'        => $tenant->id,
                    'requester_id'     => $requester->id,
                    'approved_by'      => $statuses[$i] === 'approved' ? $approver->id : null,
                    'leave_type'       => $types[$i],
                    'start_date'       => $start,
                    'end_date'         => $end,
                    'days_requested'   => $days,
                    'reason'           => 'Leave request for ' . $types[$i],
                    'status'           => $statuses[$i],
                    'has_lil_linking'  => false,
                    'submitted_at'     => in_array($statuses[$i], ['submitted', 'approved'], true) ? now()->subDays(2) : null,
                    'approved_at'      => $statuses[$i] === 'approved' ? now()->subDay() : null,
                ]
            );
        }
    }

    private function seedImprestRequests(Tenant $tenant, User $requester, User $approver): void
    {
        $refs = ['IMP-DEMO001', 'IMP-DEMO002'];
        $statuses = ['submitted', 'approved'];

        foreach ($refs as $i => $ref) {
            ImprestRequest::firstOrCreate(
                ['reference_number' => $ref],
                [
                    'tenant_id'                 => $tenant->id,
                    'requester_id'              => $requester->id,
                    'approved_by'               => $approver->id,
                    'budget_line'               => 'OP-' . ($i + 1),
                    'amount_requested'          => 5000.00 + $i * 2000,
                    'amount_approved'            => 5000.00 + $i * 2000,
                    'amount_liquidated'          => 0,
                    'currency'                  => 'NAD',
                    'expected_liquidation_date' => now()->addDays(30),
                    'purpose'                   => 'Travel advance for mission',
                    'justification'             => 'Official travel.',
                    'status'                    => $statuses[$i],
                    'submitted_at'              => now()->subDays(3),
                    'approved_at'               => now()->subDays(1),
                ]
            );
        }
    }

    private function seedProcurementRequests(Tenant $tenant, User $requester, User $approver): void
    {
        $refs = ['PROC-DEMO01', 'PROC-DEMO02'];
        $statuses = ['submitted', 'approved'];

        foreach ($refs as $i => $ref) {
            ProcurementRequest::firstOrCreate(
                ['reference_number' => $ref],
                [
                    'tenant_id'          => $tenant->id,
                    'requester_id'       => $requester->id,
                    'approved_by'        => $approver->id,
                    'title'              => $i === 0 ? 'Office equipment' : 'Software licences',
                    'description'        => 'Request for procurement.',
                    'category'           => 'goods',
                    'estimated_value'    => 15000.00 + $i * 5000,
                    'currency'           => 'NAD',
                    'procurement_method' => 'request_for_quotation',
                    'status'             => $statuses[$i],
                    'budget_line'        => 'CAPEX-01',
                    'justification'      => 'Operational requirement.',
                    'required_by_date'   => now()->addDays(21),
                    'submitted_at'      => now()->subDays(2),
                    'approved_at'       => now()->subDay(),
                ]
            );
        }
    }

    private function seedSalaryAdvanceRequests(Tenant $tenant, User $requester, User $approver): void
    {
        $refs = ['SAR-DEMO001', 'SAR-DEMO002'];
        $statuses = ['submitted', 'approved'];

        foreach ($refs as $i => $ref) {
            SalaryAdvanceRequest::firstOrCreate(
                ['reference_number' => $ref],
                [
                    'tenant_id'       => $tenant->id,
                    'requester_id'    => $requester->id,
                    'approved_by'     => $approver->id,
                    'advance_type'    => $i === 0 ? 'rental' : 'medical',
                    'amount'          => 10000.00 + $i * 5000,
                    'currency'        => 'NAD',
                    'repayment_months' => 6,
                    'purpose'         => 'Salary advance request.',
                    'justification'   => 'Personal emergency.',
                    'status'          => $statuses[$i],
                    'submitted_at'    => now()->subDays(2),
                    'approved_at'     => now()->subDay(),
                ]
            );
        }
    }

    private function seedTimesheets(Tenant $tenant, User $user, User $approver): void
    {
        $weekStart = Carbon::now()->startOfWeek()->subWeek();
        $weekEnd = $weekStart->copy()->addDays(6);

        $ts = Timesheet::firstOrCreate(
            [
                'tenant_id'  => $tenant->id,
                'user_id'    => $user->id,
                'week_start' => $weekStart,
            ],
            [
                'week_end'      => $weekEnd,
                'total_hours'   => 40,
                'overtime_hours'=> 2,
                'status'        => 'approved',
                'submitted_at'  => now()->subDays(3),
                'approved_at'   => now()->subDays(1),
                'approved_by'   => $approver->id,
            ]
        );

        if ($ts->wasRecentlyCreated) {
            for ($d = 0; $d < 5; $d++) {
                $workDate = $weekStart->copy()->addDays($d);
                TimesheetEntry::firstOrCreate(
                    [
                        'timesheet_id' => $ts->id,
                        'work_date'   => $workDate,
                    ],
                    [
                        'hours'         => 8,
                        'overtime_hours'=> $d === 4 ? 2 : 0,
                        'description'   => 'Office work',
                    ]
                );
            }
        }
    }

    private function seedPayslips(Tenant $tenant, User $user): void
    {
        $year = (int) date('Y');
        $months = [1, 2, 3];
        foreach ($months as $month) {
            Payslip::firstOrCreate(
                [
                    'user_id'      => $user->id,
                    'period_year'  => $year,
                    'period_month' => $month,
                ],
                [
                    'tenant_id'    => $tenant->id,
                    'gross_amount' => 45000.00,
                    'net_amount'   => 35100.00,
                    'currency'     => 'NAD',
                    'issued_at'    => now()->setMonth($month)->setYear($year),
                ]
            );
        }
    }

    private function seedLeaveBalances(User $user): void
    {
        $year = (int) date('Y');
        LeaveBalance::firstOrCreate(
            ['user_id' => $user->id, 'period_year' => $year],
            [
                'annual_balance_days'  => 18,
                'lil_hours_available'  => 42.5,
                'sick_leave_used_days' => 3,
            ]
        );
    }

    private function seedOvertimeAccruals(User $user): void
    {
        $items = [
            ['code' => 'OT-2391', 'description' => 'Overtime: Project Alpha', 'hours' => 8, 'date' => now()->subDays(20), 'approved_by' => 'J. Doe', 'verified' => true],
            ['code' => 'WE-8821', 'description' => 'Weekend Support Duty', 'hours' => 8, 'date' => now()->subDays(18), 'approved_by' => 'S. Smith', 'verified' => true],
            ['code' => 'LS-1102', 'description' => 'Late Shift Differential', 'hours' => 4, 'date' => now()->subDays(25), 'approved_by' => null, 'verified' => false],
        ];
        foreach ($items as $item) {
            OvertimeAccrual::firstOrCreate(
                [
                    'user_id'      => $user->id,
                    'code'         => $item['code'],
                    'accrual_date' => $item['date'],
                ],
                [
                    'description'       => $item['description'],
                    'hours'             => $item['hours'],
                    'approved_by_name'   => $item['approved_by'],
                    'is_verified'       => $item['verified'],
                    'is_linked'         => false,
                ]
            );
        }
    }
}
