<?php

namespace Database\Seeders;

use App\Models\Assignment;
use App\Models\AssignmentUpdate;
use App\Models\Department;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class AssignmentsSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::where('slug', 'sadcpf')->first();
        if (! $tenant) {
            return;
        }

        $sg    = User::where('email', 'bsekgoma@sadcpf.org')->first();   // Secretary General
        $maria = User::where('email', 'skauvee@sadcpf.org')->first();   // HR Manager
        $thabo = User::where('email', 'tmwaala@sadcpf.org')->first();   // Finance Controller
        $staff = User::where('email', 'skurasha@sadcpf.org')->first();  // staff
        $finance = User::where('email', 'lboois@sadcpf.org')->first();  // Finance Controller
        $hr    = User::where('email', 'skauvee@sadcpf.org')->first();   // HR Manager
        $john  = User::where('email', 'pkanguatjivi@sadcpf.org')->first(); // staff

        if (! $sg || ! $maria) {
            return;
        }

        $osgDept = Department::where('tenant_id', $tenant->id)->where('code', 'OSG')->first();
        $pbDept  = Department::where('tenant_id', $tenant->id)->where('code', 'PB')->first();
        $fcsDept = Department::where('tenant_id', $tenant->id)->where('code', 'FCS')->first();

        $assignments = [
            // 1. Active assignment from SG to Maria
            [
                'reference_number'   => 'ASN-' . strtoupper(Str::random(7)),
                'tenant_id'          => $tenant->id,
                'title'              => 'Prepare SADC-PF Annual Report 2025',
                'description'        => 'Compile and finalise the SADC-PF Annual Report covering all parliamentary activities, resolutions, and programme outcomes for the 2025 fiscal year.',
                'objective'          => 'Produce a comprehensive annual report to be presented at the plenary session.',
                'expected_output'    => 'A finalized 80-100 page Annual Report document with executive summary, approved by the Secretary General.',
                'type'               => 'individual',
                'priority'           => 'high',
                'status'             => 'active',
                'created_by'         => $sg->id,
                'assigned_to'        => $maria->id,
                'department_id'      => $pbDept?->id,
                'start_date'         => now()->subDays(14)->toDateString(),
                'due_date'           => now()->addDays(21)->toDateString(),
                'checkin_frequency'  => 'weekly',
                'progress_percent'   => 45,
                'issued_at'          => now()->subDays(14),
                'accepted_at'        => now()->subDays(13),
                'acceptance_decision'=> 'accepted',
            ],
            // 2. Awaiting acceptance from SG to Thabo
            [
                'reference_number'   => 'ASN-' . strtoupper(Str::random(7)),
                'tenant_id'          => $tenant->id,
                'title'              => 'Review Committee Governance Framework',
                'description'        => 'Conduct a comprehensive review of the current Committee Governance Framework and propose amendments aligned with the updated SADC Treaty provisions.',
                'objective'          => 'Ensure the governance framework is current, compliant, and fit for purpose.',
                'expected_output'    => 'A review report with recommendations and a revised framework document.',
                'type'               => 'individual',
                'priority'           => 'medium',
                'status'             => 'awaiting_acceptance',
                'created_by'         => $sg->id,
                'assigned_to'        => $thabo->id,
                'department_id'      => $pbDept?->id,
                'start_date'         => now()->toDateString(),
                'due_date'           => now()->addDays(30)->toDateString(),
                'checkin_frequency'  => 'biweekly',
                'progress_percent'   => 0,
                'issued_at'          => now()->subDay(),
            ],
            // 3. Blocked assignment
            [
                'reference_number'   => 'ASN-' . strtoupper(Str::random(7)),
                'tenant_id'          => $tenant->id,
                'title'              => 'Procurement of ICT Equipment for Plenary Hall',
                'description'        => 'Manage the procurement process for ICT equipment including audio-visual systems, voting systems, and networking infrastructure for the renovated plenary hall.',
                'objective'          => 'Complete procurement on time to meet the plenary hall renovation timeline.',
                'expected_output'    => 'All ICT equipment procured, delivered, and installed before the next plenary session.',
                'type'               => 'individual',
                'priority'           => 'critical',
                'status'             => 'blocked',
                'created_by'         => $sg->id,
                'assigned_to'        => $john?->id ?? $staff->id,
                'department_id'      => $fcsDept?->id,
                'start_date'         => now()->subDays(20)->toDateString(),
                'due_date'           => now()->addDays(10)->toDateString(),
                'checkin_frequency'  => 'daily',
                'progress_percent'   => 30,
                'blocker_type'       => 'awaiting_approval',
                'blocker_details'    => 'Awaiting Finance Committee approval for budget reallocation of USD 45,000. Request submitted 5 days ago.',
                'issued_at'          => now()->subDays(20),
                'accepted_at'        => now()->subDays(19),
                'acceptance_decision'=> 'accepted',
            ],
            // 4. Completed assignment
            [
                'reference_number'   => 'ASN-' . strtoupper(Str::random(7)),
                'tenant_id'          => $tenant->id,
                'title'              => 'Develop HR Policy Manual 2025 Edition',
                'description'        => 'Update and expand the SADC-PF HR Policy Manual to include new provisions on remote working, performance management, and disciplinary procedures.',
                'objective'          => 'Ensure the HR policy framework is comprehensive, legally compliant, and aligned with best practices.',
                'expected_output'    => 'A fully revised HR Policy Manual approved by management.',
                'type'               => 'individual',
                'priority'           => 'high',
                'status'             => 'completed',
                'created_by'         => $sg->id,
                'assigned_to'        => $hr?->id ?? $staff->id,
                'department_id'      => $fcsDept?->id,
                'start_date'         => now()->subDays(60)->toDateString(),
                'due_date'           => now()->subDays(5)->toDateString(),
                'checkin_frequency'  => 'weekly',
                'progress_percent'   => 100,
                'issued_at'          => now()->subDays(60),
                'accepted_at'        => now()->subDays(59),
                'acceptance_decision'=> 'accepted',
            ],
            // 5. Overdue assignment (draft that was never issued — at risk)
            [
                'reference_number'   => 'ASN-' . strtoupper(Str::random(7)),
                'tenant_id'          => $tenant->id,
                'title'              => 'Prepare Quarter 1 Budget Variance Report',
                'description'        => 'Prepare the Q1 budget variance analysis, identifying significant deviations from the approved budget and providing commentary with recommended corrective actions.',
                'objective'          => 'Enable the Finance Committee to make informed decisions on budget reallocation.',
                'expected_output'    => 'Q1 Budget Variance Report submitted to the Finance Committee.',
                'type'               => 'individual',
                'priority'           => 'high',
                'status'             => 'active',
                'created_by'         => $sg->id,
                'assigned_to'        => $finance?->id ?? $staff->id,
                'department_id'      => $fcsDept?->id,
                'start_date'         => now()->subDays(45)->toDateString(),
                'due_date'           => now()->subDays(7)->toDateString(), // overdue
                'checkin_frequency'  => 'weekly',
                'progress_percent'   => 60,
                'issued_at'          => now()->subDays(45),
                'accepted_at'        => now()->subDays(44),
                'acceptance_decision'=> 'accepted',
            ],
            // 6. Collaborative/sector assignment
            [
                'reference_number'   => 'ASN-' . strtoupper(Str::random(7)),
                'tenant_id'          => $tenant->id,
                'title'              => 'Coordinate SADC Parliamentary Capacity Building Workshop',
                'description'        => 'Plan, coordinate, and execute the regional parliamentary capacity building workshop scheduled for Q2, covering topics on legislative drafting, committee management, and constitutional law.',
                'objective'          => 'Strengthen parliamentary capacity across SADC member states.',
                'expected_output'    => 'Workshop delivered with minimum 15 parliaments represented; post-workshop evaluation report submitted within 2 weeks.',
                'type'               => 'collaborative',
                'priority'           => 'high',
                'status'             => 'active',
                'created_by'         => $sg->id,
                'assigned_to'        => $maria->id,
                'department_id'      => $pbDept?->id,
                'start_date'         => now()->subDays(7)->toDateString(),
                'due_date'           => now()->addDays(45)->toDateString(),
                'checkin_frequency'  => 'weekly',
                'progress_percent'   => 20,
                'issued_at'          => now()->subDays(7),
                'accepted_at'        => now()->subDays(6),
                'acceptance_decision'=> 'accepted',
            ],
            // 7. Draft
            [
                'reference_number'   => 'ASN-' . strtoupper(Str::random(7)),
                'tenant_id'          => $tenant->id,
                'title'              => 'Prepare Strategic Plan 2026–2030',
                'description'        => 'Lead the development of the SADC-PF Strategic Plan for the period 2026–2030 through a consultative process involving all departments and external stakeholders.',
                'objective'          => 'Set a clear strategic direction for SADC-PF for the next five years.',
                'expected_output'    => 'An approved Strategic Plan document ready for adoption at the plenary.',
                'type'               => 'sector',
                'priority'           => 'critical',
                'status'             => 'draft',
                'created_by'         => $sg->id,
                'assigned_to'        => $maria->id,
                'department_id'      => $osgDept?->id,
                'start_date'         => now()->addDays(7)->toDateString(),
                'due_date'           => now()->addDays(90)->toDateString(),
                'checkin_frequency'  => 'monthly',
                'progress_percent'   => 0,
            ],
        ];

        foreach ($assignments as $data) {
            $assignment = Assignment::create($data);

            // Add progress updates to active ones
            if (in_array($assignment->status, ['active', 'blocked', 'completed'])) {
                AssignmentUpdate::create([
                    'tenant_id'      => $tenant->id,
                    'assignment_id'  => $assignment->id,
                    'submitted_by'   => $assignment->assigned_to,
                    'type'           => 'update',
                    'progress_percent' => $assignment->progress_percent,
                    'notes'          => 'Progress update: work is ongoing as planned.',
                ]);
            }

            if ($assignment->status === 'blocked') {
                AssignmentUpdate::create([
                    'tenant_id'      => $tenant->id,
                    'assignment_id'  => $assignment->id,
                    'submitted_by'   => $assignment->assigned_to,
                    'type'           => 'escalation',
                    'progress_percent' => $assignment->progress_percent,
                    'notes'          => 'Escalating blocker to SG: budget reallocation approval is critical path.',
                    'blocker_type'   => 'awaiting_approval',
                    'blocker_details'=> $assignment->blocker_details,
                ]);
            }
        }
    }
}
