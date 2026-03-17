<?php

namespace Database\Seeders;

use App\Models\Appraisal;
use App\Models\AppraisalCycle;
use App\Models\ConductRecord;
use App\Models\Department;
use App\Models\HrPersonalFile;
use App\Models\PerformanceTracker;
use App\Models\Tenant;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

/**
 * Seeds HR modules: HR Personal Files, Appraisal Cycles & Appraisals, Conduct Records, Performance Trackers.
 * Depends on: TenantSeeder, RolesAndPermissionsSeeder, DepartmentsSeeder, UsersSeeder.
 */
class HrModulesSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::where('slug', 'sadcpf')->first();
        if (! $tenant) {
            return;
        }

        $admin = User::where('email', 'admin@sadcpf.org')->first();
        $staff = User::where('email', 'staff@sadcpf.org')->first();
        $hr = User::where('email', 'hr@sadcpf.org')->first();
        $maria = User::where('email', 'maria@sadcpf.org')->first();
        $john = User::where('email', 'john@sadcpf.org')->first();
        $thabo = User::where('email', 'thabo@sadcpf.org')->first();

        if (! $staff) {
            return;
        }

        $hrDept = Department::where('tenant_id', $tenant->id)->where('code', 'HR')->first();
        $creator = $hr ?? $admin ?? $staff;

        $this->seedHrPersonalFiles($tenant, $creator, $hr, $hrDept, [$staff, $maria, $john, $thabo, $hr]);
        $cycles = $this->seedAppraisalCycles($tenant, $creator);
        $this->seedAppraisals($tenant, $cycles, $staff, $maria, $john, $thabo, $hr, $admin);
        $this->seedConductRecords($tenant, $staff, $maria, $john, $hr);
        $this->seedPerformanceTrackers($tenant, $staff, $maria, $john, $hr);
    }

    private function seedHrPersonalFiles(Tenant $tenant, User $creator, ?User $hrOfficer, ?Department $hrDept, array $employees): void
    {
        $today = Carbon::today();
        foreach (array_filter($employees) as $emp) {
            HrPersonalFile::firstOrCreate(
                [
                    'tenant_id' => $tenant->id,
                    'employee_id' => $emp->id,
                ],
                [
                    'created_by' => $creator->id,
                    'current_hr_officer_id' => $hrOfficer?->id,
                    'department_id' => $emp->department_id ?? $hrDept?->id,
                    'supervisor_id' => null,
                    'file_status' => 'active',
                    'confidentiality_classification' => 'standard',
                    'staff_number' => $emp->employee_number ?? ('EMP-' . $emp->id),
                    'employment_status' => 'permanent',
                    'probation_status' => 'not_applicable',
                    'current_position' => 'Staff',
                    'appointment_date' => $today->copy()->subYears(2),
                    'commendation_count' => 0,
                    'open_development_action_count' => 0,
                ]
            );
        }
    }

    private function seedAppraisalCycles(Tenant $tenant, User $creator): array
    {
        $cycles = [];
        $base = Carbon::today()->startOfYear();
        $periods = [
            ['title' => 'FY 2024-2025', 'start' => $base->copy()->subYear(), 'end' => $base->copy()->subDay()],
            ['title' => 'FY 2025-2026', 'start' => $base, 'end' => $base->copy()->addYear()->subDay()],
        ];
        foreach ($periods as $p) {
            $cycle = AppraisalCycle::firstOrCreate(
                [
                    'tenant_id' => $tenant->id,
                    'title' => $p['title'],
                ],
                [
                    'created_by' => $creator->id,
                    'description' => 'Annual performance review cycle ' . $p['title'],
                    'period_start' => $p['start'],
                    'period_end' => $p['end'],
                    'submission_deadline' => $p['end']->copy()->addDays(30),
                    'status' => $p['start']->isPast() ? 'closed' : 'active',
                ]
            );
            $cycles[] = $cycle;
        }
        return $cycles;
    }

    private function seedAppraisals(
        Tenant $tenant,
        array $cycles,
        User $staff,
        ?User $maria,
        ?User $john,
        ?User $thabo,
        ?User $hr,
        ?User $admin
    ): void {
        if (empty($cycles)) {
            return;
        }
        $cycle = $cycles[1] ?? $cycles[0]; // Use current FY
        $supervisor = $hr ?? $admin ?? $staff;
        $hod = $admin ?? $hr;

        $appraisals = [
            [
                'employee' => $staff,
                'status' => 'draft',
                'self_assessment' => null,
            ],
            [
                'employee' => $maria ?? $staff,
                'status' => 'employee_submitted',
                'self_assessment' => 'Completed key deliverables for gender programme. Good teamwork.',
                'submitted_at' => Carbon::now()->subDays(5),
            ],
            [
                'employee' => $john ?? $staff,
                'status' => 'supervisor_reviewed',
                'self_assessment' => 'Met all reporting deadlines. Led two capacity-building workshops.',
                'supervisor_comments' => 'Strong performance. Recommend confirmation.',
                'supervisor_rating' => 4,
                'supervisor_reviewed_at' => Carbon::now()->subDays(2),
                'submitted_at' => Carbon::now()->subDays(10),
            ],
            [
                'employee' => $thabo ?? $staff,
                'status' => 'finalized',
                'self_assessment' => 'Achieved objectives. Supported governance meetings.',
                'supervisor_comments' => 'Satisfactory. Development areas identified.',
                'supervisor_rating' => 3,
                'supervisor_reviewed_at' => Carbon::now()->subDays(15),
                'hod_comments' => 'Approved.',
                'hod_rating' => 3,
                'hod_reviewed_at' => Carbon::now()->subDays(12),
                'overall_rating' => 3,
                'overall_rating_label' => 'Meets Expectations',
                'development_plan' => 'Training on project management.',
                'finalized_at' => Carbon::now()->subDays(10),
                'submitted_at' => Carbon::now()->subDays(20),
            ],
        ];

        foreach ($appraisals as $a) {
            $emp = $a['employee'];
            if (! $emp) {
                continue;
            }
            Appraisal::firstOrCreate(
                [
                    'tenant_id' => $tenant->id,
                    'cycle_id' => $cycle->id,
                    'employee_id' => $emp->id,
                ],
                [
                    'supervisor_id' => $supervisor->id,
                    'hod_id' => $hod->id,
                    'status' => $a['status'],
                    'self_assessment' => $a['self_assessment'] ?? null,
                    'supervisor_comments' => $a['supervisor_comments'] ?? null,
                    'supervisor_rating' => $a['supervisor_rating'] ?? null,
                    'supervisor_reviewed_at' => $a['supervisor_reviewed_at'] ?? null,
                    'hod_comments' => $a['hod_comments'] ?? null,
                    'hod_rating' => $a['hod_rating'] ?? null,
                    'hod_reviewed_at' => $a['hod_reviewed_at'] ?? null,
                    'overall_rating' => $a['overall_rating'] ?? null,
                    'overall_rating_label' => $a['overall_rating_label'] ?? null,
                    'development_plan' => $a['development_plan'] ?? null,
                    'submitted_at' => $a['submitted_at'] ?? null,
                    'finalized_at' => $a['finalized_at'] ?? null,
                ]
            );
        }
    }

    private function seedConductRecords(Tenant $tenant, User $staff, ?User $maria, ?User $john, ?User $hr): void
    {
        $recorder = $hr ?? $staff;
        $today = Carbon::today();

        $records = [
            [
                'employee' => $staff,
                'record_type' => 'commendation',
                'status' => 'closed',
                'title' => 'Excellence in workshop facilitation',
                'description' => 'Recognised for outstanding facilitation of the regional capacity-building workshop in Lusaka.',
                'issue_date' => $today->copy()->subMonths(2),
                'resolution_date' => $today->copy()->subMonths(2),
            ],
            [
                'employee' => $maria ?? $staff,
                'record_type' => 'commendation',
                'status' => 'open',
                'title' => 'Gender programme delivery',
                'description' => 'Commendation for timely delivery of gender audit reports and stakeholder engagement.',
                'issue_date' => $today->copy()->subWeeks(2),
            ],
            [
                'employee' => $john ?? $staff,
                'record_type' => 'written_warning',
                'status' => 'resolved',
                'title' => 'Deadline compliance',
                'description' => 'Written warning regarding missed reporting deadline. Employee acknowledged and improved.',
                'issue_date' => $today->copy()->subMonths(4),
                'resolution_date' => $today->copy()->subMonths(3),
                'outcome' => 'Acknowledged. No repeat incidents.',
            ],
        ];

        foreach ($records as $r) {
            $emp = $r['employee'];
            if (! $emp) {
                continue;
            }
            ConductRecord::firstOrCreate(
                [
                    'tenant_id' => $tenant->id,
                    'employee_id' => $emp->id,
                    'title' => $r['title'],
                    'issue_date' => $r['issue_date'],
                ],
                [
                    'recorded_by' => $recorder->id,
                    'reviewed_by' => $recorder->id,
                    'record_type' => $r['record_type'],
                    'status' => $r['status'],
                    'description' => $r['description'],
                    'incident_date' => $r['incident_date'] ?? $r['issue_date'],
                    'outcome' => $r['outcome'] ?? null,
                    'resolution_date' => $r['resolution_date'] ?? null,
                    'is_confidential' => false,
                ]
            );
        }
    }

    private function seedPerformanceTrackers(Tenant $tenant, User $staff, ?User $maria, ?User $john, ?User $hr): void
    {
        $cycleStart = Carbon::today()->startOfYear();
        $cycleEnd = $cycleStart->copy()->addYear()->subDay();
        $supervisor = $hr ?? $staff;

        $employees = array_filter([$staff, $maria, $john]);
        foreach ($employees as $emp) {
            PerformanceTracker::firstOrCreate(
                [
                    'tenant_id' => $tenant->id,
                    'employee_id' => $emp->id,
                    'cycle_start' => $cycleStart,
                    'cycle_end' => $cycleEnd,
                ],
                [
                    'supervisor_id' => $supervisor->id,
                    'status' => 'satisfactory',
                    'trend' => 'stable',
                    'completed_task_count' => 12,
                    'overdue_task_count' => 0,
                    'blocked_task_count' => 0,
                    'timesheet_hours_logged' => 380,
                    'commendation_count' => 1,
                    'disciplinary_case_count' => 0,
                    'supervisor_summary' => 'On track for cycle.',
                ]
            );
        }
    }
}
